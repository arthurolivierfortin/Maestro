using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

public class InferenceBlockExecutor : IBlockExecutor
{
    private readonly ILLMGateway _llmGateway;

    public InferenceBlockExecutor(ILLMGateway llmGateway)
    {
        _llmGateway = llmGateway ?? throw new ArgumentNullException(nameof(llmGateway));
    }

    public string SupportedType => "inference";

    public async Task<BlockExecutionResult> ExecuteAsync(BlockDefinition block, ExecutionContext context, Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();

        string template = string.Empty;
        string? path = null;
        if (block.Config != null && block.Config.TryGetValue("path", out var p) && p is string pstr)
        {
            path = pstr;
            var file = Path.Combine(path, "prompt.md");
            if (File.Exists(file)) template = await File.ReadAllTextAsync(file, ct);
        }

        if (string.IsNullOrEmpty(template) && block.Config != null && block.Config.TryGetValue("template", out var t))
        {
            template = t?.ToString() ?? string.Empty;
        }

        var resolved = ResolveTemplate(template, inputs);

        // Mock mode: if mock-response.json exists in path, use it
        if (path != null)
        {
            var mock = Path.Combine(path, "mock-response.json");
            if (File.Exists(mock))
            {
                var text = await File.ReadAllTextAsync(mock, ct);
                try
                {
                    using var doc = JsonDocument.Parse(text);
                    var root = doc.RootElement;
                    var outputs = new Dictionary<string, object>();
                    if (root.TryGetProperty("outputs", out var outs))
                    {
                        foreach (var prop in outs.EnumerateObject())
                        {
                            outputs[prop.Name] = prop.Value.GetString() ?? prop.Value.ToString();
                        }
                    }

                    var result = new BlockExecutionResult();
                    foreach (var kv in outputs) result.Outputs[kv.Key] = kv.Value!;
                    result.Logs.Add("Mock response loaded");
                    result.DurationMs = sw.ElapsedMilliseconds;
                    return result;
                }
                catch
                {
                    // fallthrough to real call
                }
            }
        }

        // Real LLM call
        var request = new LLMRequest { Prompt = resolved };
        var response = await _llmGateway.SendAsync(request, ct);

        var res = new BlockExecutionResult();
        res.Outputs["content"] = response.Content;
        res.Logs.Add("LLM response received");
        res.DurationMs = sw.ElapsedMilliseconds;

        return res;
    }

    private string ResolveTemplate(string template, Dictionary<string, object> inputs)
    {
        if (string.IsNullOrEmpty(template)) return string.Empty;
        return Regex.Replace(template, @"\{\{\s*(.+?)\s*\}\}", m =>
        {
            var key = m.Groups[1].Value;
            if (inputs != null && inputs.TryGetValue(key, out var v)) return v?.ToString() ?? string.Empty;
            return string.Empty;
        });
    }
}
