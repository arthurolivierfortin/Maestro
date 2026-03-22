using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Validates a test suite JSON against domain-specific rules.
/// Checks: feature coverage against contract, minimum tests per feature,
/// check type variety, required fields, test structure.
/// </summary>
public class ValidateTestSuiteBlockExecutor : IBlockExecutor
{
    public string SupportedType => "validate-test-suite";

    public Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();
        var testSuiteJson = inputs.TryGetValue("testSuiteJson", out var tsj) ? tsj?.ToString() ?? "" : "";
        var contractJson = inputs.TryGetValue("contractJson", out var cj) ? cj?.ToString() : null;
        var errors = new List<string>();

        if (string.IsNullOrEmpty(testSuiteJson))
        {
            result.Outputs["valid"] = "false";
            result.Outputs["errors"] = "Missing testSuiteJson input";
            return Task.FromResult(result);
        }

        try
        {
            using var suiteDoc = JsonDocument.Parse(testSuiteJson);
            var suite = suiteDoc.RootElement;

            // Required top-level fields
            if (!suite.TryGetProperty("contractId", out _)) errors.Add("Missing 'contractId'");
            if (!suite.TryGetProperty("totalTests", out _)) errors.Add("Missing 'totalTests'");

            var checkTypesUsed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var coveredFeatures = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            if (suite.TryGetProperty("features", out var features) && features.ValueKind == JsonValueKind.Object)
            {
                foreach (var feature in features.EnumerateObject())
                {
                    coveredFeatures.Add(feature.Name);

                    if (feature.Value.TryGetProperty("tests", out var tests) && tests.ValueKind == JsonValueKind.Array)
                    {
                        var testCount = tests.GetArrayLength();
                        if (testCount < 2)
                            errors.Add($"Feature '{feature.Name}' has {testCount} tests (minimum 2)");

                        foreach (var test in tests.EnumerateArray())
                        {
                            if (!test.TryGetProperty("id", out _))
                                errors.Add($"Test in '{feature.Name}' missing 'id'");

                            // Collect check types
                            if (test.TryGetProperty("check", out var check) && check.TryGetProperty("type", out var ct_prop))
                                checkTypesUsed.Add(ct_prop.GetString() ?? "");

                            // Multi-turn tests: check inside turns
                            if (test.TryGetProperty("turns", out var turns) && turns.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var turn in turns.EnumerateArray())
                                {
                                    if (turn.TryGetProperty("check", out var turnCheck) && turnCheck.TryGetProperty("type", out var tct))
                                        checkTypesUsed.Add(tct.GetString() ?? "");
                                }
                            }
                        }
                    }
                    else
                    {
                        errors.Add($"Feature '{feature.Name}' missing 'tests' array");
                    }
                }
            }
            else
            {
                errors.Add("Missing or invalid 'features' object");
            }

            // Check type variety
            if (checkTypesUsed.Count < 3)
                errors.Add($"Only {checkTypesUsed.Count} check types used (minimum 3). Used: {string.Join(", ", checkTypesUsed)}");

            // Coverage check against contract (if provided)
            if (!string.IsNullOrEmpty(contractJson))
            {
                try
                {
                    using var contractDoc = JsonDocument.Parse(contractJson);
                    if (contractDoc.RootElement.TryGetProperty("features", out var contractFeatures))
                    {
                        foreach (var cf in contractFeatures.EnumerateObject())
                        {
                            if (!coveredFeatures.Contains(cf.Name))
                                errors.Add($"Contract feature '{cf.Name}' not covered in test suite");
                        }
                    }
                }
                catch { /* contract parse error — skip coverage check */ }
            }
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
            ? "[validate-test-suite] Test suite is valid"
            : $"[validate-test-suite] {errors.Count} errors found");
        return Task.FromResult(result);
    }
}
