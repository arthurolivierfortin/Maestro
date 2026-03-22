using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Reads a contract by ID. Resolves the path internally — the caller only needs the contractId.
/// Encapsulates the convention: content/system/contracts/{contractId}.contract.json
/// </summary>
public class ReadContractBlockExecutor : IBlockExecutor
{
    public string SupportedType => "read-contract";

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
        var contractPath = Path.Combine(workingDir, "content", "system", "contracts", $"{contractId}.contract.json");

        if (!File.Exists(contractPath))
        {
            result.Success = false;
            result.Outputs["error"] = $"Contract not found: {contractPath}";
            return Task.FromResult(result);
        }

        var content = File.ReadAllText(contractPath);

        // Validate it's valid JSON
        try
        {
            JsonDocument.Parse(content);
        }
        catch (JsonException ex)
        {
            result.Success = false;
            result.Outputs["error"] = $"Contract file is not valid JSON: {ex.Message}";
            return Task.FromResult(result);
        }

        result.Outputs["contractJson"] = content;
        result.Outputs["contractId"] = contractId;
        result.Outputs["contractPath"] = contractPath;
        result.Logs.Add($"[read-contract] Read {contractPath} ({content.Length} chars)");
        return Task.FromResult(result);
    }
}
