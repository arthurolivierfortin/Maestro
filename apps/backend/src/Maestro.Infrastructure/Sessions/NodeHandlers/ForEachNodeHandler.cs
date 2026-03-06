using System.Text.Json;
using Newtonsoft.Json.Linq;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Sessions.NodeHandlers;

/// <summary>
/// Handles "for-each" nodes: iterates over a list from a session variable,
/// executes child nodes for each item with scoped variable resets and
/// per-item config lookup. Supports checkpoint resume.
///
/// ARCHITECTURE (Phase 53-C): Extracted from NodeExecutionEngine.
/// Self-contained — no other node type calls into this handler.
/// </summary>
public class ForEachNodeHandler : INodeHandler
{
    private readonly IProjectSessionRepository _repository;
    private readonly ISessionStateManager _stateManager;
    private readonly ILogger<ForEachNodeHandler> _logger;

    public string? NodeType => "for-each";

    public ForEachNodeHandler(
        IProjectSessionRepository repository,
        ISessionStateManager stateManager,
        ILogger<ForEachNodeHandler> logger)
    {
        _repository = repository;
        _stateManager = stateManager;
        _logger = logger;
    }

    public async Task<string?> ExecuteAsync(
        JsonElement node,
        NodeExecutionContext context,
        INodeExecutionCallback engine,
        string? previousOutput)
    {
        var session = context.Session;
        var workflowConfig = context.WorkflowConfig;
        var workingDir = context.WorkingDir;
        var workflowId = context.WorkflowId;
        var displayTree = context.DisplayTree;

        var nodeId = node.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "for-each" : "for-each";
        var source = node.TryGetProperty("source", out var srcProp) ? srcProp.GetString() ?? "" : "";
        var itemIdField = node.TryGetProperty("itemId", out var iidProp) ? iidProp.GetString() ?? "id" : "id";
        var configLookup = !node.TryGetProperty("configLookup", out var clProp) || clProp.GetBoolean();

        if (string.IsNullOrEmpty(source))
        {
            _stateManager.AppendExecutionLog(session, "error", $"for-each '{nodeId}': missing 'source' property");
            throw new InvalidOperationException($"for-each '{nodeId}': missing 'source' property");
        }

        var items = ResolveForEachSource(session, source, nodeId);
        if (items == null || items.Count == 0)
        {
            var sourceVar = session.GetVariable(source);
            var errorMsg = $"for-each '{nodeId}': source '{source}' is empty or not a list (type: {sourceVar?.GetType().Name ?? "null"})";
            _stateManager.AppendExecutionLog(session, "error", errorMsg);
            throw new InvalidOperationException(errorMsg);
        }

        // Read resetVariables from JSON config (data-driven, not hardcoded)
        var resetVars = new Dictionary<string, object?>();
        if (node.TryGetProperty("resetVariables", out var rvProp) && rvProp.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in rvProp.EnumerateObject())
            {
                resetVars[prop.Name] = prop.Value.ValueKind switch
                {
                    JsonValueKind.Number => prop.Value.TryGetInt32(out var i) ? (object)i : prop.Value.GetDouble(),
                    JsonValueKind.String => prop.Value.GetString() ?? "",
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    JsonValueKind.Array => new List<object>(),
                    _ => null
                };
            }
        }

        // Set for-each node to running in display tree
        _stateManager.UpdateNodeById(displayTree, nodeId, "running", $"0/{items.Count}");
        session.SetVariable("_executionTree", displayTree);

        _stateManager.AppendExecutionLog(session, "info", $"Entering for-each '{nodeId}' over '{source}' ({items.Count} items)");
        await _repository.SaveAsync(session);

        string? lastOutput = previousOutput;
        var itemIndex = 0;

        // Resume for-each from checkpoint if available (skip already-processed items)
        var foreachResumeIndex = 0;
        var foreachState = session.GetVariable("_workflowCheckpoint_foreachIndex") as Dictionary<string, object>;
        if (foreachState != null && foreachState.TryGetValue("nodeId", out var feId) && feId?.ToString() == nodeId)
        {
            if (foreachState.TryGetValue("currentIndex", out var feIdx))
            {
                foreachResumeIndex = feIdx is int fi ? fi : (int.TryParse(feIdx?.ToString(), out var parsed) ? parsed : 0);
                _stateManager.AppendExecutionLog(session, "info", $"Resuming for-each '{nodeId}' from item index {foreachResumeIndex}");
            }
            session.SetVariable("_workflowCheckpoint_foreachIndex", null);
        }

        var failCount = 0;

        foreach (var item in items)
        {
            if (item is not Dictionary<string, object> itemDict) continue;

            var itemId = itemDict.TryGetValue(itemIdField, out var idVal) ? idVal?.ToString() : null;
            if (string.IsNullOrEmpty(itemId)) continue;

            // Skip already-done items
            if (itemDict.TryGetValue("status", out var statusVal) && statusVal?.ToString() == "done")
            {
                itemIndex++;
                continue;
            }

            // Skip items below checkpoint resume index
            if (itemIndex < foreachResumeIndex)
            {
                _logger.LogInformation("Skipping for-each item '{ItemId}' (checkpoint resume, index {Index} < {ResumeIndex})",
                    itemId, itemIndex, foreachResumeIndex);
                _stateManager.AppendExecutionLog(session, "info", $"Skipped item '{itemId}' (checkpoint resume)");
                itemIndex++;
                continue;
            }

            itemIndex++;
            _logger.LogInformation("for-each '{NodeId}': starting item '{ItemId}' ({Index}/{Total})",
                nodeId, itemId, itemIndex, items.Count);

            var iterationConfig = configLookup
                ? SessionHelper.GetWorkflowConfig(session, workflowId, itemId) ?? workflowConfig
                : workflowConfig;

            // Reset scoped variables (data-driven from JSON)
            foreach (var (varName, defaultValue) in resetVars)
                session.SetVariable(varName, defaultValue ?? 0);

            // Handle plateau-based phases
            var phaseStopCondition = SessionHelper.GetConfigString(iterationConfig, "evaluation.stopCondition", "target");
            var originalTarget = SessionStateManager.ReadDoubleVariable(session, "targetFitness", 0.85);
            if (phaseStopCondition == "plateau")
            {
                session.SetVariable("targetFitness", 1.0);
                _stateManager.AppendExecutionLog(session, "info", $"Item '{itemId}' uses plateau detection (runs: {SessionHelper.GetConfigInt(iterationConfig, "evaluation.plateauRuns", 5)})");
            }

            var phaseId = itemDict.TryGetValue("phaseId", out var pidVal) ? pidVal?.ToString() : null;

            if (itemDict.ContainsKey("status") && itemId != null)
                _stateManager.UpdatePhaseStatus(session, itemId, "running", 0);
            if (phaseId != null && phaseId != itemId)
                _stateManager.UpdatePhaseStatus(session, phaseId, "running", 0);

            // Reset child nodes in display tree for this iteration
            var forEachTreeNode = _stateManager.FindNodeById(displayTree, nodeId);
            if (forEachTreeNode != null &&
                forEachTreeNode.TryGetValue("children", out var childrenObj) &&
                childrenObj is List<object> childrenList)
            {
                _stateManager.ResetNodeTree(childrenList);
            }

            // Save for-each checkpoint state
            session.SetVariable("_workflowCheckpoint_foreachIndex", new Dictionary<string, object>
            {
                ["nodeId"] = nodeId,
                ["currentIndex"] = itemIndex,
                ["totalItems"] = items.Count
            });

            _stateManager.UpdateNodeById(displayTree, nodeId, "running", $"Item {itemIndex}/{items.Count}: {itemId}");
            session.SetVariable("_executionTree", displayTree);
            _stateManager.AppendExecutionLog(session, "info", $"Starting item '{itemId}' ({itemIndex}/{items.Count})");
            await _repository.SaveAsync(session);

            // Expose current item as template-accessible session variables
            session.SetVariable("_currentItem", itemDict);
            try
            {
                session.SetVariable("_currentItemJson", JsonSerializer.Serialize(itemDict));
            }
            catch
            {
                session.SetVariable("_currentItemJson", itemId ?? "");
            }

            // Execute child nodes — clear checkpoints first so they re-execute for this new item
            if (node.TryGetProperty("nodes", out var children) && children.ValueKind == JsonValueKind.Array)
            {
                ClearChildNodeCheckpoints(session, children);
                lastOutput = await engine.ExecuteConfigNodesAsync(
                    session, children, iterationConfig, workingDir, workflowId, itemId, displayTree, lastOutput);
            }

            if (phaseStopCondition == "plateau")
                session.SetVariable("targetFitness", originalTarget);

            var itemFailed = ProcessForEachItemResult(session, lastOutput, itemId, phaseId, phaseStopCondition, itemDict);
            if (itemFailed) failCount++;
            await _repository.SaveAsync(session);
        }

        // For-each loop done
        var forEachStatus = failCount == items.Count ? "error" : "done";
        var forEachSummary = failCount > 0
            ? $"Completed: {items.Count} items ({failCount} failed)"
            : $"Completed: {items.Count} items";
        _stateManager.UpdateNodeById(displayTree, nodeId, forEachStatus, forEachSummary);
        session.SetVariable("_executionTree", displayTree);
        var forEachLogLevel = failCount == items.Count ? "error" : (failCount > 0 ? "warning" : "success");
        _stateManager.AppendExecutionLog(session, forEachLogLevel, $"for-each '{nodeId}' completed ({items.Count} items, {failCount} failed)");
        await _repository.SaveAsync(session);

        return lastOutput;
    }

    // ===== Private helpers (moved from NodeExecutionEngine) =====

    private List<object>? ResolveForEachSource(ProjectSession session, string source, string nodeId)
    {
        SessionStateManager.NormalizeJsonElementToList(session, source);

        var rawSourceVar = session.GetVariable(source);
        if (rawSourceVar is string sourceStr && !string.IsNullOrWhiteSpace(sourceStr))
        {
            var bracketStart = sourceStr.IndexOf('[');
            var bracketEnd = sourceStr.LastIndexOf(']');
            if (bracketStart >= 0 && bracketEnd > bracketStart)
            {
                var jsonCandidate = sourceStr.Substring(bracketStart, bracketEnd - bracketStart + 1);
                try
                {
                    var parsed = JArray.Parse(jsonCandidate);
                    if (parsed != null && parsed.Count > 0)
                    {
                        session.SetVariable(source, parsed);
                        SessionStateManager.NormalizeJsonElementToList(session, source);
                        var normalized = session.GetVariable(source);
                        var count = normalized is List<object> nl ? nl.Count : 0;
                        _stateManager.AppendExecutionLog(session, "info", $"for-each '{nodeId}': parsed source string into {count} items");
                    }
                }
                catch (Newtonsoft.Json.JsonException ex)
                {
                    _logger.LogWarning(ex, "for-each '{NodeId}': failed to parse source string as JSON array", nodeId);
                }
            }
        }

        SessionStateManager.NormalizeJsonElementToList(session, source);
        var sourceVar = session.GetVariable(source);

        if (sourceVar is JsonElement directJsonEl)
        {
            _logger.LogWarning("for-each '{NodeId}': source is still JsonElement (kind={Kind}), converting directly",
                nodeId, directJsonEl.ValueKind);
            sourceVar = ConvertJsonElementToList(session, source, nodeId, directJsonEl) ?? sourceVar;
        }

        if (sourceVar is JArray jArrSource)
        {
            _logger.LogWarning("for-each '{NodeId}': source is JArray ({Count} items), normalizing", nodeId, jArrSource.Count);
            SessionStateManager.NormalizeJsonElementToList(session, source);
            sourceVar = session.GetVariable(source);
        }
        else if (sourceVar is JValue jVal && jVal.Type == JTokenType.String)
        {
            var jStr = jVal.Value<string>();
            if (!string.IsNullOrEmpty(jStr) && jStr.TrimStart().StartsWith("["))
            {
                try
                {
                    var arr = JArray.Parse(jStr);
                    session.SetVariable(source, arr);
                    SessionStateManager.NormalizeJsonElementToList(session, source);
                    sourceVar = session.GetVariable(source);
                    _stateManager.AppendExecutionLog(session, "info", $"for-each '{nodeId}': parsed JValue string to list");
                }
                catch { /* fallthrough */ }
            }
        }
        else if (sourceVar is JObject jObjSource)
        {
            _logger.LogWarning("for-each '{NodeId}': source is JObject, attempting array extraction", nodeId);
            JArray? extractedArr = null;
            string? extractField = null;

            foreach (var prop in jObjSource.Properties())
            {
                if (prop.Value is JArray directArr && directArr.Count > 0)
                {
                    extractedArr = directArr;
                    extractField = prop.Name;
                    break;
                }
            }

            if (extractedArr == null)
            {
                foreach (var prop in jObjSource.Properties())
                {
                    if (prop.Value.Type == JTokenType.String)
                    {
                        var embedded = SessionHelper.TryExtractJsonArrayFromText(prop.Value.Value<string>());
                        if (embedded != null)
                        {
                            extractedArr = embedded;
                            extractField = prop.Name;
                            break;
                        }
                    }
                }
            }

            if (extractedArr != null && extractedArr.Count > 0)
            {
                var list = SessionHelper.JArrayToNativeList(extractedArr);
                session.SetVariable(source, list);
                sourceVar = list;
                _stateManager.AppendExecutionLog(session, "info",
                    $"for-each '{nodeId}': extracted {list.Count} items from JObject property '{extractField}'");
            }
        }

        return sourceVar as List<object>;
    }

    private object? ConvertJsonElementToList(ProjectSession session, string source, string nodeId, JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Array)
        {
            var directList = new List<object>();
            foreach (var item in element.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.Object)
                {
                    var dict = new Dictionary<string, object>();
                    foreach (var prop in item.EnumerateObject())
                    {
                        dict[prop.Name] = prop.Value.ValueKind switch
                        {
                            JsonValueKind.String => prop.Value.GetString()!,
                            JsonValueKind.Number => prop.Value.TryGetInt64(out var lng) ? (object)lng : prop.Value.GetDouble(),
                            JsonValueKind.True => true,
                            JsonValueKind.False => false,
                            _ => prop.Value.ToString()!
                        };
                    }
                    directList.Add(dict);
                }
                else
                {
                    directList.Add(item.ToString()!);
                }
            }
            if (directList.Count > 0)
            {
                session.SetVariable(source, directList);
                _stateManager.AppendExecutionLog(session, "info",
                    $"for-each '{nodeId}': directly converted JsonElement to {directList.Count} items");
                return directList;
            }
        }
        else if (element.ValueKind == JsonValueKind.String)
        {
            var strContent = element.GetString();
            if (!string.IsNullOrEmpty(strContent))
            {
                var bracketStart = strContent.IndexOf('[');
                var bracketEnd = strContent.LastIndexOf(']');
                if (bracketStart >= 0 && bracketEnd > bracketStart)
                {
                    try
                    {
                        var innerParsed = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(
                            strContent.Substring(bracketStart, bracketEnd - bracketStart + 1));
                        if (innerParsed != null && innerParsed.Count > 0)
                        {
                            var innerList = new List<object>();
                            foreach (var dict in innerParsed)
                            {
                                var converted = new Dictionary<string, object>();
                                foreach (var kv in dict)
                                {
                                    converted[kv.Key] = kv.Value.ValueKind switch
                                    {
                                        JsonValueKind.String => kv.Value.GetString()!,
                                        JsonValueKind.Number => kv.Value.TryGetInt64(out var lng) ? (object)lng : kv.Value.GetDouble(),
                                        JsonValueKind.True => true,
                                        JsonValueKind.False => false,
                                        _ => kv.Value.ToString()!
                                    };
                                }
                                innerList.Add(converted);
                            }
                            session.SetVariable(source, innerList);
                            _stateManager.AppendExecutionLog(session, "info",
                                $"for-each '{nodeId}': parsed JsonElement string to {innerList.Count} items");
                            return innerList;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "for-each '{NodeId}': failed to parse JsonElement string content", nodeId);
                    }
                }
            }
        }
        return null;
    }

    private bool ProcessForEachItemResult(
        ProjectSession session,
        string? lastOutput,
        string? itemId,
        string? phaseId,
        string phaseStopCondition,
        Dictionary<string, object> itemDict)
    {
        var fitness = phaseStopCondition == "plateau"
            ? SessionStateManager.ReadDoubleVariable(session, "_bestFitness", SessionStateManager.ReadDoubleVariable(session, "currentFitness", 0))
            : SessionStateManager.ReadDoubleVariable(session, "currentFitness", 0);
        var iteration = SessionStateManager.ReadIntVariable(session, "currentIteration", 0);
        var tokens = SessionStateManager.ReadIntVariable(session, "_tokenCount", 0);

        var itemFailed = false;
        if (lastOutput is string lastOutputStr)
        {
            itemFailed = lastOutputStr.StartsWith("Error:", StringComparison.OrdinalIgnoreCase)
                || lastOutputStr.Contains("\"error\":", StringComparison.OrdinalIgnoreCase);
        }
        if (!string.IsNullOrEmpty(session.GetVariable<string>("_lastExecutionError", "")))
            itemFailed = true;

        var itemStatus = itemFailed ? "error" : "done";
        if (itemDict.ContainsKey("status") && itemId != null)
        {
            _stateManager.UpdatePhaseStatus(session, itemId, itemStatus);
            _stateManager.StorePhaseSummary(session, itemId, iteration, fitness);
        }
        if (phaseId != null && phaseId != itemId)
        {
            _stateManager.UpdatePhaseStatus(session, phaseId, itemStatus);
            _stateManager.StorePhaseSummary(session, phaseId, iteration, fitness);
        }

        var logMsg = $"Item '{itemId}' {(itemFailed ? "failed" : "completed")} (fitness: {fitness:F2}, iterations: {iteration}";
        if (tokens > 0) logMsg += $", ~{tokens} tokens";
        _stateManager.AppendExecutionLog(session, itemFailed ? "error" : "success", logMsg + ")");

        return itemFailed;
    }

    /// <summary>
    /// Recursively collects all node IDs from a JSON array of nodes.
    /// </summary>
    internal static void CollectNodeIdsRecursive(JsonElement nodes, HashSet<string> ids)
    {
        if (nodes.ValueKind != JsonValueKind.Array) return;
        foreach (var node in nodes.EnumerateArray())
        {
            if (node.TryGetProperty("id", out var idProp))
                ids.Add(idProp.GetString() ?? "");

            if (node.TryGetProperty("nodes", out var childNodes) && childNodes.ValueKind == JsonValueKind.Array)
                CollectNodeIdsRecursive(childNodes, ids);

            if (node.TryGetProperty("branches", out var branches) && branches.ValueKind == JsonValueKind.Object)
            {
                foreach (var branch in branches.EnumerateObject())
                {
                    if (branch.Value.TryGetProperty("nodes", out var branchNodes) && branchNodes.ValueKind == JsonValueKind.Array)
                        CollectNodeIdsRecursive(branchNodes, ids);
                }
            }
        }
    }

    private void ClearChildNodeCheckpoints(ProjectSession session, JsonElement childNodes)
    {
        var childNodeIds = new HashSet<string>();
        CollectNodeIdsRecursive(childNodes, childNodeIds);

        var currentCheckpoint = session.GetVariable("_workflowCheckpoint") as List<object>;
        if (currentCheckpoint != null && childNodeIds.Count > 0)
        {
            currentCheckpoint.RemoveAll(entry =>
                entry is Dictionary<string, object> dict
                && dict.TryGetValue("nodeId", out var nid)
                && childNodeIds.Contains(nid?.ToString() ?? ""));
            session.SetVariable("_workflowCheckpoint", currentCheckpoint);
        }
    }
}
