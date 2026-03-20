using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Writes a contract to disk. Extracts the "id" field from the JSON to determine the filename.
/// Encapsulates the convention: content/system/contracts/{contractId}.contract.json
/// </summary>
public class WriteContractBlockExecutor : IBlockExecutor
{
    public string SupportedType => "write-contract";

    public Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();
        var contractJson = inputs.TryGetValue("contractJson", out var cj) ? cj?.ToString() ?? "" : "";

        if (string.IsNullOrEmpty(contractJson))
        {
            result.Success = false;
            result.Outputs["error"] = "Missing required input: contractJson";
            return Task.FromResult(result);
        }

        // Extract contractId from the JSON
        string contractId;
        try
        {
            using var doc = JsonDocument.Parse(contractJson);
            contractId = doc.RootElement.GetProperty("id").GetString() ?? "";
            if (string.IsNullOrEmpty(contractId))
            {
                result.Success = false;
                result.Outputs["error"] = "Contract JSON missing 'id' field";
                return Task.FromResult(result);
            }
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Outputs["error"] = $"Invalid contract JSON: {ex.Message}";
            return Task.FromResult(result);
        }

        var workingDir = context.Variables.TryGetValue("workingDir", out var wd) ? wd?.ToString() ?? "" : Directory.GetCurrentDirectory();
        var contractPath = Path.Combine(workingDir, "content", "system", "contracts", $"{contractId}.contract.json");

        // Ensure directory exists
        Directory.CreateDirectory(Path.GetDirectoryName(contractPath)!);
        File.WriteAllText(contractPath, contractJson);

        result.Outputs["contractId"] = contractId;
        result.Outputs["contractPath"] = contractPath;
        result.Outputs["result"] = $"Contract written: {contractPath}";
        result.Logs.Add($"[write-contract] Wrote {contractPath} ({contractJson.Length} chars)");
        return Task.FromResult(result);
    }
}
