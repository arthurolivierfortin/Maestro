using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Writes a test suite to disk. Uses the contractId to determine the filename.
/// Encapsulates the convention: content/system/contracts/{contractId}.test-suite.json
/// </summary>
public class WriteTestSuiteBlockExecutor : IBlockExecutor
{
    public string SupportedType => "write-test-suite";

    public Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();
        var testSuiteJson = inputs.TryGetValue("testSuiteJson", out var tsj) ? tsj?.ToString() ?? "" : "";
        var contractId = inputs.TryGetValue("contractId", out var cid) ? cid?.ToString() ?? "" : "";

        if (string.IsNullOrEmpty(testSuiteJson))
        {
            result.Success = false;
            result.Outputs["error"] = "Missing required input: testSuiteJson";
            return Task.FromResult(result);
        }

        // If contractId not provided as input, extract from JSON
        if (string.IsNullOrEmpty(contractId))
        {
            try
            {
                using var doc = JsonDocument.Parse(testSuiteJson);
                contractId = doc.RootElement.GetProperty("contractId").GetString() ?? "";
            }
            catch (Exception)
            {
                // contractId field not found in JSON
            }
        }

        if (string.IsNullOrEmpty(contractId))
        {
            result.Success = false;
            result.Outputs["error"] = "Missing contractId: provide it as input or include 'contractId' field in testSuiteJson";
            return Task.FromResult(result);
        }

        // Validate JSON
        try
        {
            JsonDocument.Parse(testSuiteJson);
        }
        catch (JsonException ex)
        {
            result.Success = false;
            result.Outputs["error"] = $"Invalid test suite JSON: {ex.Message}";
            return Task.FromResult(result);
        }

        var workingDir = context.Variables.TryGetValue("workingDir", out var wd) ? wd?.ToString() ?? "" : Directory.GetCurrentDirectory();
        var testSuitePath = Path.Combine(workingDir, "content", "system", "contracts", $"{contractId}.test-suite.json");

        // Ensure directory exists
        Directory.CreateDirectory(Path.GetDirectoryName(testSuitePath)!);
        File.WriteAllText(testSuitePath, testSuiteJson);

        result.Outputs["contractId"] = contractId;
        result.Outputs["testSuitePath"] = testSuitePath;
        result.Outputs["result"] = $"Test suite written: {testSuitePath}";
        result.Logs.Add($"[write-test-suite] Wrote {testSuitePath} ({testSuiteJson.Length} chars)");
        return Task.FromResult(result);
    }
}
