using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.Sessions.NodeHandlers;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Sessions;

// === ARCHITECTURE RULE (2026-03-05, updated 2026-03-06) ===
// NodeExecutionEngine is PURE CONTROL FLOW.
// It executes while, conditional, sequence, parallel, phase.
// Specialized node types (for-each, set-variable, blockRef) are handled
// by INodeHandler implementations registered at construction time.
// The engine NEVER executes block logic itself — it orchestrates.
// No LLM calls, no file I/O, no shell commands here.
// New node types = new INodeHandler class, zero engine changes.
// ============================================================

/// <summary>
/// Pure control flow engine for workflow node execution.
/// Delegates specialized node types to INodeHandler implementations.
/// Handles directly: while, conditional, sequence, parallel, phase (tightly
/// coupled to checkpoint/resume and display tree management).
///
/// ARCHITECTURE (Phase 53-A): Extracted from EntryPointExecutor.
/// ARCHITECTURE (Phase 53-C): Decomposed via INodeHandler for extensibility.
/// </summary>
public class NodeExecutionEngine : INodeExecutionCallback
{
    private readonly IProjectSessionRepository _repository;
    private readonly ISessionStateManager _stateManager;
    private readonly ILogger<NodeExecutionEngine> _logger;

    // Handler registry: nodeType -> handler (null key = blockRef default handler)
    private readonly Dictionary<string?, INodeHandler> _handlers;

    public NodeExecutionEngine(
        IProjectSessionRepository repository,
        ISessionStateManager stateManager,
        ILogger<NodeExecutionEngine> logger,
        IEnumerable<INodeHandler> handlers)
    {
        _repository = repository;
        _stateManager = stateManager;
        _logger = logger;

        _handlers = new Dictionary<string?, INodeHandler>();
        foreach (var handler in handlers)
            _handlers[handler.NodeType] = handler;
    }

    /// <summary>
    /// Gets the handler for blockRef nodes (NodeType == null).
    /// Used by the engine's own control flow nodes to dispatch inline blockRefs.
    /// </summary>
    private INodeHandler? BlockRefHandler => _handlers.TryGetValue(null, out var h) ? h : null;

    // ===== Config-Driven Node Execution =====

    /// <summary>
    /// Walks config.nodes from the workflow block JSON and executes based on node type.
    /// Control flow nodes (while, conditional, sequence, parallel, phase) are handled inline.
    /// All other node types are dispatched to INodeHandler implementations.
    /// </summary>
    public async Task<string?> ExecuteConfigNodesAsync(
        Domain.Entities.ProjectSession session,
        JsonElement configNodes,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        string workflowId,
        string? activePhaseId,
        List<object> displayTree,
        string? previousOutput = null)
    {
        string? lastOutput = previousOutput;

        // Read checkpoint to build set of already-completed node IDs (enables resume after crash)
        var completedNodeIds = new HashSet<string>();
        string? checkpointLastOutput = null;
        var checkpointVar = session.GetVariable("_workflowCheckpoint");
        if (checkpointVar is List<object> checkpointList)
        {
            foreach (var entry in checkpointList)
            {
                if (entry is Dictionary<string, object> dict && dict.TryGetValue("nodeId", out var nid))
                {
                    completedNodeIds.Add(nid?.ToString() ?? "");
                    if (dict.TryGetValue("previousOutput", out var po))
                        checkpointLastOutput = po?.ToString();
                }
            }
        }
        if (checkpointLastOutput != null && lastOutput == null)
            lastOutput = checkpointLastOutput;

        foreach (var configNode in configNodes.EnumerateArray())
        {
            if (configNode.ValueKind != JsonValueKind.Object) continue;

            var nodeId = configNode.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "unknown" : "unknown";
            var nodeType = configNode.TryGetProperty("type", out var typeProp) ? typeProp.GetString() : null;

            // Auto-update _phases for top-level nodes
            string? autoPhaseId = null;
            if (activePhaseId == null)
            {
                autoPhaseId = configNode.TryGetProperty("phaseId", out var phaseIdProp)
                    && phaseIdProp.ValueKind == JsonValueKind.String
                    ? phaseIdProp.GetString()
                    : nodeId;

                if (_stateManager.UpdatePhaseStatus(session, autoPhaseId!, "running", 0))
                    await _repository.SaveAsync(session);
            }

            // Skip already-completed nodes on checkpoint resume
            if (completedNodeIds.Contains(nodeId))
            {
                _logger.LogInformation("Skipping already-completed node '{NodeId}' (checkpoint resume)", nodeId);
                _stateManager.AppendExecutionLog(session, "info", $"Skipped '{nodeId}' (checkpoint resume)");
                var savedResult = session.GetVariable($"_nodeResult_{nodeId}");
                if (savedResult != null)
                    lastOutput = savedResult.ToString();
                continue;
            }

            try
            {
                await CheckPauseAsync(session, nodeId);

                var context = new NodeExecutionContext
                {
                    Session = session,
                    WorkflowConfig = workflowConfig,
                    WorkingDir = workingDir,
                    WorkflowId = workflowId,
                    ActivePhaseId = activePhaseId,
                    DisplayTree = displayTree
                };

                // Check if we have a registered handler for this node type
                if (nodeType != null && _handlers.TryGetValue(nodeType, out var handler))
                {
                    lastOutput = await handler.ExecuteAsync(configNode, context, this, lastOutput);
                }
                else
                {
                    // Built-in control flow nodes + blockRef fallback
                    switch (nodeType)
                    {
                        case "while":
                            lastOutput = await ExecuteWhileNodeAsync(session, configNode, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, lastOutput);
                            break;
                        case "conditional":
                            lastOutput = await ExecuteConditionalNodeAsync(session, configNode, workflowConfig, workingDir, displayTree, lastOutput);
                            break;
                        case "sequence":
                            lastOutput = await ExecuteSequenceNodeAsync(session, configNode, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, lastOutput);
                            break;
                        case "parallel":
                            lastOutput = await ExecuteParallelNodeAsync(session, configNode, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, lastOutput);
                            break;
                        case "phase":
                            lastOutput = await ExecutePhaseNodeInlineAsync(session, configNode, workflowConfig, workingDir, workflowId, displayTree, lastOutput);
                            break;
                        default:
                        {
                            // Default: blockRef dispatch via handler
                            var blockRef = NodeHandlers.BlockRefHandler.ResolveBlockRef(configNode, nodeId, session);
                            if (blockRef != null)
                            {
                                var displayName = SessionStateManager.NodeIdToDisplayName(nodeId);
                                _stateManager.UpdateNodeById(displayTree, nodeId, "running", $"Executing {blockRef}...");
                                _stateManager.SetActiveBlock(session, nodeId, displayName, "block", "running");
                                session.SetVariable("_executionTree", displayTree);
                                await _repository.SaveAsync(session);

                                lastOutput = await BlockRefHandler!.ExecuteAsync(configNode, context, this, lastOutput);

                                var truncated = lastOutput != null && lastOutput.Length > 500 ? lastOutput[..500] + "..." : lastOutput;
                                _stateManager.UpdateNodeById(displayTree, nodeId, "done", truncated);
                                _stateManager.UpdateActiveBlockOutput(session, lastOutput != null && lastOutput.Length > 2000 ? lastOutput[..2000] + "..." : lastOutput ?? "");
                                _stateManager.UpdateActiveBlockStatus(session, "done");
                                _stateManager.StoreBlockOutput(session, nodeId, "block", lastOutput ?? "");
                                session.SetVariable("_executionTree", displayTree);
                                session.SetVariable($"_nodeResult_{nodeId}", lastOutput ?? "");
                                await _repository.SaveAsync(session);
                                await Task.Delay(500);
                            }
                            else if (configNode.TryGetProperty("nodes", out var orphanNodes)
                                && orphanNodes.ValueKind == JsonValueKind.Array && orphanNodes.GetArrayLength() > 0)
                            {
                                throw new InvalidOperationException(
                                    $"Node '{nodeId}' has {orphanNodes.GetArrayLength()} child nodes but no 'type'. " +
                                    "Declare type (sequence, parallel, while, for-each, conditional) in the workflow block JSON.");
                            }
                            else
                            {
                                lastOutput = lastOutput ?? $"Node '{nodeId}' executed (passthrough — no blockRef)";
                                _stateManager.UpdateNodeById(displayTree, nodeId, "done", "passthrough (no blockRef)");
                                session.SetVariable("_executionTree", displayTree);
                                session.SetVariable($"_nodeResult_{nodeId}", lastOutput);
                                await _repository.SaveAsync(session);
                            }
                            break;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Config node execution failed: {NodeId}", nodeId);
                _stateManager.UpdateNodeById(displayTree, nodeId, "error", $"(error: {ex.Message})");
                session.SetVariable("_executionTree", displayTree);
                _stateManager.AppendExecutionLog(session, "error", $"{nodeId}: {ex.Message}");

                if (autoPhaseId != null)
                    _stateManager.UpdatePhaseStatus(session, autoPhaseId, "error");

                await _repository.SaveAsync(session);

                var continueOnError = configNode.TryGetProperty("continueOnError", out var coeProp)
                    && coeProp.ValueKind == JsonValueKind.True;
                if (!continueOnError)
                {
                    _stateManager.AppendExecutionLog(session, "warning", $"Stopping sequence: node '{nodeId}' failed");
                    await _repository.SaveAsync(session);
                    break;
                }
                continue;
            }

            // Save checkpoint after successful node execution
            var checkpoint = session.GetVariable("_workflowCheckpoint") as List<object> ?? new List<object>();
            checkpoint.Add(new Dictionary<string, object>
            {
                ["nodeId"] = nodeId,
                ["status"] = "completed",
                ["timestamp"] = DateTime.UtcNow.ToString("o"),
                ["previousOutput"] = lastOutput ?? ""
            });
            session.SetVariable("_workflowCheckpoint", checkpoint);

            if (autoPhaseId != null && _stateManager.UpdatePhaseStatus(session, autoPhaseId, "done"))
                await _repository.SaveAsync(session);
        }

        return lastOutput;
    }

    // ===== INodeExecutionCallback (for handler callbacks) =====

    Task<string?> INodeExecutionCallback.ExecuteConfigNodesAsync(
        Domain.Entities.ProjectSession session,
        JsonElement configNodes,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        string workflowId,
        string? activePhaseId,
        List<object> displayTree,
        string? previousOutput)
    {
        return ExecuteConfigNodesAsync(session, configNodes, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, previousOutput);
    }

    Task<string?> INodeExecutionCallback.ExecuteBlockRefAsync(
        Domain.Entities.ProjectSession session,
        string blockRefId,
        JsonElement phaseNode,
        string workingDir,
        List<object> displayTree,
        string nodeId,
        string? previousOutput)
    {
        if (BlockRefHandler == null)
            throw new InvalidOperationException("No BlockRefHandler registered — cannot execute blockRef");

        var context = new NodeExecutionContext
        {
            Session = session,
            WorkflowConfig = null,
            WorkingDir = workingDir,
            WorkflowId = "",
            ActivePhaseId = null,
            DisplayTree = displayTree
        };

        return BlockRefHandler.ExecuteAsync(phaseNode, context, this, previousOutput);
    }

    // ===== Built-in Control Flow Nodes =====
    // These remain inline because they are tightly coupled to:
    // - Checkpoint/resume (while state, iteration tracking)
    // - Display tree management (nested children reset)
    // - Recursive dispatch (parallel re-dispatches child types)

    private async Task<string?> ExecuteWhileNodeAsync(
        Domain.Entities.ProjectSession session,
        JsonElement whileNode,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        string workflowId,
        string? activePhaseId,
        List<object> displayTree,
        string? previousOutput)
    {
        var nodeId = whileNode.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "while" : "while";
        var condition = whileNode.TryGetProperty("condition", out var condProp) ? condProp.GetString() ?? "false" : "false";

        var maxIterStr = "50";
        if (whileNode.TryGetProperty("maxIterations", out var maxProp))
        {
            maxIterStr = maxProp.ValueKind == JsonValueKind.Number
                ? maxProp.GetInt32().ToString()
                : maxProp.GetString() ?? "50";
        }
        var resolvedMax = TemplateResolver.ResolveTemplate(maxIterStr, session);
        var safetyMaxIterations = int.TryParse(resolvedMax, out var mi) ? mi : 50;

        _stateManager.UpdateNodeById(displayTree, nodeId, "running");
        session.SetVariable("_executionTree", displayTree);

        var iteration = 0;
        string? lastOutput = previousOutput;

        // Resume while loop from checkpoint
        var whileState = session.GetVariable("_workflowCheckpoint_whileState") as Dictionary<string, object>;
        if (whileState != null && whileState.TryGetValue("nodeId", out var wsId) && wsId?.ToString() == nodeId)
        {
            if (whileState.TryGetValue("iteration", out var wsIter))
            {
                var resumeIter = wsIter is int ri ? ri : (int.TryParse(wsIter?.ToString(), out var parsed) ? parsed : 0);
                iteration = resumeIter;
                _stateManager.AppendExecutionLog(session, "info", $"Resuming while '{nodeId}' at iteration {iteration}");
            }
            session.SetVariable("_workflowCheckpoint_whileState", null);
        }

        session.SetVariable("iteration", iteration);
        session.SetVariable("currentIteration", iteration);

        _stateManager.AppendExecutionLog(session, "info", $"Entering while loop '{nodeId}' (max: {safetyMaxIterations})");
        await _repository.SaveAsync(session);

        while (iteration < safetyMaxIterations && ConditionEvaluator.EvaluateCondition(condition, session))
        {
            if (session.GetVariable<bool>("_shouldStop", false))
            {
                _stateManager.AppendExecutionLog(session, "info", $"Early stop: plateau detected at iteration {iteration}");
                break;
            }

            iteration++;
            session.SetVariable("iteration", iteration);
            session.SetVariable("currentIteration", iteration);

            _stateManager.AppendExecutionLog(session, "info", $"While '{nodeId}': iteration {iteration}/{safetyMaxIterations}");

            if (!string.IsNullOrEmpty(activePhaseId))
            {
                var progress = (int)((double)iteration / safetyMaxIterations * 100);
                _stateManager.UpdatePhaseStatus(session, activePhaseId, "running", Math.Min(progress, 99));
            }

            _stateManager.UpdateNodeById(displayTree, nodeId, "running", $"Iteration {iteration}/{safetyMaxIterations}");
            session.SetVariable("_executionTree", displayTree);

            if (iteration > 1)
            {
                var whileTreeNode = _stateManager.FindNodeById(displayTree, nodeId);
                if (whileTreeNode != null &&
                    whileTreeNode.TryGetValue("children", out var childrenObj) &&
                    childrenObj is List<object> childrenList)
                {
                    _stateManager.ResetNodeTree(childrenList);
                }
                session.SetVariable("_executionTree", displayTree);
            }

            await _repository.SaveAsync(session);

            session.SetVariable("_workflowCheckpoint_whileState", new Dictionary<string, object>
            {
                ["nodeId"] = nodeId,
                ["iteration"] = iteration,
                ["maxIterations"] = safetyMaxIterations
            });

            if (whileNode.TryGetProperty("nodes", out var children) && children.ValueKind == JsonValueKind.Array)
            {
                ClearChildNodeCheckpoints(session, children);
                lastOutput = await ExecuteConfigNodesAsync(session, children, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, lastOutput);
            }

            var fitness = SessionStateManager.ReadDoubleVariable(session, "currentFitness", 0);
            _stateManager.StoreIterationMetrics(session, activePhaseId, iteration, fitness);
            _stateManager.AppendExecutionLog(session, "info", $"Iteration {iteration} complete. Fitness: {fitness:F2}");
            await _repository.SaveAsync(session);
        }

        var finalFitness = SessionStateManager.ReadDoubleVariable(session, "currentFitness", 0);
        var earlyStopped = session.GetVariable<bool>("_shouldStop", false);
        string exitReason;
        if (earlyStopped)
            exitReason = $"plateau (best: {SessionStateManager.ReadDoubleVariable(session, "_bestFitness", 0):F2}, no improvement for {SessionStateManager.ReadIntVariable(session, "_plateauCount", 0)} runs)";
        else if (!ConditionEvaluator.EvaluateCondition(condition, session))
            exitReason = $"condition met (fitness: {finalFitness:F2})";
        else
            exitReason = $"max iterations reached ({iteration}/{safetyMaxIterations})";

        _stateManager.UpdateNodeById(displayTree, nodeId, "done", $"Completed: {exitReason}");
        session.SetVariable("_executionTree", displayTree);

        _stateManager.AppendExecutionLog(session, "success", $"While loop '{nodeId}' completed after {iteration} iterations: {exitReason}");
        await _repository.SaveAsync(session);

        return lastOutput;
    }

    private async Task<string?> ExecuteConditionalNodeAsync(
        Domain.Entities.ProjectSession session,
        JsonElement condNode,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        List<object> displayTree,
        string? previousOutput)
    {
        var nodeId = condNode.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "conditional" : "conditional";
        var condition = condNode.TryGetProperty("condition", out var condProp) ? condProp.GetString() ?? "true" : "true";

        var resolvedCondition = TemplateResolver.ResolveTemplate(condition, session);
        var condResult = ConditionEvaluator.EvaluateCondition(resolvedCondition, session);
        _stateManager.AppendExecutionLog(session, "info", $"Conditional '{nodeId}': '{condition}' -> '{resolvedCondition}' -> {condResult}");

        _stateManager.UpdateNodeById(displayTree, nodeId, "running", $"Condition: {condResult}");
        _stateManager.SetActiveBlock(session, nodeId, SessionStateManager.NodeIdToDisplayName(nodeId), "conditional", "running");
        session.SetVariable("_executionTree", displayTree);
        await _repository.SaveAsync(session);

        string? output;

        if (condNode.TryGetProperty("branches", out var branchesObj) && branchesObj.ValueKind == JsonValueKind.Object)
        {
            output = await ExecuteMultiWayBranchAsync(session, nodeId, branchesObj, resolvedCondition, workflowConfig, workingDir, displayTree, previousOutput);
        }
        else
        {
            var branchName = condResult ? "then" : "else";
            output = await ExecuteBinaryBranchAsync(session, nodeId, condNode, branchName, workflowConfig, workingDir, displayTree, previousOutput);
        }

        output ??= previousOutput ?? "";
        var truncated = output.Length > 500 ? output[..500] + "..." : output;
        _stateManager.UpdateNodeById(displayTree, nodeId, "done", truncated);
        session.SetVariable("_executionTree", displayTree);
        _stateManager.UpdateActiveBlockOutput(session, output.Length > 2000 ? output[..2000] + "..." : output);
        _stateManager.UpdateActiveBlockStatus(session, "done");
        _stateManager.StoreBlockOutput(session, nodeId, "conditional", output);
        session.SetVariable($"_nodeResult_{nodeId}", output);
        _stateManager.AppendExecutionLog(session, "success", $"{nodeId}: Completed ({output.Length} chars)");
        await _repository.SaveAsync(session);
        return output;
    }

    private async Task<string?> ExecuteMultiWayBranchAsync(
        Domain.Entities.ProjectSession session,
        string nodeId,
        JsonElement branchesObj,
        string resolvedCondition,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        List<object> displayTree,
        string? previousOutput)
    {
        _stateManager.AppendExecutionLog(session, "info", $"Conditional '{nodeId}': multi-way branch, key='{resolvedCondition}'");
        var branchKey = resolvedCondition.Trim().Trim('"');

        if (branchesObj.TryGetProperty(branchKey, out var selectedBranch) && selectedBranch.ValueKind == JsonValueKind.Object)
        {
            try
            {
                return await ExecuteBranchBodyAsync(session, selectedBranch, branchKey, workflowConfig, workingDir, nodeId, displayTree, previousOutput);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Multi-way branch '{BranchKey}' failed in '{NodeId}'", branchKey, nodeId);
                return $"(error in branch '{branchKey}': {ex.Message})";
            }
        }

        if (branchesObj.TryGetProperty("default", out var defaultBranch) && defaultBranch.ValueKind == JsonValueKind.Object)
        {
            _stateManager.AppendExecutionLog(session, "info", $"Conditional '{nodeId}': no branch for '{branchKey}', using default");
            return await ExecuteBranchBodyAsync(session, defaultBranch, "default", workflowConfig, workingDir, nodeId, displayTree, previousOutput);
        }

        _stateManager.AppendExecutionLog(session, "warning", $"Conditional '{nodeId}': no branch for '{branchKey}' and no default");
        return null;
    }

    private async Task<string?> ExecuteBinaryBranchAsync(
        Domain.Entities.ProjectSession session,
        string nodeId,
        JsonElement condNode,
        string branchName,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        List<object> displayTree,
        string? previousOutput)
    {
        if (!condNode.TryGetProperty(branchName, out var branchNode) || branchNode.ValueKind != JsonValueKind.Object)
        {
            _stateManager.AppendExecutionLog(session, "warning",
                $"{nodeId}: Conditional without '{branchName}' branch — passthrough.");
            return previousOutput;
        }

        try
        {
            return await ExecuteBranchBodyAsync(session, branchNode, branchName, workflowConfig, workingDir, nodeId, displayTree, previousOutput);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Conditional '{Branch}' branch execution failed: {NodeId}", branchName, nodeId);
            _stateManager.UpdateActiveBlockStatus(session, "error");
            _stateManager.AppendExecutionLog(session, "error", $"{nodeId}: {ex.Message}");
            await _repository.SaveAsync(session);
            return $"(error in '{branchName}' branch: {ex.Message})";
        }
    }

    private async Task<string?> ExecuteBranchBodyAsync(
        Domain.Entities.ProjectSession session,
        JsonElement branchNode,
        string branchId,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        string parentNodeId,
        List<object> displayTree,
        string? previousOutput)
    {
        var resolvedRef = NodeHandlers.BlockRefHandler.ResolveBlockRef(branchNode, branchId, session);
        if (resolvedRef != null)
        {
            var id = branchNode.TryGetProperty("id", out var brIdProp) ? brIdProp.GetString() ?? branchId : branchId;
            _stateManager.AppendExecutionLog(session, "info", $"Conditional '{parentNodeId}': executing '{branchId}' -> blockRef '{resolvedRef}'");

            var branchContext = new NodeExecutionContext
            {
                Session = session,
                WorkflowConfig = workflowConfig,
                WorkingDir = workingDir,
                WorkflowId = "",
                ActivePhaseId = null,
                DisplayTree = displayTree
            };
            var output = await BlockRefHandler!.ExecuteAsync(branchNode, branchContext, this, previousOutput);
            session.SetVariable($"_nodeResult_{id}", output ?? "");
            return output;
        }

        if (branchNode.TryGetProperty("nodes", out var nodesEl) && nodesEl.ValueKind == JsonValueKind.Array)
            return await ExecuteConfigNodesAsync(session, nodesEl, workflowConfig, workingDir, parentNodeId, null, displayTree, previousOutput);

        return null;
    }

    private async Task<string?> ExecuteSequenceNodeAsync(
        Domain.Entities.ProjectSession session,
        JsonElement seqNode,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        string workflowId,
        string? activePhaseId,
        List<object> displayTree,
        string? previousOutput)
    {
        var nodeId = seqNode.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "sequence" : "sequence";

        _stateManager.UpdateNodeById(displayTree, nodeId, "running");
        session.SetVariable("_executionTree", displayTree);
        _stateManager.AppendExecutionLog(session, "info", $"Sequence '{nodeId}': Starting");
        await _repository.SaveAsync(session);

        string? lastOutput = previousOutput;

        if (seqNode.TryGetProperty("children", out var children) && children.ValueKind == JsonValueKind.Array)
        {
            lastOutput = await ExecuteConfigNodesAsync(session, children, workflowConfig, workingDir, workflowId, nodeId, displayTree, lastOutput);
        }
        else if (seqNode.TryGetProperty("nodes", out var nodes) && nodes.ValueKind == JsonValueKind.Array)
        {
            lastOutput = await ExecuteConfigNodesAsync(session, nodes, workflowConfig, workingDir, workflowId, nodeId, displayTree, lastOutput);
        }

        _stateManager.UpdateNodeById(displayTree, nodeId, "done");
        session.SetVariable("_executionTree", displayTree);
        _stateManager.AppendExecutionLog(session, "success", $"Sequence '{nodeId}': Completed");
        await _repository.SaveAsync(session);

        return lastOutput;
    }

    private async Task<string?> ExecuteParallelNodeAsync(
        Domain.Entities.ProjectSession session,
        JsonElement parallelNode,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        string workflowId,
        string? activePhaseId,
        List<object> displayTree,
        string? previousOutput)
    {
        var nodeId = parallelNode.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "parallel" : "parallel";

        _stateManager.UpdateNodeById(displayTree, nodeId, "running");
        session.SetVariable("_executionTree", displayTree);
        _stateManager.AppendExecutionLog(session, "info", $"Parallel '{nodeId}': Starting children in parallel");
        await _repository.SaveAsync(session);

        JsonElement childrenEl = default;
        var hasChildren = parallelNode.TryGetProperty("children", out childrenEl) && childrenEl.ValueKind == JsonValueKind.Array;
        if (!hasChildren)
            hasChildren = parallelNode.TryGetProperty("nodes", out childrenEl) && childrenEl.ValueKind == JsonValueKind.Array;

        if (!hasChildren)
        {
            _stateManager.AppendExecutionLog(session, "warning", $"Parallel '{nodeId}': No children found");
            _stateManager.UpdateNodeById(displayTree, nodeId, "done", "No children");
            session.SetVariable("_executionTree", displayTree);
            await _repository.SaveAsync(session);
            return previousOutput;
        }

        var results = new List<string?>();

        foreach (var child in childrenEl.EnumerateArray())
        {
            if (child.ValueKind != JsonValueKind.Object) continue;

            var childId = child.TryGetProperty("id", out var cIdProp) ? cIdProp.GetString() ?? "child" : "child";

            try
            {
                var childType = child.TryGetProperty("type", out var ctProp) ? ctProp.GetString() : null;

                string? result;

                // Check for registered handler first
                if (childType != null && _handlers.TryGetValue(childType, out var handler))
                {
                    var childContext = new NodeExecutionContext
                    {
                        Session = session,
                        WorkflowConfig = workflowConfig,
                        WorkingDir = workingDir,
                        WorkflowId = workflowId,
                        ActivePhaseId = activePhaseId,
                        DisplayTree = displayTree
                    };
                    result = await handler.ExecuteAsync(child, childContext, this, previousOutput);
                }
                else
                {
                    switch (childType)
                    {
                        case "sequence":
                            result = await ExecuteSequenceNodeAsync(session, child, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, previousOutput);
                            break;
                        case "while":
                            result = await ExecuteWhileNodeAsync(session, child, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, previousOutput);
                            break;
                        case "conditional":
                            result = await ExecuteConditionalNodeAsync(session, child, workflowConfig, workingDir, displayTree, previousOutput);
                            break;
                        default:
                        {
                            var blockRef = NodeHandlers.BlockRefHandler.ResolveBlockRef(child, childId, session);
                            if (blockRef != null)
                            {
                                _stateManager.UpdateNodeById(displayTree, childId, "running", $"Executing {blockRef}...");
                                session.SetVariable("_executionTree", displayTree);
                                await _repository.SaveAsync(session);

                                var blockContext = new NodeExecutionContext
                                {
                                    Session = session,
                                    WorkflowConfig = workflowConfig,
                                    WorkingDir = workingDir,
                                    WorkflowId = workflowId,
                                    ActivePhaseId = activePhaseId,
                                    DisplayTree = displayTree
                                };
                                result = await BlockRefHandler!.ExecuteAsync(child, blockContext, this, previousOutput);
                                _stateManager.UpdateNodeById(displayTree, childId, "done");
                                session.SetVariable("_executionTree", displayTree);
                                session.SetVariable($"_nodeResult_{childId}", result ?? "");
                                await _repository.SaveAsync(session);
                            }
                            else
                            {
                                result = previousOutput;
                                _stateManager.UpdateNodeById(displayTree, childId, "done", "passthrough (no blockRef)");
                                session.SetVariable("_executionTree", displayTree);
                            }
                            break;
                        }
                    }
                }
                results.Add(result);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Parallel child '{ChildId}' failed in '{NodeId}'", childId, nodeId);
                _stateManager.AppendExecutionLog(session, "error", $"Parallel child '{childId}': {ex.Message}");
                results.Add(previousOutput);
            }
        }

        var mainOutput = results.Count > 0 ? results[0] : previousOutput;

        _stateManager.UpdateNodeById(displayTree, nodeId, "done", $"All {results.Count} children completed");
        session.SetVariable("_executionTree", displayTree);
        _stateManager.AppendExecutionLog(session, "success", $"Parallel '{nodeId}': All {results.Count} children completed");
        await _repository.SaveAsync(session);

        return mainOutput;
    }

    private async Task<string?> ExecutePhaseNodeInlineAsync(
        Domain.Entities.ProjectSession session,
        JsonElement phaseNode,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        string workflowId,
        List<object> displayTree,
        string? previousOutput)
    {
        var nodeId = phaseNode.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "phase" : "phase";
        var configSection = phaseNode.TryGetProperty("configSection", out var csProp) ? csProp.GetString() ?? nodeId : nodeId;
        var phaseConfig = SessionHelper.GetWorkflowConfig(session, workflowId, configSection) ?? workflowConfig;

        _stateManager.UpdatePhaseStatus(session, configSection, "running", 0);
        _stateManager.UpdateNodeById(displayTree, nodeId, "running", configSection);
        session.SetVariable("_executionTree", displayTree);
        _stateManager.AppendExecutionLog(session, "info", $"Starting phase '{configSection}'");
        await _repository.SaveAsync(session);

        string? lastOutput = previousOutput;
        if (phaseNode.TryGetProperty("nodes", out var children) && children.ValueKind == JsonValueKind.Array)
        {
            lastOutput = await ExecuteConfigNodesAsync(
                session, children, phaseConfig, workingDir, workflowId, configSection, displayTree, lastOutput);
        }
        else if (phaseNode.TryGetProperty("blockRef", out var blockRefProp) && blockRefProp.ValueKind == JsonValueKind.String)
        {
            var blockRefId = TemplateResolver.ResolveTemplate(blockRefProp.GetString()!, session);
            var phaseContext = new NodeExecutionContext
            {
                Session = session,
                WorkflowConfig = phaseConfig,
                WorkingDir = workingDir,
                WorkflowId = workflowId,
                ActivePhaseId = configSection,
                DisplayTree = displayTree
            };
            // Create a synthetic node element for the blockRef dispatch
            lastOutput = await BlockRefHandler!.ExecuteAsync(phaseNode, phaseContext, this, previousOutput);
        }

        var fitness = SessionStateManager.ReadDoubleVariable(session, "currentFitness", 0);
        var iteration = SessionStateManager.ReadIntVariable(session, "currentIteration", 0);
        _stateManager.StoreIterationMetrics(session, configSection, Math.Max(iteration, 1), fitness);
        _stateManager.UpdatePhaseStatus(session, configSection, "done");
        _stateManager.StorePhaseSummary(session, configSection, Math.Max(iteration, 1), fitness);
        _stateManager.UpdateNodeById(displayTree, nodeId, "done", $"Phase '{configSection}' complete (fitness: {fitness:F2})");
        session.SetVariable("_executionTree", displayTree);
        _stateManager.AppendExecutionLog(session, "success", $"Phase '{configSection}' completed (fitness: {fitness:F2})");
        await _repository.SaveAsync(session);

        return lastOutput;
    }

    // ===== Private utilities =====

    private async Task CheckPauseAsync(Domain.Entities.ProjectSession session, string nodeId)
    {
        const int pollIntervalMs = 1000;
        const int maxPauseMs = 300_000;
        var elapsed = 0;

        while (true)
        {
            var freshSession = await _repository.GetByIdAsync(SessionId.From(session.Id));
            if (freshSession == null) return;

            var status = freshSession.GetVariable("_workflowStatus")?.ToString();
            if (status != "paused") return;

            if (elapsed >= maxPauseMs)
            {
                _logger.LogWarning("Pause timeout reached ({MaxMs}ms) for node '{NodeId}'. Resuming.", maxPauseMs, nodeId);
                session.SetVariable("_workflowStatus", "running");
                await _repository.SaveAsync(session);
                return;
            }

            _stateManager.AppendExecutionLog(session, "info", $"Workflow paused at node '{nodeId}'. Waiting...");
            await _repository.SaveAsync(session);
            await Task.Delay(pollIntervalMs);
            elapsed += pollIntervalMs;
        }
    }

    /// <summary>
    /// Clears checkpoint entries for child node IDs so they aren't skipped
    /// on the next iteration of a loop (while).
    /// </summary>
    private static void ClearChildNodeCheckpoints(Domain.Entities.ProjectSession session, JsonElement childNodes)
    {
        var childNodeIds = new HashSet<string>();
        ForEachNodeHandler.CollectNodeIdsRecursive(childNodes, childNodeIds);

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
