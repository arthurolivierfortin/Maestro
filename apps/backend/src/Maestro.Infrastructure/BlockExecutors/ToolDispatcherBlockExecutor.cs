using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Resolves a tool by ID and executes it via BlockExecutorRegistry.
/// Reproduces EXACTLY the logic from AgentBlockExecutor.ExecuteViaBlockDispatchAsync
/// and NormalizeToolId.
///
/// Phase 53-C: Atomic block executor.
/// DI: IBlockDiscoveryService and BlockExecutorRegistry resolved lazily to avoid circular DI.
/// </summary>
public class ToolDispatcherBlockExecutor : IBlockExecutor
{
    private readonly IServiceProvider _serviceProvider;
    private IBlockDiscoveryService? _blockDiscovery;
    private BlockExecutorRegistry? _executorRegistry;

    public string SupportedType => "tool-dispatcher";

    public ToolDispatcherBlockExecutor(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        if (!inputs.TryGetValue("toolId", out var toolIdObj) || toolIdObj == null)
        {
            result.Success = false;
            result.Outputs["error"] = "Missing required input: toolId";
            return result;
        }

        var toolId = NormalizeToolId(toolIdObj.ToString() ?? "");

        // Parse args
        JsonElement args = default;
        if (inputs.TryGetValue("args", out var argsObj) && argsObj != null)
        {
            var argsStr = argsObj.ToString() ?? "{}";
            try
            {
                using var doc = JsonDocument.Parse(argsStr);
                args = doc.RootElement.Clone();
            }
            catch
            {
                args = default;
            }
        }

        // Lazy resolve to avoid circular DI
        _blockDiscovery ??= _serviceProvider.GetService<IBlockDiscoveryService>();
        _executorRegistry ??= _serviceProvider.GetService<BlockExecutorRegistry>();

        if (_blockDiscovery == null || _executorRegistry == null)
        {
            result.Success = false;
            result.Outputs["error"] = $"Tool '{toolId}' cannot be dispatched. Block discovery services unavailable.";
            result.Outputs["success"] = false;
            return result;
        }

        // Resolve block by ID
        var targetBlock = await _blockDiscovery.GetByIdAsync(toolId, ct);
        if (targetBlock == null)
        {
            result.Success = false;
            result.Outputs["result"] = $"Error: Tool '{toolId}' does not exist.";
            result.Outputs["success"] = false;
            return result;
        }

        // Get executor for block type
        var executor = _executorRegistry.Get(targetBlock.BlockType);
        if (executor == null)
        {
            result.Success = false;
            result.Outputs["result"] = $"Error: No executor available for block '{toolId}' (type: {targetBlock.BlockType}).";
            result.Outputs["success"] = false;
            return result;
        }

        // Build inputs from args
        var blockInputs = new Dictionary<string, object>();
        if (args.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in args.EnumerateObject())
            {
                blockInputs[prop.Name] = DeserializeJsonElement(prop.Value);
            }
        }

        // Propagate working directory from parent context
        if (!blockInputs.ContainsKey("workingDir") && context.Variables.TryGetValue("workingDir", out var wd))
            blockInputs["workingDir"] = wd;

        result.Logs.Add($"Dispatching to block '{toolId}' (type: {targetBlock.BlockType}) with {blockInputs.Count} inputs");

        try
        {
            var blockResult = await executor.ExecuteAsync(targetBlock, context, blockInputs, ct);

            // Format output
            string outputStr;
            if (blockResult.Success)
            {
                if (blockResult.Outputs.TryGetValue("result", out var r))
                    outputStr = r?.ToString() ?? "Success";
                else if (blockResult.Outputs.TryGetValue("content", out var c))
                    outputStr = c?.ToString() ?? "Success";
                else if (blockResult.Outputs.Count > 0)
                {
                    try { outputStr = JsonSerializer.Serialize(blockResult.Outputs); }
                    catch { outputStr = blockResult.Outputs.Values.First()?.ToString() ?? "Success"; }
                }
                else
                    outputStr = "Success";
            }
            else
            {
                var errorMsg = blockResult.Outputs.TryGetValue("error", out var err)
                    ? err?.ToString() ?? "Unknown error"
                    : blockResult.Logs.LastOrDefault() ?? "Block execution failed";
                outputStr = $"Error: {errorMsg}";
            }

            result.Success = blockResult.Success;
            result.Outputs["result"] = outputStr;
            result.Outputs["success"] = blockResult.Success;
            result.Outputs["toolOutputs"] = blockResult.Outputs;

            // Phase 61-A: Propagate sub-block costs to the tool-dispatcher result.
            // Without this, costs from tools dispatched by the agent (file-write, contract-test,
            // inference calls inside contract-test, etc.) are lost — the parent session never
            // sees them because AccumulateCosts reads from BlockExecutionResult.EstimatedCostUsd.
            result.EstimatedCostUsd = blockResult.EstimatedCostUsd;
            result.PromptTokens = blockResult.PromptTokens;
            result.CompletionTokens = blockResult.CompletionTokens;
            result.TotalTokens = blockResult.TotalTokens;

            return result;
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Outputs["result"] = $"Error: {ex.Message}";
            result.Outputs["success"] = false;
            result.Logs.Add($"Tool dispatch failed: {ex.Message}");
            return result;
        }
    }

    /// <summary>
    /// Same NormalizeToolId as AgentBlockExecutor.
    /// </summary>
    internal static string NormalizeToolId(string toolId)
    {
        return toolId switch
        {
            "bash" or "Bash" or "run" or "exec" or "execute" or "cmd" => "shell-execute",
            "read-file" or "readFile" or "Read" or "read" or "cat" => "file-read",
            "write-file" or "writeFile" or "Write" or "write" => "file-write",
            "list-directory" or "listDirectory" or "ls" or "list-dir" or "Glob" or "glob" or "find" => "directory-list",
            "edit-file" or "editFile" or "edit" or "Edit" => "file-edit",
            "Grep" or "grep" or "search" or "Search" => "directory-list",
            _ => toolId
        };
    }

    private static object DeserializeJsonElement(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString() ?? "",
            JsonValueKind.Number => element.TryGetInt64(out var l) ? (object)l : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => "",
            JsonValueKind.Object => element.ToString(),
            JsonValueKind.Array => element.ToString(),
            _ => element.ToString()
        };
    }
}
