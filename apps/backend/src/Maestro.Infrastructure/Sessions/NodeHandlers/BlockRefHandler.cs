using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Sessions.NodeHandlers;

/// <summary>
/// Handles blockRef nodes: resolves block definitions, builds inputs,
/// dispatches to the appropriate IBlockExecutor via BlockExecutorRegistry,
/// and serializes the output.
///
/// ARCHITECTURE (Phase 53-C): Extracted from NodeExecutionEngine.
/// Block dispatch is a distinct concern from control flow orchestration.
/// </summary>
public class BlockRefHandler : INodeHandler
{
    private readonly IBlockDiscoveryService _blockDiscovery;
    private readonly BlockExecutors.BlockExecutorRegistry _executorRegistry;
    private readonly ISessionStateManager _stateManager;
    private readonly IProjectSessionRepository _repository;
    private readonly ILogger<BlockRefHandler> _logger;

    public string? NodeType => null; // Default handler for blockRef nodes

    public BlockRefHandler(
        IBlockDiscoveryService blockDiscovery,
        BlockExecutors.BlockExecutorRegistry executorRegistry,
        ISessionStateManager stateManager,
        IProjectSessionRepository repository,
        ILogger<BlockRefHandler> logger)
    {
        _blockDiscovery = blockDiscovery;
        _executorRegistry = executorRegistry;
        _stateManager = stateManager;
        _repository = repository;
        _logger = logger;
    }

    public async Task<string?> ExecuteAsync(
        JsonElement node,
        NodeExecutionContext context,
        INodeExecutionCallback engine,
        string? previousOutput)
    {
        var session = context.Session;
        var workingDir = context.WorkingDir;
        var displayTree = context.DisplayTree;

        var nodeId = node.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "unknown" : "unknown";
        var blockRefId = ResolveBlockRef(node, nodeId, session);

        if (blockRefId == null)
            throw new InvalidOperationException($"BlockRefHandler called for node '{nodeId}' with no blockRef");

        // Resolve the block definition
        var block = await _blockDiscovery.GetByIdAsync(SessionHelper.NormalizeBlockId(blockRefId), session.BlockSearchPaths);
        if (block == null)
            throw new InvalidOperationException(
                $"Block not found: '{blockRefId}'. " +
                $"Referenced by node '{nodeId}'. " +
                $"Run 'maestro block deps <parent-block>' to see all dependencies.");

        var executor = _executorRegistry.Get(block.BlockType);
        if (executor == null)
            throw new InvalidOperationException($"No executor for block type '{block.BlockType}' (blockRef: {blockRefId})");

        MergeNodeConfigOverrides(block, node);
        var inputs = BuildBlockInputs(node, session, previousOutput, workingDir);

        _stateManager.AppendExecutionLog(session, "info", $"Executing blockRef '{blockRefId}' (type: {block.BlockType}) with {inputs.Count} inputs");
        await _repository.SaveAsync(session);

        // Workflow blocks with config.nodes: walk their nodes recursively
        if (string.Equals(block.BlockType, "workflow", StringComparison.OrdinalIgnoreCase))
        {
            var nodesElement = ResolveConfigNodesToJsonElement(block.Config);
            if (nodesElement.HasValue)
            {
                _stateManager.AppendExecutionLog(session, "info",
                    $"blockRef '{blockRefId}' has {nodesElement.Value.GetArrayLength()} config.nodes — executing as composite");
                try
                {
                    var compositeOutput = await engine.ExecuteConfigNodesAsync(
                        session, nodesElement.Value, null, workingDir, blockRefId, null, displayTree, previousOutput);
                    _stateManager.AppendExecutionLog(session, "success", $"blockRef '{blockRefId}' composite execution completed");
                    return compositeOutput;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Composite blockRef execution failed: {BlockRef}", blockRefId);
                    _stateManager.AppendExecutionLog(session, "error", $"blockRef '{blockRefId}' composite error: {ex.Message}");
                    return previousOutput ?? $"(error executing composite '{blockRefId}': {ex.Message})";
                }
            }
        }

        // Standard executor dispatch
        var execContext = BuildExecutionContext(session, workingDir, blockRefId);

        try
        {
            var result = await executor.ExecuteAsync(block, execContext, inputs);

            // Accumulate costs in session variables for parent block cost propagation
            AccumulateCosts(session, result);

            if (result.Logs is { Count: > 0 })
            {
                foreach (var log in result.Logs)
                    _stateManager.AppendExecutionLog(session, "info", $"[{blockRefId}] {log}");
            }

            LogBlockLLMActivity(session, result, blockRefId, block.BlockType);

            foreach (var kv in result.Outputs.Where(kv => kv.Key.StartsWith("_")))
                session.SetVariable($"{kv.Key}_{blockRefId}", kv.Value);

            var output = SerializeBlockOutput(result, blockRefId);

            if (!result.Success)
                throw new InvalidOperationException($"Block '{blockRefId}' failed: {output}");

            _stateManager.AppendExecutionLog(session, "success", $"blockRef '{blockRefId}' completed ({output.Length} chars)");
            return output;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "BlockRef execution failed: {BlockRef}", blockRefId);
            _stateManager.AppendExecutionLog(session, "error", $"blockRef '{blockRefId}' error: {ex.Message}");
            throw;
        }
    }

    // ===== Helpers (moved from NodeExecutionEngine) =====

    internal static string? ResolveBlockRef(JsonElement configNode, string nodeId, ProjectSession session)
    {
        if (configNode.TryGetProperty("blockRef", out var blockRefProp) && blockRefProp.ValueKind == JsonValueKind.String)
            return TemplateResolver.ResolveTemplate(blockRefProp.GetString()!, session);

        if (configNode.TryGetProperty("blockId", out var blockIdProp) && blockIdProp.ValueKind == JsonValueKind.String)
            return TemplateResolver.ResolveTemplate(blockIdProp.GetString()!, session);

        return null;
    }

    internal static void MergeNodeConfigOverrides(BlockDefinition block, JsonElement phaseNode)
    {
        if (!phaseNode.TryGetProperty("config", out var nodeConfigEl) || nodeConfigEl.ValueKind != JsonValueKind.Object)
            return;

        foreach (var prop in nodeConfigEl.EnumerateObject())
        {
            block.Config[prop.Name] = prop.Value.ValueKind switch
            {
                JsonValueKind.String => (object)prop.Value.GetString()!,
                JsonValueKind.Number => prop.Value.TryGetInt32(out var i) ? i : prop.Value.GetDouble(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                _ => prop.Value.GetRawText()
            };
        }
    }

    internal static Dictionary<string, object> BuildBlockInputs(
        JsonElement phaseNode,
        ProjectSession session,
        string? previousOutput,
        string workingDir)
    {
        var inputs = new Dictionary<string, object>();
        if (phaseNode.TryGetProperty("inputs", out var inputsEl) && inputsEl.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in inputsEl.EnumerateObject())
            {
                var rawValue = prop.Value.GetString() ?? prop.Value.ToString();
                var resolved = rawValue.Contains("{{previousOutput}}")
                    ? rawValue.Replace("{{previousOutput}}", previousOutput ?? "")
                    : TemplateResolver.ResolveTemplate(rawValue, session);
                inputs[prop.Name] = resolved;
            }
        }
        if (!inputs.ContainsKey("workingDir"))
            inputs["workingDir"] = workingDir;
        return inputs;
    }

    internal static JsonElement? ResolveConfigNodesToJsonElement(Dictionary<string, object>? config)
    {
        if (config == null || !config.TryGetValue("nodes", out var nodesObj))
            return null;

        if (nodesObj is JsonElement je && je.ValueKind == JsonValueKind.Array)
            return je;

        if (nodesObj is Newtonsoft.Json.Linq.JArray jArr)
        {
            using var nd = JsonDocument.Parse(jArr.ToString());
            return nd.RootElement.Clone();
        }

        try
        {
            var serialized = JsonSerializer.Serialize(nodesObj);
            using var nd = JsonDocument.Parse(serialized);
            if (nd.RootElement.ValueKind == JsonValueKind.Array)
                return nd.RootElement.Clone();
        }
        catch { /* not serializable as array */ }

        return null;
    }

    private static Domain.Entities.ExecutionContext BuildExecutionContext(
        ProjectSession session,
        string workingDir,
        string blockRefId)
    {
        var execContext = new Domain.Entities.ExecutionContext();
        execContext.Variables["sessionId"] = session.Id;
        execContext.Variables["workingDir"] = workingDir;
        if (!string.IsNullOrEmpty(session.ParentWorkspaceId))
            execContext.Variables["workspaceId"] = session.ParentWorkspaceId;
        execContext.Variables["agentId"] = blockRefId;
        var effectivePermissions = session.GetEffectivePermissions();
        execContext.Variables["_permissions_allowedPaths"] = effectivePermissions.AllowedPaths;
        return execContext;
    }

    internal static string SerializeBlockOutput(BlockExecutionResult result, string blockRefId)
    {
        var contentOutputs = result.Outputs
            .Where(kv => !kv.Key.StartsWith("_"))
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        if (contentOutputs.TryGetValue("response", out var respOutput) && respOutput != null)
            return respOutput.ToString() ?? "";

        if (contentOutputs.Count == 1)
            return TemplateResolver.SerializeOutputValue(contentOutputs.Values.First());

        if (contentOutputs.Count > 1)
        {
            var jsonDict = new Dictionary<string, object?>();
            foreach (var kv in contentOutputs)
                jsonDict[kv.Key] = kv.Value;
            return JsonSerializer.Serialize(jsonDict, new JsonSerializerOptions { WriteIndented = false });
        }

        return result.Success
            ? $"Block '{blockRefId}' completed successfully"
            : $"Block '{blockRefId}' failed";
    }

    /// <summary>
    /// Accumulates block execution costs into session variables for parent block cost propagation.
    /// Variables: _accumulatedCost, _accumulatedPromptTokens, _accumulatedCompletionTokens.
    /// </summary>
    private static void AccumulateCosts(ProjectSession session, BlockExecutionResult result)
    {
        var currentCost = decimal.TryParse(session.GetVariable("_accumulatedCost")?.ToString(), out var c) ? c : 0m;
        session.SetVariable("_accumulatedCost", (currentCost + result.EstimatedCostUsd).ToString(System.Globalization.CultureInfo.InvariantCulture));

        var currentPromptTokens = int.TryParse(session.GetVariable("_accumulatedPromptTokens")?.ToString(), out var pt) ? pt : 0;
        session.SetVariable("_accumulatedPromptTokens", (currentPromptTokens + result.PromptTokens).ToString());

        var currentCompletionTokens = int.TryParse(session.GetVariable("_accumulatedCompletionTokens")?.ToString(), out var cpt) ? cpt : 0;
        session.SetVariable("_accumulatedCompletionTokens", (currentCompletionTokens + result.CompletionTokens).ToString());
    }

    private void LogBlockLLMActivity(
        ProjectSession session,
        BlockExecutionResult result,
        string blockRefId,
        string? blockType)
    {
        var responseText = result.Outputs.TryGetValue("response", out var resp) ? resp?.ToString()
                         : result.Outputs.TryGetValue("result", out var res) ? res?.ToString()
                         : result.Outputs.TryGetValue("content", out var cnt) ? cnt?.ToString()
                         : null;
        if (responseText == null) return;

        _stateManager.AppendToLLMActivity(session, new Dictionary<string, object>
        {
            { "type", blockType ?? "block" },
            { "blockRef", blockRefId },
            { "response", responseText.Length > 500 ? responseText[..500] + "..." : responseText },
            { "timestamp", DateTime.UtcNow.ToString("o") },
            { "toolCalls", result.Outputs.TryGetValue("warning", out var w) && w?.ToString()?.Contains("tool calls") == true ? w.ToString()! : "" },
            { "tokens", result.TotalTokens }
        });
    }
}
