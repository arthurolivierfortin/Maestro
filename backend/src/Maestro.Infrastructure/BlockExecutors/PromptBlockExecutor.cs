using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

public class PromptBlockExecutor : IBlockExecutor
{
    public string SupportedType => "prompt";

    public async Task<BlockExecutionResult> ExecuteAsync(BlockDefinition block, ExecutionContext context, Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();

        // Try to load template.md from block config path
        string template = string.Empty;
        if (block.Config != null && block.Config.TryGetValue("path", out var p) && p is string path)
        {
            var file = System.IO.Path.Combine(path, "template.md");
            if (System.IO.File.Exists(file)) template = await System.IO.File.ReadAllTextAsync(file, ct);
        }

        if (string.IsNullOrEmpty(template) && block.Config != null && block.Config.TryGetValue("template", out var t))
        {
            template = t?.ToString() ?? string.Empty;
        }

        var resolved = ResolveTemplate(template, inputs);

        var result = new BlockExecutionResult();
        result.Outputs["prompt"] = resolved;
        result.Logs.Add("Template resolved");
        result.DurationMs = sw.ElapsedMilliseconds;

        return result;
    }

    private string ResolveTemplate(string template, Dictionary<string, object> inputs)
    {
        if (string.IsNullOrEmpty(template)) return string.Empty;
        // Basic {{var}} replacement
        return Regex.Replace(template, @"\{\{\s*(.+?)\s*\}\}", m =>
        {
            var key = m.Groups[1].Value;
            if (inputs != null && inputs.TryGetValue(key, out var v)) return v?.ToString() ?? string.Empty;
            return string.Empty;
        });
    }
}
