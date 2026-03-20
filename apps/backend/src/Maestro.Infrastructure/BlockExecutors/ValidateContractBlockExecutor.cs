using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Validates a Maestro contract JSON against domain-specific rules.
/// Checks: required fields, feature weights sum ~1.0, valid check types, etc.
/// </summary>
public class ValidateContractBlockExecutor : IBlockExecutor
{
    public string SupportedType => "validate-contract";

    private static readonly HashSet<string> ValidCheckTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "non-empty", "contains", "contains-all", "contains-any",
        "does-not-contain", "tool-call", "json-parseable", "regex"
    };

    public Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();
        var contractJson = inputs.TryGetValue("contractJson", out var cj) ? cj?.ToString() ?? "" : "";
        var errors = new List<string>();

        if (string.IsNullOrEmpty(contractJson))
        {
            result.Outputs["valid"] = "false";
            result.Outputs["errors"] = "Missing contractJson input";
            return Task.FromResult(result);
        }

        try
        {
            using var doc = JsonDocument.Parse(contractJson);
            var root = doc.RootElement;

            // Required top-level fields
            if (!root.TryGetProperty("id", out _)) errors.Add("Missing required field: 'id'");
            if (!root.TryGetProperty("features", out var features))
            {
                errors.Add("Missing required field: 'features'");
            }
            else
            {
                // Validate features
                double weightSum = 0;
                int featureCount = 0;
                foreach (var feature in features.EnumerateObject())
                {
                    featureCount++;
                    var f = feature.Value;

                    // Weight
                    if (f.TryGetProperty("weight", out var w))
                    {
                        weightSum += w.GetDouble();
                    }
                    else
                    {
                        errors.Add($"Feature '{feature.Name}' missing 'weight'");
                    }

                    // Tests
                    if (f.TryGetProperty("tests", out var tests) && tests.ValueKind == JsonValueKind.Array)
                    {
                        if (tests.GetArrayLength() == 0)
                            errors.Add($"Feature '{feature.Name}' has empty tests array");

                        foreach (var test in tests.EnumerateArray())
                        {
                            // Each test needs at minimum: id, prompt OR turns
                            if (!test.TryGetProperty("id", out _))
                                errors.Add($"Test in feature '{feature.Name}' missing 'id'");

                            var hasPrompt = test.TryGetProperty("prompt", out _);
                            var hasTurns = test.TryGetProperty("turns", out _);
                            if (!hasPrompt && !hasTurns)
                                errors.Add($"Test in feature '{feature.Name}' needs 'prompt' or 'turns'");

                            // Validate check types
                            if (test.TryGetProperty("check", out var check) && check.TryGetProperty("type", out var checkType))
                            {
                                var ct_val = checkType.GetString() ?? "";
                                if (!ValidCheckTypes.Contains(ct_val))
                                    errors.Add($"Invalid check type '{ct_val}' in feature '{feature.Name}'");
                            }
                        }
                    }
                    else
                    {
                        errors.Add($"Feature '{feature.Name}' missing or invalid 'tests' array");
                    }
                }

                if (featureCount == 0)
                    errors.Add("No features defined");

                // Weights should sum to approximately 1.0 (tolerance: 0.05)
                if (featureCount > 0 && Math.Abs(weightSum - 1.0) > 0.05)
                    errors.Add($"Feature weights sum to {weightSum:F2}, expected ~1.0");
            }

            // minimumFitness
            if (root.TryGetProperty("minimumFitness", out var mf))
            {
                var val = mf.GetDouble();
                if (val < 0 || val > 1)
                    errors.Add($"minimumFitness {val} out of range [0, 1]");
            }

            // requiredCapabilities
            if (!root.TryGetProperty("requiredCapabilities", out var rc) || rc.ValueKind != JsonValueKind.Array)
                errors.Add("Missing or invalid 'requiredCapabilities' array");
        }
        catch (JsonException ex)
        {
            errors.Add($"Invalid JSON: {ex.Message}");
        }

        var valid = errors.Count == 0;
        result.Outputs["valid"] = valid ? "true" : "false";
        result.Outputs["errors"] = string.Join("; ", errors);
        result.Outputs["errorCount"] = errors.Count.ToString();
        result.Logs.Add(valid
            ? "[validate-contract] Contract is valid"
            : $"[validate-contract] {errors.Count} errors found");
        return Task.FromResult(result);
    }
}
