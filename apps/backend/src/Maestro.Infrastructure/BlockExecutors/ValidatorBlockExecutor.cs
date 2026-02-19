using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Lightweight validator executor supporting simple rule sets provided in block.Config["rules"]
/// Rules format example:
/// {
///   "required": ["name", "email"],
///   "patterns": { "email": "^.+@.+\\..+$" }
/// }
/// </summary>
public class ValidatorBlockExecutor : IBlockExecutor
{
    public string SupportedType => "validator";

    public Task<BlockExecutionResult> ExecuteAsync(BlockDefinition block, ExecutionContext context, Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var result = new BlockExecutionResult();

        if (block.Config == null || !block.Config.TryGetValue("rules", out var rulesObj) || rulesObj == null)
        {
            result.Logs.Add("No rules provided");
            result.Outputs["isValid"] = true;
            result.DurationMs = sw.ElapsedMilliseconds;
            return Task.FromResult(result);
        }

        try
        {
            var json = JsonSerializer.Serialize(rulesObj);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var isValid = true;
            var errors = new List<string>();

            if (root.TryGetProperty("required", out var req) && req.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in req.EnumerateArray())
                {
                    var name = el.GetString();
                    if (name != null && (inputs == null || !inputs.ContainsKey(name)))
                    {
                        isValid = false;
                        errors.Add($"Missing required: {name}");
                    }
                }
            }

            if (root.TryGetProperty("patterns", out var pats) && pats.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in pats.EnumerateObject())
                {
                    var key = prop.Name;
                    var pattern = prop.Value.GetString() ?? string.Empty;
                    if (inputs != null && inputs.TryGetValue(key, out var val) && val != null)
                    {
                        if (!Regex.IsMatch(val.ToString() ?? string.Empty, pattern))
                        {
                            isValid = false;
                            errors.Add($"Pattern mismatch for {key}");
                        }
                    }
                }
            }

            result.Outputs["isValid"] = isValid;
            result.Outputs["errors"] = errors;
            result.Logs.Add(isValid ? "Validation passed" : "Validation failed");
            result.DurationMs = sw.ElapsedMilliseconds;
            return Task.FromResult(result);
        }
        catch (Exception ex)
        {
            result.Logs.Add("Validator error: " + ex.Message);
            result.Outputs["isValid"] = false;
            result.Outputs["errors"] = new List<string> { ex.Message };
            result.DurationMs = sw.ElapsedMilliseconds;
            return Task.FromResult(result);
        }
    }
}
