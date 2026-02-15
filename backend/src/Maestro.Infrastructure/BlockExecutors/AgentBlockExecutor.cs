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
    private readonly ContextProcessorFactory _contextProcessorFactory;
    private ICliExecutor? _cliExecutor;

    // Legacy tool mapping for backwards compatibility.
    // New agents should use maestro_cli directly via their system prompt.
    [Obsolete("Legacy tool mapping will be removed when all agent blocks use maestro_cli directly.")]
    private static readonly Dictionary<string, string> LegacyToolMapping = new()
    {
        { "list_files", "run directory-list --input path=" },
        { "directory-list", "run directory-list --input path=" },
        { "read_file", "run file-read --input path=" },
        { "file-read", "run file-read --input path=" },
        { "write_file", "run file-write" },
        { "file-write", "run file-write" },
        { "shell-execute", "run shell-execute --input command=" },
        { "git-status", "run git-status" },
        { "git-diff", "run git-diff" },
        { "code-search", "run code-search --input pattern=" },
        { "llm-generate", "run llm-generate" }
    };

    public AgentBlockExecutor(ILLMGateway llmGateway, IServiceProvider? serviceProvider = null, IExecutionMonitor? monitor = null)
        : base(llmGateway, monitor)
    {
        _serviceProvider = serviceProvider;
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
        var contextConfig = GetContextConfig(block.Config);
        var contextProcessor = _contextProcessorFactory.Create(contextConfig.Strategy);

        result.Logs.Add($"Using model: {modelId ?? "default"}, temperature: {temperature}, maxTokens: {maxTokens}");
        result.Logs.Add($"Context strategy: {contextConfig.Strategy}, maxTokens: {contextConfig.MaxTokens}");

        // 5. Agentic loop (mechanical: send → parse tool call → execute → feed back → repeat)
        var iteration = 0;
        LLMResponse? lastResponse = null;

        while (true)
        {
            iteration++;
            result.Logs.Add($"Agent iteration {iteration}/{maxIterations}");

            // Process context before sending to LLM
            var contextInput = new ContextInput
            {
                Messages = messages.Where(m => m.Role != "system").ToList(),
                SystemPrompt = systemPrompt,
                Config = contextConfig
            };
            var contextResult = await contextProcessor.ProcessAsync(contextInput, ct);

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
                response = await _llmGateway.SendAsync(request, ct);
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
                            var summary = args.ValueKind == JsonValueKind.Object && args.TryGetProperty("summary", out var sumProp)
                                ? sumProp.GetString() ?? "Task completed"
                                : "Task completed";
                            result.Outputs["result"] = summary;
                            result.Logs.Add($"Agent completed: {summary}");
                            break;
                        }

                        // Execute tool via CLI
                        var toolOutput = await ExecuteToolCall(toolId!, args, jsonContent, block, context, result, ct);

                        // Feed back into conversation
                        messages.Add(ChatMessage.Assistant(jsonContent));
                        messages.Add(ChatMessage.User($"Tool result for {toolId}:\n{toolOutput}"));
                        toolCalled = true;
                    }
                }
            }
            catch (Exception ex)
            {
                result.Logs.Add($"LLM parse error (tool detection): {ex.Message}");
            }

            if (!toolCalled || iteration >= maxIterations) break;
        }

        // 6. Parse structured outputs from last response
        if (lastResponse != null && !string.IsNullOrWhiteSpace(lastResponse.Content))
        {
            ParseOutputs(result, lastResponse.Content, block);
            result.Logs.Add("Agent LLM response received");
        }
        else if (!result.Outputs.ContainsKey("result") && !result.Outputs.ContainsKey("content"))
        {
            result.Success = false;
            result.Outputs["error"] = "Agent completed without producing output";
            result.Logs.Add("Warning: Agent completed but no valid output was produced");
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
            if (block.Config.TryGetValue("maxIterations", out var mi) && mi is int mii)
                maxIterations = mii;
            else if (block.Config.TryGetValue("maxSteps", out var ms))
            {
                if (ms is int msi) maxIterations = msi;
                else if (int.TryParse(ms?.ToString(), out var parsed)) maxIterations = parsed;
            }
        }
        return maxIterations;
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
        // Handle legacy tool calls for backwards compatibility
#pragma warning disable CS0618 // Obsolete warning for LegacyToolMapping
        else if (LegacyToolMapping.ContainsKey(toolId))
        {
            command = ConvertLegacyToolToCommand(toolId, args);
            result.Logs.Add($"Legacy tool {toolId} converted to: {command}");
        }
#pragma warning restore CS0618

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
        if (_cliExecutor == null && _serviceProvider != null)
            _cliExecutor = _serviceProvider.GetService<ICliExecutor>();
        return _cliExecutor;
    }

    /// <summary>
    /// Converts legacy tool calls to maestro CLI commands for backwards compatibility.
    /// </summary>
    [Obsolete("Legacy tool mapping will be removed when all agent blocks use maestro_cli directly.")]
    private static string? ConvertLegacyToolToCommand(string toolId, JsonElement args)
    {
        if (!LegacyToolMapping.TryGetValue(toolId, out var baseCommand))
            return null;

        var sb = new System.Text.StringBuilder(baseCommand);

        if (args.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in args.EnumerateObject())
            {
                var value = prop.Value.ToString().Trim('"');
                if (toolId.Contains("file") && prop.Name == "content")
                {
                    sb.Append($" --input content=\"{EscapeForCli(value)}\"");
                }
                else if (!baseCommand.Contains($"--input {prop.Name}="))
                {
                    if (baseCommand.EndsWith("="))
                        sb.Append(EscapeForCli(value));
                    else
                        sb.Append($" --input {prop.Name}=\"{EscapeForCli(value)}\"");
                }
            }
        }

        return sb.ToString();
    }

    private static string EscapeForCli(string value)
    {
        return value.Replace("\\", "\\\\").Replace("\"", "\\\"");
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
