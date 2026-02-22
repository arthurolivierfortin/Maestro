using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Context;
using Microsoft.Extensions.DependencyInjection;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Executor for agent blocks: systemPrompt → multi-turn agentic loop → tool calls → response.
/// Decoupled from LLMBlockExecutorBase — agents are composite (isAtomic: false).
/// LLM parameters (model, temperature, maxTokens) come from config.nodes child blocks
/// (or from own config as deprecated fallback for agents without config.nodes).
/// Tool calls are dispatched two ways:
///   1. Generic block dispatch: tool name = block-id, args = JSON inputs (recommended)
///   2. maestro_cli: legacy CLI string parsing (backward compat)
/// Agent signals completion via "step-complete" tool call.
/// All content (system prompt, tool descriptions) comes from block config/files.
/// The executor is pure mechanical plumbing — it never defines what tools are available.
/// </summary>
public class AgentBlockExecutor : IBlockExecutor
{
    private readonly ILLMGateway _llmGateway;
    private readonly IServiceProvider? _serviceProvider;
    private readonly IServiceScopeFactory? _scopeFactory;
    private readonly IConversationManager _conversationManager;
    private readonly IContextAssembler _contextAssembler;
    private IBlockDiscoveryService? _blockDiscovery;
    private BlockExecutorRegistry? _executorRegistry;
    private ICliExecutor? _cliExecutor;

    public AgentBlockExecutor(ILLMGateway llmGateway, IServiceProvider? serviceProvider = null, IExecutionMonitor? monitor = null)
    {
        _llmGateway = llmGateway ?? throw new ArgumentNullException(nameof(llmGateway));
        _serviceProvider = serviceProvider;
        // Use IServiceScopeFactory to create per-execution scopes for CLI tool calls.
        // This avoids ObjectDisposedException when the original DI scope is disposed
        // before background Task.Run completes (session invoke path).
        _scopeFactory = serviceProvider?.GetService<IServiceScopeFactory>();
        // Resolve IConversationManager from DI (registered as singleton)
        _conversationManager = serviceProvider?.GetService<IConversationManager>()
            ?? new Maestro.Infrastructure.Context.InMemoryConversationManager();
        // Resolve IContextAssembler from DI
        _contextAssembler = serviceProvider?.GetService<IContextAssembler>()
            ?? new Maestro.Infrastructure.Context.ContextAssembler(
                _conversationManager, new ContextProcessorFactory(serviceProvider));
        // Block discovery and executor registry are resolved LAZILY at execution time
        // to avoid circular DI: AgentBlockExecutor ↔ BlockExecutorRegistry deadlock.
        // _blockDiscovery and _executorRegistry are populated on first use in ExecuteViaBlockDispatchAsync.
    }

    public string SupportedType => "agent";

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        var result = new BlockExecutionResult();

        // 1. Mock check
        var mockResult = await LLMBlockExecutorBase.TryLoadMockResponse(block, sw, ct);
        if (mockResult != null) return mockResult;

        // 2. Load systemPrompt — MUST exist in config or file. No hardcoded default.
        var systemPrompt = await LoadSystemPrompt(block, ct);
        if (string.IsNullOrEmpty(systemPrompt))
        {
            return LLMBlockExecutorBase.ErrorResult(
                "Agent block requires a system prompt. Provide config.systemPrompt or system-prompt.md in the block directory.",
                sw.ElapsedMilliseconds);
        }

        // 3. Build conversation via IConversationManager
        var conversationId = _conversationManager.CreateConversation(systemPrompt);
        var userContent = BuildUserMessage(inputs, block);
        _conversationManager.AddMessage(conversationId, "user", userContent);

        // 4. Resolve LLM params from config.nodes (composite) or own config (legacy/deprecated)
        var childNodeConfig = ResolveChildNodeConfig(block);
        string? modelId;
        int maxTokens;
        float temperature;

        string? planningModel = null;
        int planningIterations = 2;

        if (childNodeConfig.HasValue)
        {
            // Composite path: LLM params come from child inference node in config.nodes
            modelId = childNodeConfig.Value.ModelId
                ?? LLMBlockExecutorBase.ResolveModelId(block, inputs);
            maxTokens = childNodeConfig.Value.MaxTokens;
            temperature = childNodeConfig.Value.Temperature;
            planningModel = childNodeConfig.Value.PlanningModel;
            planningIterations = childNodeConfig.Value.PlanningIterations;
            result.Logs.Add("Agent config: composite (LLM params from config.nodes child)");
        }
        else
        {
            // Legacy path: no config.nodes — read from agent's own config (deprecated)
            modelId = LLMBlockExecutorBase.ResolveModelId(block, inputs);
            (maxTokens, temperature) = LLMBlockExecutorBase.ResolveGenerationParams(block);
            result.Logs.Add("Agent config: legacy (no config.nodes — using own config)");
        }

        var maxIterations = ResolveMaxIterations(block);
        var wallClockTimeoutSeconds = ResolveWallClockTimeout(block);
        var contextConfig = GetContextConfig(block.Config);

        result.Logs.Add($"Using model: {modelId ?? "default"}, temperature: {temperature}, maxTokens: {maxTokens}");
        if (!string.IsNullOrEmpty(planningModel))
            result.Logs.Add($"Planning model: {planningModel} (first {planningIterations} iterations)");
        result.Logs.Add($"Context strategy: {contextConfig.Strategy}, maxTokens: {contextConfig.MaxTokens}");
        result.Logs.Add($"Wall-clock timeout: {wallClockTimeoutSeconds}s, max iterations: {maxIterations}");

        // INFRA-2: Wall-clock timeout via linked CancellationTokenSource
        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(wallClockTimeoutSeconds));
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);
        var agentCt = linkedCts.Token;
        var wallClockStopwatch = Stopwatch.StartNew();
        var timeoutWarningIssued = false; // Track if we already warned about approaching timeout

        // INFRA-3: Loop detection — track recent tool calls to detect repetition
        var recentToolCalls = new List<string>(); // last N tool call signatures
        const int loopDetectionWindow = 3;

        // 5. Agentic loop (mechanical: send → parse tool call → execute → feed back → repeat)
        var iteration = 0;
        var actualToolCallCount = 0; // A-2 done guard: track real tool executions
        var nonJsonRetryCount = 0;   // A-2 non-JSON retry counter
        LLMResponse? lastResponse = null;

        // Token accumulators across all LLM calls in the agentic loop
        var totalPromptTokens = 0;
        var totalCompletionTokens = 0;
        var totalAllTokens = 0;

        while (true)
        {
            // INFRA-2: Check wall-clock timeout
            if (agentCt.IsCancellationRequested)
            {
                result.Logs.Add($"Agent wall-clock timeout reached ({wallClockTimeoutSeconds}s). Stopping.");
                result.Outputs["warning"] = $"Agent stopped: wall-clock timeout ({wallClockTimeoutSeconds}s)";
                break;
            }

            iteration++;
            result.Logs.Add($"Agent iteration {iteration}/{maxIterations}");

            // Process context before sending to LLM (via IContextAssembler)
            var contextResult = await _contextAssembler.AssembleAsync(conversationId, contextConfig, agentCt);

            if (contextResult.WasTruncated)
                result.Logs.Add($"Context truncated: {contextResult.MessagesRemoved} messages removed, ~{contextResult.EstimatedTokens} tokens");

            // Select model: use planningModel for first N iterations, then regular model
            var iterationModel = (!string.IsNullOrEmpty(planningModel) && iteration <= planningIterations)
                ? planningModel
                : modelId;

            // Send to LLM
            var request = new LLMRequest
            {
                Messages = contextResult.Messages,
                ModelId = iterationModel,
                MaxNewTokens = maxTokens,
                Temperature = temperature,
                ConversationId = conversationId
            };

            LLMResponse response;
            try
            {
                response = await _llmGateway.SendAsync(request, agentCt);
            }
            catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested)
            {
                result.Logs.Add($"Agent wall-clock timeout reached ({wallClockTimeoutSeconds}s) during LLM call.");
                result.Outputs["warning"] = $"Agent stopped: wall-clock timeout ({wallClockTimeoutSeconds}s)";
                break;
            }
            catch (Exception ex)
            {
                result.Logs.Add($"LLM request failed (iteration {iteration}): {ex.Message}");

                // Strategy: reduce context window and retry. The failure is often caused by
                // accumulated conversation exceeding provider limits (command-line length,
                // CLI session state corruption, timeout). Reducing context keeps system prompt
                // + recent messages, giving the agent enough to continue.
                if (contextConfig.KeepLastN > 4)
                {
                    // Gradual reduction: keep 75% of messages instead of halving.
                    // Halving (/2) was too aggressive — the agent lost critical context
                    // about which files were read and what changes were made.
                    var reducedKeepN = Math.Max(4, (int)(contextConfig.KeepLastN * 0.75));
                    var reducedMaxTokens = Math.Max(2048, (int)(contextConfig.MaxTokens * 0.75));
                    result.Logs.Add($"Reducing context window from {contextConfig.KeepLastN} to {reducedKeepN} messages, maxTokens {contextConfig.MaxTokens} to {reducedMaxTokens}, and retrying...");
                    contextConfig = new ContextConfig
                    {
                        Strategy = contextConfig.Strategy,
                        MaxTokens = reducedMaxTokens,
                        ReserveForResponse = contextConfig.ReserveForResponse,
                        KeepSystemPrompt = true,
                        KeepLastN = reducedKeepN,
                        ContextBlockRef = contextConfig.ContextBlockRef
                    };
                    // Add recovery message so the agent knows context was lost
                    _conversationManager.AddMessage(conversationId, "user",
                        "SYSTEM NOTE: The previous LLM call failed. Some conversation history has been trimmed. " +
                        "Continue your work. If you need to re-read files, do so. " +
                        "Remember to call step-complete when done.");
                    await Task.Delay(3000, agentCt);
                    continue; // Retry with reduced context
                }

                // Context already minimized — fail permanently
                result.Success = false;
                result.Outputs["error"] = $"LLM request failed: {ex.Message}";
                result.PromptTokens = totalPromptTokens;
                result.CompletionTokens = totalCompletionTokens;
                result.TotalTokens = totalAllTokens;
                result.EstimatedCostUsd = LLMBlockExecutorBase.EstimateCost(lastResponse?.Model ?? modelId, totalPromptTokens, totalCompletionTokens);
                result.DurationMs = sw.ElapsedMilliseconds;
                _conversationManager.CleanupConversation(conversationId);
                return result;
            }

            // Check for empty response
            if (response == null || string.IsNullOrWhiteSpace(response.Content))
            {
                result.Logs.Add("LLM returned empty response.");
                if (iteration == 1)
                {
                    result.Success = false;
                    result.Outputs["error"] = "LLM returned empty response. Check if LLM-Provider service is running.";
                    result.PromptTokens = totalPromptTokens;
                    result.CompletionTokens = totalCompletionTokens;
                    result.TotalTokens = totalAllTokens;
                    result.EstimatedCostUsd = LLMBlockExecutorBase.EstimateCost(modelId, totalPromptTokens, totalCompletionTokens);
                    result.DurationMs = sw.ElapsedMilliseconds;
                    _conversationManager.CleanupConversation(conversationId);
                    return result;
                }
                // Nudge the agent instead of breaking — empty responses often mean the agent
                // "thought" but didn't produce output. Give it one more chance.
                if (nonJsonRetryCount < 2)
                {
                    nonJsonRetryCount++;
                    result.Logs.Add($"Empty response nudge (attempt {nonJsonRetryCount}/2).");
                    _conversationManager.AddMessage(conversationId, "user",
                        "Your last response was empty. You MUST respond with a JSON tool call. " +
                        "If you are done, call step-complete. Otherwise, call your next tool. " +
                        "Example: {\"tool\":\"step-complete\",\"args\":{\"summary\":\"what was done\"}}");
                    continue;
                }
                break; // After 2 empty nudges, give up
            }

            lastResponse = response;

            // Accumulate token metrics
            totalPromptTokens += response.PromptTokens;
            totalCompletionTokens += response.CompletionTokens;
            totalAllTokens += response.TotalTokens;

            result.Logs.Add($"LLM response: {(response.Content.Length > 100 ? response.Content.Substring(0, 100) + "..." : response.Content)}");

            // Parse tool call from response
            var toolCalled = false;
            try
            {
                var jsonContent = LLMBlockExecutorBase.ExtractJson(response.Content);
                if (!string.IsNullOrEmpty(jsonContent))
                {
                    using var doc = JsonDocument.Parse(jsonContent);
                    if (doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty("tool", out var toolProp))
                    {
                        var toolId = toolProp.GetString();
                        var args = doc.RootElement.TryGetProperty("args", out var argsProp) ? argsProp : default;

                        result.Logs.Add($"Tool call detected: {toolId}");

                        // Check for "step-complete" tool — agent finished
                        if (toolId == "step-complete")
                        {
                            // Multi-tool response detection: if the LLM produced both a tool
                            // call AND a step-complete call in the same response, ExtractJson may have
                            // skipped the tool call (due to complex nested escaping in file content)
                            // and returned the step-complete JSON instead. Detect this and ask for retry.
                            var rawContent = response.Content;
                            var stepCompletePos = rawContent.IndexOf("\"step-complete\"");
                            var maestroPos = rawContent.IndexOf("maestro_cli");
                            if (maestroPos >= 0 && stepCompletePos >= 0 && maestroPos < stepCompletePos)
                            {
                                result.Logs.Add("Multi-tool response detected: maestro_cli found before step-complete. Asking for single tool call.");
                                // CRITICAL: Do NOT add the full response to history.
                                // If the LLM sees its own "step-complete" in history, it will not retry.
                                // Instead, add a synthetic assistant message acknowledging the attempt,
                                // then a clear user message demanding the write.
                                _conversationManager.AddMessage(conversationId, "assistant", "{\"acknowledged\":\"multi-tool-rejected\"}");
                                _conversationManager.AddMessage(conversationId, "user",
                                    "SYSTEM ERROR: Your response contained multiple tool calls. It was NOT executed. " +
                                    "Nothing was done. " +
                                    "You MUST re-send the tool call as your ONLY response — just the JSON object, nothing else. " +
                                    "Do NOT call step-complete. Do NOT include any other tool call. ONLY the tool call you need to execute.");
                                toolCalled = true;
                                nonJsonRetryCount = 0;
                                continue;
                            }

                            // Log if the agent completed without any maestro_cli tool calls.
                            // This is valid for planning/analysis agents that produce output directly.
                            if (actualToolCallCount == 0)
                            {
                                result.Logs.Add("Agent called 'step-complete' with 0 tool calls (planning/analysis mode).");
                            }

                            // Store full args as structured output (supports arbitrary properties)
                            var resultOutput = args.ValueKind == JsonValueKind.Object
                                ? args.ToString()
                                : "Task completed";
                            result.Outputs["result"] = resultOutput;

                            var summary = args.ValueKind == JsonValueKind.Object && args.TryGetProperty("summary", out var sumProp)
                                ? sumProp.GetString() ?? "Task completed"
                                : "Task completed";
                            result.Logs.Add($"Agent completed ({actualToolCallCount} tool calls): {summary}");
                            break;
                        }

                        // INFRA-3: Loop detection — check if same tool call repeats N times
                        var toolCallSignature = $"{toolId}:{args.ToString()}";
                        recentToolCalls.Add(toolCallSignature);
                        if (recentToolCalls.Count >= loopDetectionWindow)
                        {
                            var lastN = recentToolCalls.Skip(recentToolCalls.Count - loopDetectionWindow).ToList();
                            if (lastN.All(tc => tc == lastN[0]))
                            {
                                result.Logs.Add($"Loop detected: same tool call '{toolId}' repeated {loopDetectionWindow} times. Breaking.");
                                result.Outputs["warning"] = $"Agent stopped: loop detected (same call repeated {loopDetectionWindow}x)";
                                break;
                            }
                        }

                        // Execute tool via CLI
                        var toolOutput = await ExecuteToolCall(toolId!, args, jsonContent, block, context, result, agentCt);
                        actualToolCallCount++;

                        // Multi-tool detection: check if the raw response contains additional
                        // JSON objects after the one we parsed. If so, warn the agent that
                        // those extra tool calls were NOT executed. This prevents hallucination
                        // where the agent thinks all tools ran but only the first did.
                        var extraToolWarning = "";
                        var fullRawContent = response.Content;
                        var firstJsonEnd = fullRawContent.IndexOf(jsonContent, StringComparison.Ordinal);
                        if (firstJsonEnd >= 0)
                        {
                            var afterFirst = fullRawContent.Substring(firstJsonEnd + jsonContent.Length).Trim();
                            if (afterFirst.Contains("{\"tool\":"))
                            {
                                var extraCount = 0;
                                var searchPos = 0;
                                while ((searchPos = afterFirst.IndexOf("{\"tool\":", searchPos, StringComparison.Ordinal)) >= 0)
                                {
                                    extraCount++;
                                    searchPos += 8;
                                }
                                extraToolWarning = $"\n\nWARNING: Your response contained {extraCount} additional tool call(s) that were NOT executed. " +
                                    "Only the FIRST tool call in your response was executed. " +
                                    "You MUST send ONE tool call per response. Send your next tool call now.";
                                result.Logs.Add($"Multi-tool detected: {extraCount} extra tool call(s) dropped from response.");
                            }
                        }

                        // Feed back into conversation
                        _conversationManager.AddMessage(conversationId, "assistant", jsonContent);
                        _conversationManager.AddMessage(conversationId, "user", $"Tool result for {toolId}:\n{toolOutput}{extraToolWarning}");
                        toolCalled = true;
                        nonJsonRetryCount = 0; // Reset retry counter on successful tool call
                    }
                }
            }
            catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested)
            {
                result.Logs.Add($"Agent wall-clock timeout reached ({wallClockTimeoutSeconds}s) during tool execution.");
                result.Outputs["warning"] = $"Agent stopped: wall-clock timeout ({wallClockTimeoutSeconds}s)";
                break;
            }
            catch (Exception ex)
            {
                // A-2 exception retry: parse errors are retriable, not silent breaks
                result.Logs.Add($"Tool call parse error: {ex.Message}");
                if (nonJsonRetryCount < 2)
                {
                    nonJsonRetryCount++;
                    _conversationManager.AddMessage(conversationId, "assistant", response.Content);
                    _conversationManager.AddMessage(conversationId, "user",
                        "Your response caused a parsing error. " +
                        "Respond with ONLY a valid JSON object. No text before or after.");
                    continue;
                }
            }

            // A-2 non-JSON retry: nudge the agent instead of breaking on first non-JSON
            if (!toolCalled)
            {
                if (nonJsonRetryCount < 2)
                {
                    nonJsonRetryCount++;
                    result.Logs.Add($"Response not valid JSON (retry {nonJsonRetryCount}/2).");
                    _conversationManager.AddMessage(conversationId, "assistant", response.Content);
                    _conversationManager.AddMessage(conversationId, "user",
                        "Your response was not a valid JSON tool call. " +
                        "Respond with ONLY a JSON object — no prose, no markdown.\n\n" +
                        "If you are DONE with the task, respond with:\n" +
                        "{\"tool\":\"step-complete\",\"args\":{\"summary\":\"what was accomplished\",\"filesCreated\":[],\"filesModified\":[],\"buildPassed\":true}}\n\n" +
                        "If you need to do more work, call the next tool:\n" +
                        "{\"tool\":\"file-read\",\"args\":{\"path\":\"/some/path\"}}");
                    continue;
                }
                break;
            }

            // Wall-clock timeout countdown nudge: warn agent when 75% of time is used
            var elapsedSeconds = wallClockStopwatch.Elapsed.TotalSeconds;
            var timeoutThreshold = wallClockTimeoutSeconds * 0.75;
            if (!timeoutWarningIssued && elapsedSeconds >= timeoutThreshold)
            {
                var remainingSeconds = (int)(wallClockTimeoutSeconds - elapsedSeconds);
                result.Logs.Add($"Wall-clock timeout warning: {remainingSeconds}s remaining.");
                _conversationManager.AddMessage(conversationId, "user",
                    $"SYSTEM WARNING: Wall-clock timeout approaching. You have ~{remainingSeconds} seconds remaining. " +
                    "Finish your current work and call step-complete with a summary. " +
                    "Do not start new tasks — the session will be terminated when time runs out.");
                timeoutWarningIssued = true;
            }

            // Iteration countdown nudge: when approaching max iterations, remind the agent.
            // Start early (<=5) so the agent has time to wrap up — at <=3 it's often too late.
            var remaining = maxIterations - iteration;
            if (remaining <= 5 && remaining > 0)
            {
                var urgency = remaining <= 2 ? "URGENT" : "NOTE";
                result.Logs.Add($"Iteration countdown: {remaining} iterations remaining.");
                _conversationManager.AddMessage(conversationId, "user",
                    $"SYSTEM {urgency}: You have {remaining} iteration(s) remaining. " +
                    (remaining <= 2
                        ? "You MUST call step-complete NOW with a summary of everything accomplished so far. Do NOT start any new work."
                        : "Start wrapping up your work. Finish current changes, verify them, and call step-complete. Do not start new tasks."));
            }

            if (iteration >= maxIterations)
            {
                result.Logs.Add("Max iterations reached without step-complete.");
                // Set success=true if tool calls were made — work was likely done
                if (actualToolCallCount > 0)
                {
                    result.Success = true;
                    result.Outputs["result"] = $"Agent completed {actualToolCallCount} tool calls but did not call step-complete (max iterations reached).";
                    result.Outputs["warning"] = "step-complete not called";
                }
                break;
            }
        }

        // 6. Parse structured outputs from last response
        // Only call ParseOutputs if no output was already set by the agent loop
        // (done handler sets "result", timeout handler sets "warning").
        // Adding "content" alongside these would create multi-output format that
        // prepends key names, breaking downstream JSON parsing.
        if (!result.Outputs.ContainsKey("result") && !result.Outputs.ContainsKey("warning"))
        {
            if (lastResponse != null && !string.IsNullOrWhiteSpace(lastResponse.Content))
            {
                LLMBlockExecutorBase.ParseOutputs(result, lastResponse.Content, block);
                result.Logs.Add("Agent LLM response received (fallback output)");
            }
            else
            {
                result.Success = false;
                result.Outputs["error"] = "Agent completed without producing output";
                result.Logs.Add("Warning: Agent completed but no valid output was produced");
            }
        }

        // 7. Publish conversation state for observability (monitor can read this)
        var finalState = _conversationManager.GetState(conversationId);
        if (finalState != null)
        {
            result.Outputs["_conversationState"] = System.Text.Json.JsonSerializer.Serialize(finalState);
            result.Logs.Add($"Conversation stats: {finalState.TotalMessageCount} messages, ~{finalState.EstimatedTotalTokens} tokens");
        }

        // 8. Write token metrics into result
        result.PromptTokens = totalPromptTokens;
        result.CompletionTokens = totalCompletionTokens;
        result.TotalTokens = totalAllTokens;
        result.EstimatedCostUsd = LLMBlockExecutorBase.EstimateCost(lastResponse?.Model ?? modelId, totalPromptTokens, totalCompletionTokens);
        result.Logs.Add($"Total tokens: {totalAllTokens} (prompt={totalPromptTokens}, completion={totalCompletionTokens}), cost=${result.EstimatedCostUsd:F6}");

        // 9. Cleanup conversation
        _conversationManager.CleanupConversation(conversationId);

        result.DurationMs = sw.ElapsedMilliseconds;
        return result;
    }

    /// <summary>
    /// Loads system prompt from file (system-prompt.md) or config (config.systemPrompt).
    /// Returns empty string if neither exists — caller must treat this as an error.
    /// </summary>
    private async Task<string> LoadSystemPrompt(BlockDefinition block, CancellationToken ct)
    {
        var path = LLMBlockExecutorBase.GetBlockPath(block);
        if (path != null)
        {
            var sp = Path.Combine(path, "system-prompt.md");
            if (File.Exists(sp))
                return await File.ReadAllTextAsync(sp, ct);
        }

        if (block.Config != null && block.Config.TryGetValue("systemPrompt", out var sysPromptConfig) && sysPromptConfig != null)
            return sysPromptConfig.ToString() ?? string.Empty;

        return string.Empty;
    }

    /// <summary>
    /// Builds user message by concatenating non-empty inputs.
    /// No hardcoded markdown structure — just uses what's provided.
    /// </summary>
    private static string BuildUserMessage(Dictionary<string, object> inputs, BlockDefinition block)
    {
        var sb = new System.Text.StringBuilder();

        // Task description (supports both "task" and "subtask" input names)
        var taskDescription = ExtractTaskDescription(inputs);
        if (!string.IsNullOrEmpty(taskDescription))
        {
            sb.AppendLine("## Task");
            sb.AppendLine(taskDescription);
            sb.AppendLine();
        }

        // Working directory
        if (inputs.TryGetValue("workingDir", out var wdObj) && !string.IsNullOrEmpty(wdObj?.ToString()))
        {
            sb.AppendLine("## Working Directory");
            sb.AppendLine(wdObj.ToString());
            sb.AppendLine();
        }

        // Target file
        if (inputs.TryGetValue("targetFile", out var tfObj) && !string.IsNullOrEmpty(tfObj?.ToString()))
        {
            sb.AppendLine("## Target File");
            sb.AppendLine(tfObj.ToString());
            sb.AppendLine();
        }

        // Additional context
        if (inputs.TryGetValue("context", out var ctxObj) && !string.IsNullOrEmpty(ctxObj?.ToString()))
        {
            sb.AppendLine("## Additional Context");
            sb.AppendLine(ctxObj.ToString());
            sb.AppendLine();
        }

        // Include ALL remaining inputs that weren't handled above
        // This ensures agents see repoPath, changes, conventions, step, review, etc.
        var handledKeys = new HashSet<string> { "task", "subtask", "workingDir", "targetFile", "context" };
        foreach (var kv in inputs)
        {
            if (handledKeys.Contains(kv.Key) || kv.Value == null || string.IsNullOrEmpty(kv.Value.ToString()))
                continue;
            sb.AppendLine($"## {char.ToUpper(kv.Key[0])}{kv.Key[1..]}");
            sb.AppendLine(kv.Value.ToString());
            sb.AppendLine();
        }

        // Fallback to "user" config if no task input
        if (sb.Length == 0 && block.Config != null && block.Config.TryGetValue("user", out var u))
        {
            sb.AppendLine(u?.ToString() ?? string.Empty);
        }

        var content = sb.ToString().Trim();
        return string.IsNullOrEmpty(content) ? "Start by listing files." : content;
    }

    private static string ExtractTaskDescription(Dictionary<string, object> inputs)
    {
        if (inputs.TryGetValue("task", out var taskObj) && taskObj != null)
            return taskObj.ToString() ?? string.Empty;

        if (inputs.TryGetValue("subtask", out var subtaskObj) && subtaskObj != null)
        {
            if (subtaskObj is JsonElement jsonEl)
            {
                if (jsonEl.TryGetProperty("description", out var descProp))
                    return descProp.GetString() ?? jsonEl.ToString();
                return jsonEl.ToString();
            }
            return subtaskObj.ToString() ?? string.Empty;
        }

        return string.Empty;
    }

    private static int ResolveMaxIterations(BlockDefinition block)
    {
        var maxIterations = 5;
        if (block.Config != null)
        {
            if (block.Config.TryGetValue("maxIterations", out var mi))
            {
                if (mi is int mii) maxIterations = mii;
                else if (int.TryParse(mi?.ToString(), out var parsed)) maxIterations = parsed;
            }
            else if (block.Config.TryGetValue("maxSteps", out var ms))
            {
                if (ms is int msi) maxIterations = msi;
                else if (int.TryParse(ms?.ToString(), out var parsed)) maxIterations = parsed;
            }
        }
        return maxIterations;
    }

    /// <summary>
    /// INFRA-2: Resolves wall-clock timeout in seconds from block config.
    /// Default: 300s (5 minutes). Configurable via config.wallClockTimeoutSeconds.
    /// </summary>
    private static int ResolveWallClockTimeout(BlockDefinition block)
    {
        var timeout = 300; // 5 minutes default
        if (block.Config != null)
        {
            if (block.Config.TryGetValue("wallClockTimeoutSeconds", out var wt))
            {
                if (wt is int wti) timeout = wti;
                else if (int.TryParse(wt?.ToString(), out var parsed)) timeout = parsed;
            }
            else if (block.Config.TryGetValue("timeoutSeconds", out var ts))
            {
                if (ts is int tsi) timeout = tsi;
                else if (int.TryParse(ts?.ToString(), out var parsed)) timeout = parsed;
            }
        }
        return Math.Max(10, timeout); // Minimum 10 seconds
    }

    /// <summary>
    /// Executes a tool call. Two paths:
    /// 1. maestro_cli → legacy CLI string parsing (backward compat)
    /// 2. Any other tool name → generic block dispatch (tool name = block-id, args = JSON inputs)
    /// </summary>
    private async Task<string> ExecuteToolCall(
        string toolId, JsonElement args, string jsonContent,
        BlockDefinition block, ExecutionContext context,
        BlockExecutionResult result, CancellationToken ct)
    {
        // Path 1: maestro_cli (legacy, kept for backward compatibility)
        if (toolId == "maestro_cli" || toolId == "maestro-cli")
        {
            string? command = null;
            if (args.ValueKind == JsonValueKind.Object && args.TryGetProperty("command", out var cmdProp))
                command = cmdProp.GetString();
            result.Logs.Add($"maestro_cli tool call: {command}");

            if (string.IsNullOrEmpty(command))
                return "Error: maestro_cli requires a 'command' argument.";

            return await ExecuteViaCliAsync(command, block, context, result, ct);
        }

        // Normalize common tool name aliases. LLMs sometimes use alternate names
        // (e.g., "bash" instead of "shell-execute", "read-file" instead of "file-read").
        toolId = NormalizeToolId(toolId);

        // Path 2: Generic block dispatch — tool name = block-id, args = JSON inputs
        return await ExecuteViaBlockDispatchAsync(toolId, args, context, result, ct);
    }

    /// <summary>
    /// Executes a tool call via the CLI executor (legacy maestro_cli path).
    /// </summary>
    private async Task<string> ExecuteViaCliAsync(
        string command, BlockDefinition block, ExecutionContext context,
        BlockExecutionResult result, CancellationToken ct)
    {
        var cliExecutor = GetCliExecutor();
        if (cliExecutor == null)
        {
            result.Logs.Add("Warning: CLI executor not available, tool execution skipped");
            return "Error: CLI executor not available. Ensure services are properly configured.";
        }

        var cliContext = new CliExecutionContext
        {
            WorkspaceId = context.Variables.TryGetValue("workspaceId", out var wsId) ? wsId?.ToString() : null,
            SessionId = context.Variables.TryGetValue("sessionId", out var sessId) ? sessId?.ToString() : null,
            AgentId = context.Variables.TryGetValue("agentId", out var agentId) ? agentId?.ToString() : block.Id
        };

        var cliResult = await cliExecutor.ExecuteAsync(command, cliContext, ct);

        string toolOutput;
        if (cliResult.Success)
        {
            if (cliResult.Output is string strOutput)
                toolOutput = strOutput;
            else if (cliResult.Output != null)
            {
                try { toolOutput = JsonSerializer.Serialize(cliResult.Output); }
                catch { toolOutput = cliResult.Output.ToString() ?? "Success"; }
            }
            else
                toolOutput = "Success";
        }
        else
        {
            toolOutput = $"Error: {cliResult.Error}";
        }

        result.Logs.Add($"CLI result: {(toolOutput.Length > 100 ? toolOutput.Substring(0, 100) + "..." : toolOutput)}");
        return toolOutput;
    }

    /// <summary>
    /// Generic block dispatch: treats tool name as a block-id, passes args as JSON inputs.
    /// This is the new recommended path — no CLI string parsing, JSON stays structured.
    /// </summary>
    private async Task<string> ExecuteViaBlockDispatchAsync(
        string toolId, JsonElement args, ExecutionContext context,
        BlockExecutionResult result, CancellationToken ct)
    {
        // Lazy resolution to avoid circular DI: AgentBlockExecutor ↔ BlockExecutorRegistry.
        // Use _scopeFactory to create a new scope — the original _serviceProvider may be disposed
        // when running in session invoke path (background Task.Run).
        if (_blockDiscovery == null || _executorRegistry == null)
        {
            if (_scopeFactory != null)
            {
                var scope = _scopeFactory.CreateScope();
                _blockDiscovery ??= scope.ServiceProvider.GetService<IBlockDiscoveryService>();
                _executorRegistry ??= scope.ServiceProvider.GetService<BlockExecutorRegistry>();
            }
            else
            {
                _blockDiscovery ??= _serviceProvider?.GetService<IBlockDiscoveryService>();
                _executorRegistry ??= _serviceProvider?.GetService<BlockExecutorRegistry>();
            }
        }
        if (_blockDiscovery == null || _executorRegistry == null)
        {
            result.Logs.Add($"Block dispatch not available for tool '{toolId}' — services not resolved.");
            return $"Error: Tool '{toolId}' cannot be dispatched. Block discovery services unavailable.";
        }

        // Resolve block by ID
        var targetBlock = await _blockDiscovery.GetByIdAsync(toolId, ct);
        if (targetBlock == null)
        {
            result.Logs.Add($"Block not found: '{toolId}'");
            return $"Error: Tool '{toolId}' does not exist. " +
                   "Check available tools in your system prompt. " +
                   "To finish, use: {\"tool\":\"step-complete\",\"args\":{\"summary\":\"what was done\"}}";
        }

        // Get executor for block type
        var executor = _executorRegistry.Get(targetBlock.BlockType);
        if (executor == null)
        {
            result.Logs.Add($"No executor for block type '{targetBlock.BlockType}' (block: {toolId})");
            return $"Error: No executor available for block '{toolId}' (type: {targetBlock.BlockType}).";
        }

        // Build inputs from args — JSON properties become dictionary entries
        var inputs = new Dictionary<string, object>();
        if (args.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in args.EnumerateObject())
            {
                inputs[prop.Name] = DeserializeJsonElement(prop.Value);
            }
        }

        // Propagate working directory from parent context if not in args
        if (!inputs.ContainsKey("workingDir") && context.Variables.TryGetValue("workingDir", out var wd))
            inputs["workingDir"] = wd;

        result.Logs.Add($"Dispatching to block '{toolId}' (type: {targetBlock.BlockType}) with {inputs.Count} inputs");

        // Execute the block
        var blockResult = await executor.ExecuteAsync(targetBlock, context, inputs, ct);

        // Format output for the agent conversation
        if (blockResult.Success)
        {
            if (blockResult.Outputs.TryGetValue("result", out var r))
                return r?.ToString() ?? "Success";
            if (blockResult.Outputs.TryGetValue("content", out var c))
                return c?.ToString() ?? "Success";
            if (blockResult.Outputs.Count > 0)
            {
                try { return JsonSerializer.Serialize(blockResult.Outputs); }
                catch { return blockResult.Outputs.Values.First()?.ToString() ?? "Success"; }
            }
            return "Success";
        }
        else
        {
            var errorMsg = blockResult.Outputs.TryGetValue("error", out var err)
                ? err?.ToString() ?? "Unknown error"
                : blockResult.Logs.LastOrDefault() ?? "Block execution failed";
            return $"Error: {errorMsg}";
        }
    }

    /// <summary>
    /// Converts a JsonElement to a native .NET type for use in block inputs.
    /// </summary>
    private static object DeserializeJsonElement(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString() ?? "",
            JsonValueKind.Number => element.TryGetInt64(out var l) ? (object)l : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => "",
            // For objects and arrays, keep as JSON string — block executors expect string inputs
            JsonValueKind.Object => element.ToString(),
            JsonValueKind.Array => element.ToString(),
            _ => element.ToString()
        };
    }

    private ICliExecutor? GetCliExecutor()
    {
        if (_cliExecutor != null)
            return _cliExecutor;

        // Create a new scope to resolve ICliExecutor. This avoids ObjectDisposedException
        // when the original DI scope has been disposed (background Task.Run in session invoke).
        if (_scopeFactory != null)
        {
            var scope = _scopeFactory.CreateScope();
            _cliExecutor = scope.ServiceProvider.GetService<ICliExecutor>();
            // NOTE: We intentionally do NOT dispose the scope here, as the resolved
            // ICliExecutor will be used throughout the agent's agentic loop lifetime.
            return _cliExecutor;
        }

        // Fallback: try original provider (works when called within a live scope)
        if (_serviceProvider != null)
        {
            try { _cliExecutor = _serviceProvider.GetService<ICliExecutor>(); }
            catch (ObjectDisposedException) { /* scope disposed, _cliExecutor stays null */ }
        }
        return _cliExecutor;
    }

    /// <summary>
    /// Extracts context configuration from block config.
    /// </summary>
    private static ContextConfig GetContextConfig(Dictionary<string, object>? blockConfig)
    {
        var config = new ContextConfig();

        if (blockConfig == null)
            return config;

        if (blockConfig.TryGetValue("context", out var contextObj) && contextObj != null)
        {
            if (contextObj is JsonElement jsonElement && jsonElement.ValueKind == JsonValueKind.Object)
            {
                return new ContextConfig
                {
                    Strategy = jsonElement.TryGetProperty("strategy", out var s) ? s.GetString() ?? "sliding-window" : "sliding-window",
                    MaxTokens = jsonElement.TryGetProperty("maxTokens", out var mt) ? mt.GetInt32() : 4096,
                    ReserveForResponse = jsonElement.TryGetProperty("reserveForResponse", out var r) ? r.GetInt32() : 512,
                    KeepSystemPrompt = jsonElement.TryGetProperty("keepSystemPrompt", out var ksp) ? ksp.GetBoolean() : true,
                    KeepLastN = jsonElement.TryGetProperty("keepLastN", out var kln) ? kln.GetInt32() : 10,
                    ContextBlockRef = jsonElement.TryGetProperty("contextBlock", out var cb) ? cb.GetString() : null
                };
            }

            if (contextObj is Dictionary<string, object> contextDict)
            {
                return new ContextConfig
                {
                    Strategy = contextDict.TryGetValue("strategy", out var s) ? s?.ToString() ?? "sliding-window" : "sliding-window",
                    MaxTokens = contextDict.TryGetValue("maxTokens", out var mt) && int.TryParse(mt?.ToString(), out var mtVal) ? mtVal : 4096,
                    ReserveForResponse = contextDict.TryGetValue("reserveForResponse", out var r) && int.TryParse(r?.ToString(), out var rVal) ? rVal : 512,
                    KeepSystemPrompt = contextDict.TryGetValue("keepSystemPrompt", out var ksp) && bool.TryParse(ksp?.ToString(), out var kspVal) ? kspVal : true,
                    KeepLastN = contextDict.TryGetValue("keepLastN", out var kln) && int.TryParse(kln?.ToString(), out var klnVal) ? klnVal : 10,
                    ContextBlockRef = contextDict.TryGetValue("contextBlock", out var cb) ? cb?.ToString() : null
                };
            }
        }

        if (blockConfig.TryGetValue("contextBlock", out var contextBlockRef) && contextBlockRef != null)
        {
            config = new ContextConfig { ContextBlockRef = contextBlockRef.ToString() };
        }

        return config;
    }

    /// <summary>
    /// Normalizes tool IDs by mapping common LLM hallucinated names to actual block IDs.
    /// LLMs frequently use alternate names (bash, read-file, write-file) despite being told
    /// the correct names in the system prompt.
    /// </summary>
    private static string NormalizeToolId(string toolId)
    {
        return toolId switch
        {
            "bash" or "Bash" or "run" or "exec" or "execute" or "cmd" => "shell-execute",
            "read-file" or "readFile" or "Read" or "read" or "cat" => "file-read",
            "write-file" or "writeFile" or "Write" or "write" => "file-write",
            "list-directory" or "listDirectory" or "ls" or "list-dir" or "Glob" or "glob" or "find" => "directory-list",
            "edit-file" or "editFile" or "edit" or "Edit" => "file-edit",
            "Grep" or "grep" or "search" or "Search" => "directory-list", // best approximation
            _ => toolId
        };
    }

    /// <summary>
    /// Config resolved from a child node in config.nodes.
    /// Agent blocks are composite — their LLM parameters come from child inference nodes.
    /// </summary>
    private record struct ChildNodeConfig(string? ModelId, int MaxTokens, float Temperature, string? PlanningModel, int PlanningIterations);

    /// <summary>
    /// Reads config.nodes from the agent block definition and extracts LLM parameters
    /// from the first child node's config. Returns null if no config.nodes exists
    /// (legacy agent, deprecated — uses own config).
    /// </summary>
    private static ChildNodeConfig? ResolveChildNodeConfig(BlockDefinition block)
    {
        if (block.Config == null || !block.Config.TryGetValue("nodes", out var nodesObj))
            return null;

        // Parse nodes array — handles both JsonElement and JArray (Newtonsoft API path)
        JsonElement nodesElement;
        if (nodesObj is JsonElement je && je.ValueKind == JsonValueKind.Array)
        {
            nodesElement = je;
        }
        else if (nodesObj is Newtonsoft.Json.Linq.JArray jArr)
        {
            using var doc = JsonDocument.Parse(jArr.ToString());
            nodesElement = doc.RootElement.Clone();
        }
        else
        {
            // Try generic serialization
            try
            {
                var serialized = JsonSerializer.Serialize(nodesObj);
                using var doc = JsonDocument.Parse(serialized);
                if (doc.RootElement.ValueKind == JsonValueKind.Array)
                    nodesElement = doc.RootElement.Clone();
                else
                    return null;
            }
            catch
            {
                return null;
            }
        }

        // Find the first node with config (typically the inference/reasoning node)
        foreach (var node in nodesElement.EnumerateArray())
        {
            if (!node.TryGetProperty("config", out var nodeConfig) || nodeConfig.ValueKind != JsonValueKind.Object)
                continue;

            string? modelId = nodeConfig.TryGetProperty("model", out var m) ? m.GetString() : null;
            int maxTokens = nodeConfig.TryGetProperty("maxTokens", out var mt) && mt.TryGetInt32(out var mtVal) ? mtVal : 1024;
            float temperature = nodeConfig.TryGetProperty("temperature", out var t)
                ? t.GetSingle() : 0f;
            string? planningModel = nodeConfig.TryGetProperty("planningModel", out var pm) ? pm.GetString() : null;
            int planningIterations = nodeConfig.TryGetProperty("planningIterations", out var pi) && pi.TryGetInt32(out var piVal) ? piVal : 2;

            return new ChildNodeConfig(modelId, maxTokens, temperature, planningModel, planningIterations);
        }

        // Nodes exist but none have config — treat as no-config
        return null;
    }
}
