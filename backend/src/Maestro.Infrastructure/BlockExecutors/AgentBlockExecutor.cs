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

    public AgentBlockExecutor(ILLMGateway llmGateway)
    {
        _llmGateway = llmGateway;
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

        // Build prompt from system/user templates
        var systemPrompt = block.Config != null && block.Config.TryGetValue("system", out var s) ? s?.ToString() ?? string.Empty : string.Empty;
        var userPrompt = block.Config != null && block.Config.TryGetValue("user", out var u) ? u?.ToString() ?? string.Empty : string.Empty;

        var resolved = userPrompt;
        if (!string.IsNullOrEmpty(systemPrompt)) resolved = systemPrompt + "\n" + resolved;

        var request = new LLMRequest { Prompt = resolved };
        var response = await _llmGateway.SendAsync(request, ct);

        result.Outputs["content"] = response.Content;
        result.Logs.Add("Agent LLM response received");
        result.DurationMs = sw.ElapsedMilliseconds;
        return result;
    }
}
