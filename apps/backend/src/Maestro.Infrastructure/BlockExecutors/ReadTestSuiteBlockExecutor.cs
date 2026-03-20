using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Reads a test suite by contract ID. Resolves the path internally.
/// Encapsulates the convention: content/system/contracts/{contractId}.test-suite.json
/// </summary>
public class ReadTestSuiteBlockExecutor : IBlockExecutor
{
    public string SupportedType => "read-test-suite";

    public Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();
        var contractId = inputs.TryGetValue("contractId", out var id) ? id?.ToString() ?? "" : "";

        if (string.IsNullOrEmpty(contractId))
        {
            result.Success = false;
            result.Outputs["error"] = "Missing required input: contractId";
            return Task.FromResult(result);
        }

        // Resolve path using Maestro convention
        var workingDir = context.Variables.TryGetValue("workingDir", out var wd) ? wd?.ToString() ?? "" : Directory.GetCurrentDirectory();
        var testSuitePath = Path.Combine(workingDir, "content", "system", "contracts", $"{contractId}.test-suite.json");

        if (!File.Exists(testSuitePath))
        {
            result.Success = false;
            result.Outputs["error"] = $"Test suite not found: {testSuitePath}";
            return Task.FromResult(result);
        }

        var content = File.ReadAllText(testSuitePath);

        // Validate it's valid JSON
        try
        {
            JsonDocument.Parse(content);
        }
        catch (JsonException ex)
        {
            result.Success = false;
            result.Outputs["error"] = $"Test suite file is not valid JSON: {ex.Message}";
            return Task.FromResult(result);
        }

        result.Outputs["testSuiteJson"] = content;
        result.Outputs["contractId"] = contractId;
        result.Outputs["testSuitePath"] = testSuitePath;
        result.Logs.Add($"[read-test-suite] Read {testSuitePath} ({content.Length} chars)");
        return Task.FromResult(result);
    }
}
