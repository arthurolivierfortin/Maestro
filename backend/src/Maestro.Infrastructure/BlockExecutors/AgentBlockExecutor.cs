using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Context;
using Microsoft.Extensions.DependencyInjection;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

public class AgentBlockExecutor : IBlockExecutor
{
    private readonly ILLMGateway _llmGateway;
    private readonly IServiceProvider? _serviceProvider;
    private readonly ContextProcessorFactory _contextProcessorFactory;
    private ICliExecutor? _cliExecutor;

    // Legacy tool mapping for backwards compatibility
    // New agents should use maestro_cli directly
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

    public AgentBlockExecutor(ILLMGateway llmGateway, IServiceProvider? serviceProvider = null)
    {
        _llmGateway = llmGateway;
        _serviceProvider = serviceProvider;
        _contextProcessorFactory = new ContextProcessorFactory(serviceProvider);
    }

    private ICliExecutor? GetCliExecutor()
    {
        if (_cliExecutor == null && _serviceProvider != null)
        {
            _cliExecutor = _serviceProvider.GetService<ICliExecutor>();
        }
        return _cliExecutor;
    }

    /// <summary>
    /// Converts legacy tool calls to maestro CLI commands for backwards compatibility.
    /// </summary>
    private string? ConvertLegacyToolToCommand(string toolId, JsonElement args)
    {
        if (!LegacyToolMapping.TryGetValue(toolId, out var baseCommand))
            return null;

        var sb = new System.Text.StringBuilder(baseCommand);

        if (args.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in args.EnumerateObject())
            {
                var value = prop.Value.ToString().Trim('"');
                // Handle common mappings
                if (toolId.Contains("file") && prop.Name == "content")
                {
                    sb.Append($" --input content=\"{EscapeForCli(value)}\"");
                }
                else if (!baseCommand.Contains($"--input {prop.Name}="))
                {
                    if (baseCommand.EndsWith("="))
                    {
                        sb.Append(EscapeForCli(value));
                    }
                    else
                    {
                        sb.Append($" --input {prop.Name}=\"{EscapeForCli(value)}\"");
                    }
                }
            }
        }

        return sb.ToString();
    }

    private static string EscapeForCli(string value)
    {
        return value.Replace("\\", "\\\\").Replace("\"", "\\\"");
    }

    public string SupportedType => "agent";

    public async Task<BlockExecutionResult> ExecuteAsync(BlockDefinition block, ExecutionContext context, Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var result = new BlockExecutionResult();

        string? path = null;
        if (block.Config != null && block.Config.TryGetValue("path", out var p) && p is string pstr) path = pstr;

        // Mock mode: if mock-response.json exists, load it
        if (path != null)
        {
            var mock = Path.Combine(path, "mock-response.json");
            if (File.Exists(mock))
            {
                var text = await File.ReadAllTextAsync(mock, ct);
                try
                {
                    using var doc = JsonDocument.Parse(text);
                    if (doc.RootElement.TryGetProperty("outputs", out var outs))
                    {
                        foreach (var prop in outs.EnumerateObject())
                        {
                            result.Outputs[prop.Name] = prop.Value.GetString() ?? prop.Value.ToString();
                        }
                        result.Logs.Add("Mock agent response loaded");
                        result.DurationMs = sw.ElapsedMilliseconds;
                        return result;
                    }
                }
                catch { /* fallthrough */ }
            }
        }

        // Load system prompt from file if present
        var systemPrompt = string.Empty;
        if (path != null)
        {
            var sp = Path.Combine(path, "system-prompt.md");
            if (File.Exists(sp)) systemPrompt = await File.ReadAllTextAsync(sp, ct);

            // Load tools.json if present (for agent tool definitions). Not fully executed here,
            // but makes tools available for future tool-call handling.
            var toolsFile = Path.Combine(path, "tools.json");
            if (File.Exists(toolsFile))
            {
                try
                {
                    await File.ReadAllTextAsync(toolsFile, ct); // loaded for future use; content not required now
                    // keep as log for now
                    result.Logs.Add("tools.json loaded");
                }
                catch (Exception ex)
                {
                    // best-effort: failure to read tools.json is non-fatal for agent scaffold
                    result.Logs.Add($"Failed to load tools.json: {ex.Message}");
                }
            }
        }

        // Get system prompt from config if not loaded from file
        if (string.IsNullOrEmpty(systemPrompt) && block.Config != null && block.Config.TryGetValue("systemPrompt", out var sysPromptConfig) && sysPromptConfig != null)
        {
            systemPrompt = sysPromptConfig.ToString() ?? string.Empty;
        }

        // Get model from config
        string? modelId = null;
        if (block.Config != null && block.Config.TryGetValue("model", out var modelConfig) && modelConfig != null)
        {
            modelId = modelConfig.ToString();
        }

        // Get generation parameters from config
        int maxTokens = 1024;  // Increased default for proper JSON tool call responses
        float temperature = 0.0f;
        if (block.Config != null)
        {
            if (block.Config.TryGetValue("maxTokens", out var mtConfig) && mtConfig != null)
            {
                int.TryParse(mtConfig.ToString(), out maxTokens);
            }
            if (block.Config.TryGetValue("temperature", out var tempConfig) && tempConfig != null)
            {
                float.TryParse(tempConfig.ToString(), System.Globalization.CultureInfo.InvariantCulture, out temperature);
            }
        }

        // Get available tools from config
        var availableTools = new List<string> { "file-read", "file-write", "shell-execute", "git-status", "git-diff" };
        if (block.Config != null && block.Config.TryGetValue("tools", out var toolsConfig) && toolsConfig != null)
        {
            try
            {
                if (toolsConfig is System.Text.Json.JsonElement jsonElement && jsonElement.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    availableTools = jsonElement.EnumerateArray().Select(e => e.GetString() ?? "").Where(s => !string.IsNullOrEmpty(s)).ToList();
                }
            }
            catch { /* keep defaults */ }
        }

        // Build user prompt from inputs (task/subtask, workingDir, context)
        // Support both "task" and "subtask" input names for flexibility
        var taskDescription = string.Empty;
        if (inputs.TryGetValue("task", out var taskObj) && taskObj != null)
        {
            taskDescription = taskObj.ToString() ?? string.Empty;
        }
        else if (inputs.TryGetValue("subtask", out var subtaskObj) && subtaskObj != null)
        {
            // Handle subtask as object or string
            if (subtaskObj is System.Text.Json.JsonElement jsonEl)
            {
                if (jsonEl.TryGetProperty("description", out var descProp))
                    taskDescription = descProp.GetString() ?? jsonEl.ToString();
                else
                    taskDescription = jsonEl.ToString();
            }
            else
            {
                taskDescription = subtaskObj.ToString() ?? string.Empty;
            }
        }
        var workingDir = inputs.TryGetValue("workingDir", out var wdObj) ? wdObj?.ToString() ?? string.Empty : string.Empty;
        var additionalContext = inputs.TryGetValue("context", out var ctxObj) ? ctxObj?.ToString() ?? string.Empty : string.Empty;

        // Fallback to "user" config if no task input
        var userPromptText = string.IsNullOrEmpty(taskDescription) && block.Config != null && block.Config.TryGetValue("user", out var u)
            ? u?.ToString() ?? string.Empty
            : string.Empty;

        // Build the user message content
        var userContentBuilder = new System.Text.StringBuilder();

        if (!string.IsNullOrEmpty(taskDescription))
        {
            userContentBuilder.AppendLine("## Task");
            userContentBuilder.AppendLine(taskDescription);
            userContentBuilder.AppendLine();
        }

        if (!string.IsNullOrEmpty(workingDir))
        {
            userContentBuilder.AppendLine("## Working Directory");
            userContentBuilder.AppendLine(workingDir);
            userContentBuilder.AppendLine();
        }

        if (!string.IsNullOrEmpty(additionalContext))
        {
            userContentBuilder.AppendLine("## Additional Context");
            userContentBuilder.AppendLine(additionalContext);
            userContentBuilder.AppendLine();
        }

        if (!string.IsNullOrEmpty(userPromptText))
        {
            userContentBuilder.AppendLine(userPromptText);
        }

        // Build conversation messages for ChatML format
        var messages = new List<ChatMessage>();

        // System message with tool instructions
        var systemContent = systemPrompt;
        if (string.IsNullOrEmpty(systemContent))
        {
            // Default system prompt uses maestro_cli as the single tool
            systemContent = $@"You are a JSON-only assistant with access to Maestro CLI. You MUST output exactly one JSON object, nothing else.

You have ONE tool: maestro_cli. Use it to interact with the system.

Available commands via maestro_cli:
- List files: {{""tool"":""maestro_cli"",""args"":{{""command"":""run directory-list --input path=<path>""}}}}
- Read file: {{""tool"":""maestro_cli"",""args"":{{""command"":""run file-read --input path=<path>""}}}}
- Write file: {{""tool"":""maestro_cli"",""args"":{{""command"":""run file-write --input path=<path> --input content=<content>""}}}}
- List blocks: {{""tool"":""maestro_cli"",""args"":{{""command"":""list-blocks""}}}}
- List tools: {{""tool"":""maestro_cli"",""args"":{{""command"":""list-tools""}}}}
- Run any block: {{""tool"":""maestro_cli"",""args"":{{""command"":""run <block-id> --input <key>=<value>""}}}}
- Get help: {{""tool"":""maestro_cli"",""args"":{{""command"":""help [command]""}}}}
- Done: {{""tool"":""done"",""args"":{{""summary"":""...""}}}}

Legacy tools (list_files, read_file, write_file) are also supported for backwards compatibility.

Respond with ONLY the JSON object. No explanations. No markdown. Just JSON.";
        }
        messages.Add(ChatMessage.System(systemContent));

        // User message with task
        var userContent = userContentBuilder.ToString().Trim();
        if (string.IsNullOrEmpty(userContent))
        {
            userContent = "Start by listing files.";
        }
        messages.Add(ChatMessage.User(userContent));

        result.Logs.Add($"Using model: {modelId ?? "default"}, temperature: {temperature}, maxTokens: {maxTokens}");

        // Get context configuration
        var contextConfig = GetContextConfig(block.Config);
        var contextProcessor = _contextProcessorFactory.Create(contextConfig.Strategy);
        result.Logs.Add($"Context strategy: {contextConfig.Strategy}, maxTokens: {contextConfig.MaxTokens}");

        var maxIterations = 5;
        if (block.Config != null && block.Config.TryGetValue("maxIterations", out var mi) && mi is int mii) maxIterations = mii;
        if (block.Config != null && block.Config.TryGetValue("maxSteps", out var ms))
        {
            if (ms is int msi) maxIterations = msi;
            else if (int.TryParse(ms?.ToString(), out var parsed)) maxIterations = parsed;
        }

        var iteration = 0;
        LLMResponse response = null!;
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
            {
                result.Logs.Add($"Context truncated: {contextResult.MessagesRemoved} messages removed, ~{contextResult.EstimatedTokens} tokens");
            }

            // Create request with optimized messages
            var request = new LLMRequest
            {
                Messages = contextResult.Messages,
                ModelId = modelId,
                MaxNewTokens = maxTokens,
                Temperature = temperature
            };

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
                result.Logs.Add("LLM returned empty response. This may indicate LLM-Provider is not running or returned an error.");

                // If this is the first iteration, mark as failure
                if (iteration == 1)
                {
                    result.Success = false;
                    result.Outputs["error"] = "LLM returned empty response. Check if LLM-Provider service is running and accessible.";
                    result.DurationMs = sw.ElapsedMilliseconds;
                    return result;
                }

                // On subsequent iterations, use the last valid response
                break;
            }

            result.Logs.Add($"LLM response: {(response.Content.Length > 100 ? response.Content.Substring(0, 100) + "..." : response.Content)}");

            // If the LLM indicates a tool call, execute it and feed result back
            var toolCalled = false;
            try
            {
                // Try to extract JSON from response (may be wrapped in markdown or have extra text)
                var jsonContent = ExtractJson(response.Content);
                if (!string.IsNullOrEmpty(jsonContent))
                {
                    using var doc = JsonDocument.Parse(jsonContent);
                    if (doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty("tool", out var toolProp))
                    {
                        var toolId = toolProp.GetString();
                        var args = doc.RootElement.TryGetProperty("args", out var argsProp) ? argsProp : default;

                        result.Logs.Add($"Tool call detected: {toolId}");

                        // Check for "done" tool - agent finished
                        if (toolId == "done")
                        {
                            var summary = args.ValueKind == JsonValueKind.Object && args.TryGetProperty("summary", out var sumProp)
                                ? sumProp.GetString() ?? "Task completed"
                                : "Task completed";
                            result.Outputs["result"] = summary;
                            result.Logs.Add($"Agent completed: {summary}");
                            break;
                        }

                        var cliExecutor = GetCliExecutor();
                        if (!string.IsNullOrEmpty(toolId))
                        {
                            string? command = null;

                            // Handle maestro_cli tool (the recommended approach)
                            if (toolId == "maestro_cli" || toolId == "maestro-cli")
                            {
                                if (args.ValueKind == JsonValueKind.Object && args.TryGetProperty("command", out var cmdProp))
                                {
                                    command = cmdProp.GetString();
                                }
                                result.Logs.Add($"maestro_cli tool call: {command}");
                            }
                            // Handle legacy tool calls for backwards compatibility
                            else if (LegacyToolMapping.ContainsKey(toolId))
                            {
                                command = ConvertLegacyToolToCommand(toolId, args);
                                result.Logs.Add($"Legacy tool {toolId} converted to: {command}");
                            }

                            if (!string.IsNullOrEmpty(command))
                            {
                                // Build CLI execution context from execution context variables
                                var cliContext = new CliExecutionContext
                                {
                                    WorkspaceId = context.Variables.TryGetValue("workspaceId", out var wsId) ? wsId?.ToString() : null,
                                    SessionId = context.Variables.TryGetValue("sessionId", out var sessId) ? sessId?.ToString() : null,
                                    AgentId = context.Variables.TryGetValue("agentId", out var agentId) ? agentId?.ToString() : block.Id
                                };

                                string toolOutput;
                                if (cliExecutor != null)
                                {
                                    // Execute through CLI executor (with permission enforcement)
                                    var cliResult = await cliExecutor.ExecuteAsync(command, cliContext, ct);

                                    if (cliResult.Success)
                                    {
                                        toolOutput = cliResult.Output?.ToString() ?? "Success";
                                    }
                                    else
                                    {
                                        toolOutput = $"Error: {cliResult.Error}";
                                    }
                                }
                                else
                                {
                                    // Fallback when CLI executor not available (shouldn't happen in production)
                                    result.Logs.Add("Warning: CLI executor not available, tool execution skipped");
                                    toolOutput = "Error: CLI executor not available. Ensure services are properly configured.";
                                }

                                result.Logs.Add($"Tool result: {(toolOutput.Length > 100 ? toolOutput.Substring(0, 100) + "..." : toolOutput)}");

                                // Add assistant message (tool call) and user message (tool result)
                                messages.Add(ChatMessage.Assistant(jsonContent));
                                messages.Add(ChatMessage.User($"Tool result for {toolId}:\n{toolOutput}"));

                                toolCalled = true;
                            }
                            else
                            {
                                result.Logs.Add($"Unknown tool: {toolId}. Use maestro_cli with a command argument.");
                                messages.Add(ChatMessage.Assistant(jsonContent));
                                messages.Add(ChatMessage.User($"Error: Unknown tool '{toolId}'. Use maestro_cli with a command argument. Example: {{\"tool\":\"maestro_cli\",\"args\":{{\"command\":\"help\"}}}}"));
                                toolCalled = true;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                // ignore parse errors from LLM response; treat as non-tool response
                result.Logs.Add($"LLM parse error (tool detection): {ex.Message}");
            }

            if (!toolCalled || iteration >= maxIterations) break;
        }

        // Try to parse structured outputs if defined
        if (response != null && !string.IsNullOrWhiteSpace(response.Content))
        {
            if (block.Config != null && block.Config.TryGetValue("outputKey", out var ok) && ok is string outKey && !string.IsNullOrEmpty(outKey))
            {
                try
                {
                    using var doc = JsonDocument.Parse(response.Content);
                    if (doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty(outKey, out var prop))
                    {
                        result.Outputs[outKey] = prop.GetString() ?? prop.ToString();
                    }
                    else
                    {
                        result.Outputs["content"] = response.Content;
                    }
                }
                catch
                {
                    result.Outputs["content"] = response.Content;
                }
            }
            else
            {
                result.Outputs["content"] = response.Content;
            }
            result.Logs.Add("Agent LLM response received");
        }
        else
        {
            // If we get here with no response, it means the loop exited without getting a valid response
            if (!result.Outputs.ContainsKey("result") && !result.Outputs.ContainsKey("content"))
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
    /// Extracts JSON from a response that may contain markdown code blocks or extra text.
    /// </summary>
    private static string? ExtractJson(string content)
    {
        if (string.IsNullOrWhiteSpace(content)) return null;

        content = content.Trim();

        // If it starts with {, assume it's already JSON
        if (content.StartsWith("{"))
        {
            // Find the matching closing brace
            var depth = 0;
            for (var i = 0; i < content.Length; i++)
            {
                if (content[i] == '{') depth++;
                else if (content[i] == '}') depth--;
                if (depth == 0) return content.Substring(0, i + 1);
            }
            return content;
        }

        // Try to extract from markdown code block
        var jsonMatch = Regex.Match(content, @"```(?:json)?\s*(\{.*?\})\s*```", RegexOptions.Singleline);
        if (jsonMatch.Success)
        {
            return jsonMatch.Groups[1].Value;
        }

        // Try to find a JSON object anywhere in the text
        var braceMatch = Regex.Match(content, @"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", RegexOptions.Singleline);
        if (braceMatch.Success)
        {
            return braceMatch.Value;
        }

        return null;
    }

    /// <summary>
    /// Extracts context configuration from block config.
    /// Supports both inline config and block reference.
    /// </summary>
    private ContextConfig GetContextConfig(Dictionary<string, object>? blockConfig)
    {
        var config = new ContextConfig();

        if (blockConfig == null)
            return config;

        // Check for inline context config
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

        // Check for context block reference directly in config
        if (blockConfig.TryGetValue("contextBlock", out var contextBlockRef) && contextBlockRef != null)
        {
            config = new ContextConfig
            {
                ContextBlockRef = contextBlockRef.ToString()
            };
        }

        return config;
    }
}
