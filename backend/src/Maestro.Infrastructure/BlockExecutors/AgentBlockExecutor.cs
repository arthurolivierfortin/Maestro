using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

public class AgentBlockExecutor : IBlockExecutor
{
    private readonly ILLMGateway _llmGateway;
    private readonly Maestro.Infrastructure.BlockExecutors.BlockExecutorRegistry? _registry;

    public AgentBlockExecutor(ILLMGateway llmGateway, Maestro.Infrastructure.BlockExecutors.BlockExecutorRegistry? registry = null)
    {
        _llmGateway = llmGateway;
        _registry = registry;
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

        var userPrompt = block.Config != null && block.Config.TryGetValue("user", out var u) ? u?.ToString() ?? string.Empty : string.Empty;

        var resolved = userPrompt;
        if (!string.IsNullOrEmpty(systemPrompt)) resolved = systemPrompt + "\n" + resolved;

        var maxIterations = 5;
        if (block.Config != null && block.Config.TryGetValue("maxIterations", out var mi) && mi is int mii) maxIterations = mii;

        var iteration = 0;
        LLMResponse response = null;
        while (true)
        {
            iteration++;
            var request = new LLMRequest { Prompt = resolved };
            response = await _llmGateway.SendAsync(request, ct);

            // If the LLM indicates a tool call, execute it and feed result back
            var toolCalled = false;
            try
            {
                using var doc = JsonDocument.Parse(response.Content);
                if (doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty("tool", out var toolProp))
                {
                    var toolId = toolProp.GetString();
                    var args = doc.RootElement.TryGetProperty("args", out var argsProp) ? argsProp : default;
                    if (!string.IsNullOrEmpty(toolId) && _registry != null)
                    {
                        // Attempt to find tool block by id in context (context.BlockStates keys may contain metadata)
                        // For now, assume tool blockId == toolId and execute with args as inputs
                        var inputsForTool = new Dictionary<string, object>();
                        if (args.ValueKind == JsonValueKind.Object)
                        {
                            foreach (var p in args.EnumerateObject()) inputsForTool[p.Name] = p.Value.ToString();
                        }

                        var toolExec = _registry.Resolve(toolId);
                        if (toolExec != null)
                        {
                            var toolBlock = new BlockDefinition(toolId, toolId, "tool");
                            var toolRes = await toolExec.ExecuteAsync(toolBlock, context, inputsForTool, ct);
                            // inject tool output into resolved prompt for next iteration
                            resolved += "\nToolResult:" + (toolRes.Outputs.ContainsKey("stdout") ? toolRes.Outputs["stdout"]?.ToString() : string.Empty);
                            toolCalled = true;
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
}
