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
/// Executor for agent blocks: systemPrompt → multi-turn agentic loop → tool calls via CLI → response.
/// All content (system prompt, tool descriptions) comes from block config/files.
/// The executor is pure mechanical plumbing — it never defines what tools are available.
/// </summary>
public class AgentBlockExecutor : LLMBlockExecutorBase
{
    private readonly IServiceProvider? _serviceProvider;
    private readonly IServiceScopeFactory? _scopeFactory;
    private readonly ContextProcessorFactory _contextProcessorFactory;
    private ICliExecutor? _cliExecutor;

    public AgentBlockExecutor(ILLMGateway llmGateway, IServiceProvider? serviceProvider = null, IExecutionMonitor? monitor = null)
        : base(llmGateway, monitor)
    {
        _serviceProvider = serviceProvider;
        // Use IServiceScopeFactory to create per-execution scopes for CLI tool calls.
        // This avoids ObjectDisposedException when the original DI scope is disposed
        // before background Task.Run completes (session invoke path).
        _scopeFactory = serviceProvider?.GetService<IServiceScopeFactory>();
        _contextProcessorFactory = new ContextProcessorFactory(serviceProvider);
    }

    public override string SupportedType => "agent";

    public override async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        var result = new BlockExecutionResult();

        // 1. Mock check
        var mockResult = await TryLoadMockResponse(block, sw, ct);
        if (mockResult != null) return mockResult;

        // 2. Load systemPrompt — MUST exist in config or file. No hardcoded default.
        var systemPrompt = await LoadSystemPrompt(block, ct);
        if (string.IsNullOrEmpty(systemPrompt))
        {
            return ErrorResult(
                "Agent block requires a system prompt. Provide config.systemPrompt or system-prompt.md in the block directory.",
                sw.ElapsedMilliseconds);
        }

        // 3. Build conversation messages
        var messages = new List<ChatMessage>();
        messages.Add(ChatMessage.System(systemPrompt));

        var userContent = BuildUserMessage(inputs, block);
        messages.Add(ChatMessage.User(userContent));

        // 4. Resolve params
        var modelId = ResolveModelId(block, inputs);
        var (maxTokens, temperature) = ResolveGenerationParams(block);
        var maxIterations = ResolveMaxIterations(block);
        var wallClockTimeoutSeconds = ResolveWallClockTimeout(block);
        var contextConfig = GetContextConfig(block.Config);
        var contextProcessor = _contextProcessorFactory.Create(contextConfig.Strategy);

        result.Logs.Add($"Using model: {modelId ?? "default"}, temperature: {temperature}, maxTokens: {maxTokens}");
        result.Logs.Add($"Context strategy: {contextConfig.Strategy}, maxTokens: {contextConfig.MaxTokens}");
        result.Logs.Add($"Wall-clock timeout: {wallClockTimeoutSeconds}s, max iterations: {maxIterations}");

        // INFRA-2: Wall-clock timeout via linked CancellationTokenSource
        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(wallClockTimeoutSeconds));
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);
        var agentCt = linkedCts.Token;

        // INFRA-3: Loop detection — track recent tool calls to detect repetition
        var recentToolCalls = new List<string>(); // last N tool call signatures
        const int loopDetectionWindow = 3;

        // 5. Agentic loop (mechanical: send → parse tool call → execute → feed back → repeat)
        var iteration = 0;
        var actualToolCallCount = 0; // A-2 done guard: track real tool executions
        var nonJsonRetryCount = 0;   // A-2 non-JSON retry counter
        LLMResponse? lastResponse = null;

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

            // Process context before sending to LLM
            var contextInput = new ContextInput
            {
                Messages = messages.Where(m => m.Role != "system").ToList(),
                SystemPrompt = systemPrompt,
                Config = contextConfig
            };
            var contextResult = await contextProcessor.ProcessAsync(contextInput, agentCt);

            if (contextResult.WasTruncated)
                result.Logs.Add($"Context truncated: {contextResult.MessagesRemoved} messages removed, ~{contextResult.EstimatedTokens} tokens");

            // Send to LLM
            var request = new LLMRequest
            {
                Messages = contextResult.Messages,
                ModelId = modelId,
                MaxNewTokens = maxTokens,
                Temperature = temperature
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
                result.Logs.Add($"LLM request failed: {ex.Message}");
                result.Success = false;
                result.Outputs["error"] = $"LLM request failed: {ex.Message}";
                result.DurationMs = sw.ElapsedMilliseconds;
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
                    result.DurationMs = sw.ElapsedMilliseconds;
                    return result;
                }
                break; // On subsequent iterations, use last valid response
            }

            lastResponse = response;
            result.Logs.Add($"LLM response: {(response.Content.Length > 100 ? response.Content.Substring(0, 100) + "..." : response.Content)}");

            // Parse tool call from response
            var toolCalled = false;
            try
            {
                var jsonContent = ExtractJson(response.Content);
                if (!string.IsNullOrEmpty(jsonContent))
                {
                    using var doc = JsonDocument.Parse(jsonContent);
                    if (doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty("tool", out var toolProp))
                    {
                        var toolId = toolProp.GetString();
                        var args = doc.RootElement.TryGetProperty("args", out var argsProp) ? argsProp : default;

                        result.Logs.Add($"Tool call detected: {toolId}");

                        // Check for "done" tool — agent finished
                        if (toolId == "done")
                        {
                            // Multi-tool response detection: if the LLM produced both a maestro_cli
                            // tool call AND a done call in the same response, ExtractJson may have
                            // skipped the tool call (due to complex nested escaping in file content)
                            // and returned the "done" JSON instead. Detect this and ask for retry.
                            var rawContent = response.Content;
                            var donePos = rawContent.IndexOf("\"done\"");
                            var maestroPos = rawContent.IndexOf("maestro_cli");
                            if (maestroPos >= 0 && donePos >= 0 && maestroPos < donePos)
                            {
                                result.Logs.Add("Multi-tool response detected: maestro_cli found before done. Asking for single tool call.");
                                // CRITICAL: Do NOT add the full response to history.
                                // If the LLM sees its own "done" in history, it will not retry the write.
                                // Instead, add a synthetic assistant message acknowledging the attempt,
                                // then a clear user message demanding the write.
                                messages.Add(ChatMessage.Assistant("{\"acknowledged\":\"multi-tool-rejected\"}"));
                                messages.Add(ChatMessage.User(
                                    "SYSTEM ERROR: Your response contained multiple tool calls. It was NOT executed. " +
                                    "The file was NOT written to disk. Nothing happened. " +
                                    "You MUST re-send the file-write (or shell command) as your ONLY response — just the JSON object, nothing else. " +
                                    "Do NOT call done. Do NOT include any other tool call. ONLY the maestro_cli file-write."));
                                toolCalled = true;
                                nonJsonRetryCount = 0;
                                continue;
                            }

                            // A-2 done guard: reject premature "done" if zero real tool calls were made
                            if (actualToolCallCount == 0 && iteration < maxIterations - 1)
                            {
                                result.Logs.Add("Agent claimed 'done' with 0 tool calls. Forcing real work.");
                                messages.Add(ChatMessage.Assistant(jsonContent));
                                messages.Add(ChatMessage.User(
                                    "You have not made any tool calls yet. " +
                                    "You must use tools to complete the task. " +
                                    "Start by reading a file or listing the directory."));
                                toolCalled = true;
                                continue;
                            }

                            var summary = args.ValueKind == JsonValueKind.Object && args.TryGetProperty("summary", out var sumProp)
                                ? sumProp.GetString() ?? "Task completed"
                                : "Task completed";
                            result.Outputs["result"] = summary;
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

                        // Feed back into conversation
                        messages.Add(ChatMessage.Assistant(jsonContent));
                        messages.Add(ChatMessage.User($"Tool result for {toolId}:\n{toolOutput}"));
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
                    messages.Add(ChatMessage.Assistant(response.Content));
                    messages.Add(ChatMessage.User(
                        "Your response caused a parsing error. " +
                        "Respond with ONLY a valid JSON object. No text before or after."));
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
                    messages.Add(ChatMessage.Assistant(response.Content));
                    messages.Add(ChatMessage.User(
                        "Your response was not a valid JSON tool call. " +
                        "Respond with ONLY a JSON object. Example:\n" +
                        "{\"tool\":\"maestro_cli\",\"args\":{\"command\":\"run directory-list --input path=/some/path\"}}"));
                    continue;
                }
                break;
            }
            if (iteration >= maxIterations) break;
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
                ParseOutputs(result, lastResponse.Content, block);
                result.Logs.Add("Agent LLM response received (fallback output)");
            }
            else
            {
                result.Success = false;
                result.Outputs["error"] = "Agent completed without producing output";
                result.Logs.Add("Warning: Agent completed but no valid output was produced");
            }
        }

        result.DurationMs = sw.ElapsedMilliseconds;
        return result;
    }

    /// <summary>
    /// Loads system prompt from file (system-prompt.md) or config (config.systemPrompt).
    /// Returns empty string if neither exists — caller must treat this as an error.
    /// </summary>
    private async Task<string> LoadSystemPrompt(BlockDefinition block, CancellationToken ct)
    {
        var path = GetBlockPath(block);
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
    /// Executes a tool call via the CLI executor. Handles maestro_cli and legacy tool mappings.
    /// </summary>
    private async Task<string> ExecuteToolCall(
        string toolId, JsonElement args, string jsonContent,
        BlockDefinition block, ExecutionContext context,
        BlockExecutionResult result, CancellationToken ct)
    {
        string? command = null;

        // Handle maestro_cli tool (the recommended approach)
        if (toolId == "maestro_cli" || toolId == "maestro-cli")
        {
            if (args.ValueKind == JsonValueKind.Object && args.TryGetProperty("command", out var cmdProp))
                command = cmdProp.GetString();
            result.Logs.Add($"maestro_cli tool call: {command}");
        }
        if (string.IsNullOrEmpty(command))
        {
            result.Logs.Add($"Unknown tool: {toolId}. Use maestro_cli with a command argument.");
            return $"Error: Unknown tool '{toolId}'. Use maestro_cli with a command argument. Example: {{\"tool\":\"maestro_cli\",\"args\":{{\"command\":\"help\"}}}}";
        }

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

        result.Logs.Add($"Tool result: {(toolOutput.Length > 100 ? toolOutput.Substring(0, 100) + "..." : toolOutput)}");
        return toolOutput;
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
}
