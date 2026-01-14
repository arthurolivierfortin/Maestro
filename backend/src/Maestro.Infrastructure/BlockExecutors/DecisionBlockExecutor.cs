using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Very small Decision executor: evaluates a simple equality expression of the form "{{var}} == value"
/// For safety this implementation only supports simple comparisons and boolean literal checks.
/// </summary>
public class DecisionBlockExecutor : IBlockExecutor
{
    public string SupportedType => "decision";

    public Task<BlockExecutionResult> ExecuteAsync(BlockDefinition block, ExecutionContext context, Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();

        var result = new BlockExecutionResult();

        // Expression comes from config key 'condition'
        var expr = block.Config != null && block.Config.TryGetValue("condition", out var c) ? c?.ToString() ?? string.Empty : string.Empty;
        if (string.IsNullOrWhiteSpace(expr))
        {
            result.Logs.Add("No condition provided");
            result.Outputs["result"] = false;
            result.DurationMs = sw.ElapsedMilliseconds;
            return Task.FromResult(result);
        }

        // Replace {{var}} placeholders from inputs
        var resolved = Regex.Replace(expr, @"\{\{\s*(.+?)\s*\}\}", m =>
        {
            var key = m.Groups[1].Value;
            if (inputs != null && inputs.TryGetValue(key, out var v)) return v?.ToString() ?? string.Empty;
            return string.Empty;
        });

        // Support simple forms: true/false or comparisons like "value == expected"
        bool res = false;
        if (bool.TryParse(resolved, out var b)) res = b;
        else if (resolved.Contains("=="))
        {
            var parts = resolved.Split(new[] {"=="}, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 2)
            {
                res = parts[0].Trim().Trim('"') == parts[1].Trim().Trim('"');
            }
        }

        result.Outputs["result"] = res;
        result.Outputs["branch"] = res ? "true" : "false";
        result.Logs.Add($"Condition evaluated: {resolved} => {res}");
        result.DurationMs = sw.ElapsedMilliseconds;
        return Task.FromResult(result);
    }
}
