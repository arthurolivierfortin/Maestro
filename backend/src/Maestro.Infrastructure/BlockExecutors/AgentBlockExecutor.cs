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
using Microsoft.Extensions.DependencyInjection;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

public class AgentBlockExecutor : IBlockExecutor
{
    private readonly ILLMGateway _llmGateway;
    private readonly IServiceProvider? _serviceProvider;
    private BlockExecutorRegistry? _registry;
    private IBlockDiscoveryService? _discoveryService;

    // Mapping from agent tool names to system block IDs
    private static readonly Dictionary<string, string> ToolMapping = new()
    {
        { "list_files", "directory-list" },
        { "directory-list", "directory-list" },
        { "read_file", "file-read" },
        { "file-read", "file-read" },
        { "write_file", "file-write" },
        { "file-write", "file-write" },
        { "shell-execute", "shell-execute" },
        { "git-status", "git-status" },
        { "git-diff", "git-diff" },
        { "code-search", "code-search" },
        { "llm-generate", "llm-generate" }
    };

    public AgentBlockExecutor(ILLMGateway llmGateway, IServiceProvider? serviceProvider = null)
    {
        _llmGateway = llmGateway;
        _serviceProvider = serviceProvider;
    }

    private BlockExecutorRegistry? GetRegistry()
    {
        if (_registry == null && _serviceProvider != null)
        {
            _registry = _serviceProvider.GetService<BlockExecutorRegistry>();
        }
        return _registry;
    }

    private IBlockDiscoveryService? GetDiscoveryService()
    {
        if (_discoveryService == null && _serviceProvider != null)
        {
            _discoveryService = _serviceProvider.GetService<IBlockDiscoveryService>();
        }
        return _discoveryService;
    }

    private string MapToolId(string toolId)
    {
        return ToolMapping.TryGetValue(toolId, out var mapped) ? mapped : toolId;
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
        int maxTokens = 256;
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

        // Build user prompt from inputs (task, workingDir, context)
        var taskDescription = inputs.TryGetValue("task", out var taskObj) ? taskObj?.ToString() ?? string.Empty : string.Empty;
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
            systemContent = $@"You are a JSON-only assistant. You MUST output exactly one JSON object, nothing else.

Available functions:
- list_files: {{""tool"":""list_files"",""args"":{{""path"":""...""}}}}
- read_file: {{""tool"":""read_file"",""args"":{{""path"":""...""}}}}
- write_file: {{""tool"":""write_file"",""args"":{{""path"":""..."",""content"":""...""}}}}
- done: {{""tool"":""done"",""args"":{{""summary"":""...""}}}}

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

            // Create request with messages for proper ChatML formatting
            var request = new LLMRequest
            {
                Messages = messages,
                ModelId = modelId,
                MaxNewTokens = maxTokens,
                Temperature = temperature
            };
            response = await _llmGateway.SendAsync(request, ct);

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

                        var registry = GetRegistry();
                        var discoveryService = GetDiscoveryService();
                        if (!string.IsNullOrEmpty(toolId) && registry != null)
                        {
                            // Map tool name to system block ID
                            var mappedToolId = MapToolId(toolId);
                            result.Logs.Add($"Mapping tool {toolId} -> {mappedToolId}");

                            // Execute the tool - extract args
                            var inputsForTool = new Dictionary<string, object>();
                            if (args.ValueKind == JsonValueKind.Object)
                            {
                                foreach (var prop in args.EnumerateObject())
                                    inputsForTool[prop.Name] = prop.Value.ToString().Trim('"');
                            }

                            // Validate required inputs for common tools
                            var requiredInputs = mappedToolId switch
                            {
                                "directory-list" => new[] { "path" },
                                "file-read" => new[] { "path" },
                                "file-write" => new[] { "path", "content" },
                                _ => Array.Empty<string>()
                            };

                            var missingInputs = requiredInputs.Where(r => !inputsForTool.ContainsKey(r) || string.IsNullOrEmpty(inputsForTool[r]?.ToString())).ToList();
                            if (missingInputs.Count > 0)
                            {
                                result.Logs.Add($"Tool {toolId} missing required inputs: {string.Join(", ", missingInputs)}");
                                messages.Add(ChatMessage.Assistant(jsonContent));
                                messages.Add(ChatMessage.User($"Error: Tool {toolId} requires these arguments: {string.Join(", ", requiredInputs)}. Please provide them in the args object."));
                                toolCalled = true;
                                continue;
                            }

                            var toolExec = registry.Get("tool");
                            if (toolExec != null)
                            {
                                // Try to load the tool block from discovery service
                                BlockDefinition? toolBlock = null;
                                if (discoveryService != null)
                                {
                                    toolBlock = await discoveryService.GetByIdAsync(mappedToolId, ct);
                                }

                                // Fallback to minimal block if not found
                                if (toolBlock == null)
                                {
                                    result.Logs.Add($"Tool block {mappedToolId} not found, using minimal block");
                                    toolBlock = Maestro.Domain.Entities.BlockDefinition.Create(mappedToolId, mappedToolId, "tool");
                                }
                                else
                                {
                                    result.Logs.Add($"Loaded tool block {mappedToolId} from discovery service");
                                }

                                var toolRes = await toolExec.ExecuteAsync(toolBlock, context, inputsForTool, ct);

                                // Get tool result
                                var toolOutput = toolRes.Outputs.ContainsKey("stdout")
                                    ? toolRes.Outputs["stdout"]?.ToString() ?? ""
                                    : string.Join(", ", toolRes.Outputs.Select(kv => $"{kv.Key}: {kv.Value}"));

                                // Check for errors
                                if (toolRes.Outputs.ContainsKey("stderr") && !string.IsNullOrEmpty(toolRes.Outputs["stderr"]?.ToString()))
                                {
                                    toolOutput += "\nError: " + toolRes.Outputs["stderr"]?.ToString();
                                }

                                result.Logs.Add($"Tool result: {(toolOutput.Length > 100 ? toolOutput.Substring(0, 100) + "..." : toolOutput)}");

                                // Add assistant message (tool call) and user message (tool result)
                                messages.Add(ChatMessage.Assistant(jsonContent));
                                messages.Add(ChatMessage.User($"Tool result for {toolId}:\n{toolOutput}"));

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
}
