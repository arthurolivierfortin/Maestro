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
//
// COST LIMIT ENFORCEMENT (Phase 59-PRE-2-A):
// When BlockRefHandler detects a cost limit with enforcement="block",
// it returns a string starting with COST_LIMIT_STOPPED_PREFIX.
// The engine detects this signal and performs a graceful stop:
// - Stops the node loop cleanly (no exception thrown)
// - Clears _activeWorkflow (session becomes idle, NOT error)
// - Preserves ALL session variables
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
    /// <summary>
    /// Prefix used by BlockRefHandler to signal a cost-limit-stopped condition.
    /// When DispatchNodeAsync returns a string starting with this prefix,
    /// the engine performs a graceful stop instead of continuing to the next node.
    /// </summary>
    internal const string COST_LIMIT_STOPPED_PREFIX = "[COST-LIMIT-STOPPED]";

    private readonly IProjectSessionRepository _repository;
    private readonly ISessionStateManager _stateManager;
    private readonly ILogger<NodeExecutionEngine> _logger;

    // Handler registry: nodeType -> handler
    private readonly Dictionary<string, INodeHandler> _handlers;
    private INodeHandler? _blockRefHandler; // Handler for blockRef nodes (NodeType == null)

    public NodeExecutionEngine(
        IProjectSessionRepository repository,
        ISessionStateManager stateManager,
        ILogger<NodeExecutionEngine> logger,
        IEnumerable<INodeHandler> handlers)
    {
        _repository = repository;
        _stateManager = stateManager;
        _logger = logger;

        _handlers = new Dictionary<string, INodeHandler>();
        foreach (var handler in handlers)
        {
            if (handler.NodeType == null)
                _blockRefHandler = handler;
            else
                _handlers[handler.NodeType] = handler;
        }
    }

    /// <summary>
    /// Gets the handler for blockRef nodes (NodeType == null).
    /// Used by the engine's own control flow nodes to dispatch inline blockRefs.
    /// </summary>
    private INodeHandler? BlockRefHandler => _blockRefHandler;

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

                lastOutput = await DispatchNodeAsync(configNode, nodeId, nodeType, context, lastOutput);

                // === Cost limit graceful stop (Phase 59-PRE-2-A) ===
                // BlockRefHandler returns [COST-LIMIT-STOPPED] prefix when enforcement="block"
                if (lastOutput != null && lastOutput.StartsWith(COST_LIMIT_STOPPED_PREFIX))
                {
                    _logger.LogInformation("Cost limit graceful stop at node '{NodeId}'. Stopping node loop cleanly.", nodeId);
                    _stateManager.UpdateNodeById(displayTree, nodeId, "cost-limit-stopped", lastOutput);
                    session.SetVariable("_executionTree", displayTree);

                    // Graceful stop: clear _activeWorkflow so session becomes idle (NOT error)
                    _stateManager.GracefulCostStop(session);

                    _stateManager.AppendExecutionLog(session, "warning",
                        $"Graceful cost stop at node '{nodeId}'. Session is idle (resumable).");
                    await _repository.SaveAsync(session);
                    break; // Exit the node loop cleanly
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

    // ===== Single Node Dispatch =====

    /// <summary>
    /// Dispatches a single config node to the appropriate handler or built-in control flow.
    /// Order: registered INodeHandler → built-in switch → blockRef fallback → passthrough.
    /// This is the SINGLE dispatch point — used by both ExecuteConfigNodesAsync and ExecuteParallelNodeAsync.
    /// </summary>
    private async Task<string?> DispatchNodeAsync(
        JsonElement configNode,
        string nodeId,
        string? nodeType,
        NodeExecutionContext context,
        string? previousOutput)
    {
        var session = context.Session;
        var displayTree = context.DisplayTree;

        // 1. Registered handler (for-each, set-variable, or any future node type)
        if (nodeType != null && _handlers.TryGetValue(nodeType, out var handler))
            return await handler.ExecuteAsync(configNode, context, this, previousOutput);

        // 2. Built-in control flow
        switch (nodeType)
        {
            case "while":
                return await ExecuteWhileNodeAsync(session, configNode, context.WorkflowConfig, context.WorkingDir, context.WorkflowId, context.ActivePhaseId, displayTree, previousOutput);
            case "conditional":
                return await ExecuteConditionalNodeAsync(session, configNode, context.WorkflowConfig, context.WorkingDir, displayTree, previousOutput);
            case "sequence":
                return await ExecuteSequenceNodeAsync(session, configNode, context.WorkflowConfig, context.WorkingDir, context.WorkflowId, context.ActivePhaseId, displayTree, previousOutput);
            case "parallel":
                return await ExecuteParallelNodeAsync(session, configNode, context.WorkflowConfig, context.WorkingDir, context.WorkflowId, context.ActivePhaseId, displayTree, previousOutput);
            case "phase":
                return await ExecutePhaseNodeInlineAsync(session, configNode, context.WorkflowConfig, context.WorkingDir, context.WorkflowId, displayTree, previousOutput);
        }

        // 3. BlockRef dispatch
        var blockRef = NodeHandlers.BlockRefHandler.ResolveBlockRef(configNode, nodeId, session);
        if (blockRef != null)
        {
            var displayName = SessionStateManager.NodeIdToDisplayName(nodeId);
            _stateManager.UpdateNodeById(displayTree, nodeId, "running", $"Executing {blockRef}...");
            _stateManager.SetActiveBlock(session, nodeId, displayName, "block", "running");
            session.SetVariable("_executionTree", displayTree);
            await _repository.SaveAsync(session);

            var output = await BlockRefHandler!.ExecuteAsync(configNode, context, this, previousOutput);

            // If cost-limit-stopped, propagate the signal up without marking as "done"
            if (output != null && output.StartsWith(COST_LIMIT_STOPPED_PREFIX))
            {
                _stateManager.UpdateNodeById(displayTree, nodeId, "cost-limit-stopped", output);
                _stateManager.UpdateActiveBlockStatus(session, "cost-limit-stopped");
                session.SetVariable("_executionTree", displayTree);
                session.SetVariable($"_nodeResult_{nodeId}", output);
                await _repository.SaveAsync(session);
                return output; // Propagate signal to ExecuteConfigNodesAsync
            }

            var truncated = output != null && output.Length > 500 ? output[..500] + "..." : output;
            _stateManager.UpdateNodeById(displayTree, nodeId, "done", truncated);
            _stateManager.UpdateActiveBlockOutput(session, output != null && output.Length > 2000 ? output[..2000] + "..." : output ?? "");
            _stateManager.UpdateActiveBlockStatus(session, "done");
            _stateManager.StoreBlockOutput(session, nodeId, "block", output ?? "");
            session.SetVariable("_executionTree", displayTree);
            session.SetVariable($"_nodeResult_{nodeId}", output ?? "");
            await _repository.SaveAsync(session);
            await Task.Delay(500);
            return output;
        }

        // 4. Guard: node with children but no type
        if (configNode.TryGetProperty("nodes", out var orphanNodes)
            && orphanNodes.ValueKind == JsonValueKind.Array && orphanNodes.GetArrayLength() > 0)
        {
            throw new InvalidOperationException(
                $"Node '{nodeId}' has {orphanNodes.GetArrayLength()} child nodes but no 'type'. " +
                "Declare type (sequence, parallel, while, for-each, conditional) in the workflow block JSON.");
        }

        // 5. Passthrough
        var passthroughOutput = previousOutput ?? $"Node '{nodeId}' executed (passthrough — no blockRef)";
        _stateManager.UpdateNodeById(displayTree, nodeId, "done", "passthrough (no blockRef)");
        session.SetVariable("_executionTree", displayTree);
        session.SetVariable($"_nodeResult_{nodeId}", passthroughOutput);
        await _repository.SaveAsync(session);
        return passthroughOutput;
    }

    // ===== Built-in Control Flow Nodes =====

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

        // === Loop detection state (Phase 61-B) ===
        // Track recent tool calls to detect stuck agents.
        // Only active for agent while loops (those that set _nodeResult_parse-response).
        var recentToolCalls = new List<string>();
        var uniqueToolTypesSeen = new HashSet<string>();
        var noNewToolTypeCount = 0;

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

            // === Loop detection: track tool calls after each iteration (Phase 61-B) ===
            var parseResultVar = session.GetVariable("_nodeResult_parse-response");
            if (parseResultVar != null)
            {
                var toolId = TemplateResolver.ExtractJsonSubPath(parseResultVar, "toolId");
                if (!string.IsNullOrEmpty(toolId))
                {
                    // Create composite key for loop detection: same tool + same args = loop
                    // Different args = different work, should not trigger loop detection
                    var toolArgs = TemplateResolver.ExtractJsonSubPath(parseResultVar, "args");
                    var loopKey = !string.IsNullOrEmpty(toolArgs)
                        ? $"{toolId}:{toolArgs.GetHashCode()}"
                        : toolId;
                    recentToolCalls.Add(loopKey);

                    // Use extracted loop detection helper
                    var loopResult = DetectLoop(recentToolCalls);
                    if (loopResult == LoopDetectionResult.ForceStop)
                    {
                        var loopingTool = ExtractToolIdFromLoopKey(GetLoopingToolId(recentToolCalls)!);
                        _stateManager.AppendExecutionLog(session, "error",
                            $"Agent stuck in loop: tool '{loopingTool}' called 5 times consecutively with same args. Forcing stop.");
                        _logger.LogWarning(
                            "Agent stuck in loop in while '{NodeId}': tool '{ToolId}' called 5 times with same args. Forcing stop.",
                            nodeId, loopingTool);
                        session.SetVariable("_agentDone", "true");
                        session.SetVariable("_agentResult",
                            $"Stopped: agent stuck in loop calling '{loopingTool}' repeatedly with same args");
                        await _repository.SaveAsync(session);
                        break;
                    }
                    else if (loopResult == LoopDetectionResult.Warning)
                    {
                        var loopingTool = ExtractToolIdFromLoopKey(GetLoopingToolId(recentToolCalls)!);
                        _stateManager.AppendExecutionLog(session, "warning",
                            $"Agent may be stuck: tool '{loopingTool}' called 3 times consecutively with same args");
                        _logger.LogWarning(
                            "Potential loop in while '{NodeId}': tool '{ToolId}' called 3 times consecutively with same args.",
                            nodeId, loopingTool);
                    }

                    // === Progress detection (Phase 61-B) ===
                    // If the same tool type is used for 3+ consecutive iterations with no new type, warn.
                    if (uniqueToolTypesSeen.Add(toolId))
                    {
                        // New tool type seen — reset stale counter
                        noNewToolTypeCount = 0;
                    }
                    else
                    {
                        noNewToolTypeCount++;
                        if (noNewToolTypeCount >= 3 && toolId != "step-complete" && toolId != "file-write" && toolId != "file-edit")
                        {
                            _stateManager.AppendExecutionLog(session, "warning",
                                $"No progress: no new tool type for {noNewToolTypeCount} iterations (last: '{toolId}')");
                            session.SetVariable("_progressWarning", "true");
                        }
                    }
                }
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
            var childType = child.TryGetProperty("type", out var ctProp) ? ctProp.GetString() : null;

            try
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
                results.Add(await DispatchNodeAsync(child, childId, childType, childContext, previousOutput));
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

    // ===== Loop Detection (Phase 61-B) =====

    /// <summary>
    /// Result of loop detection analysis on recent tool calls.
    /// </summary>
    internal enum LoopDetectionResult
    {
        /// <summary>No loop detected.</summary>
        None,
        /// <summary>Warning: 3 consecutive identical tool calls.</summary>
        Warning,
        /// <summary>Loop confirmed: 5 consecutive identical tool calls. Agent should be stopped.</summary>
        ForceStop
    }

    /// <summary>
    /// Analyzes recent tool calls for loop patterns.
    /// Returns ForceStop if the last 5 calls are identical (and not step-complete).
    /// Returns Warning if the last 3 calls are identical (and not step-complete).
    /// Returns None otherwise.
    /// </summary>
    internal static LoopDetectionResult DetectLoop(IReadOnlyList<string> recentToolCalls)
    {
        if (recentToolCalls.Count >= 5)
        {
            var last5 = recentToolCalls.Skip(recentToolCalls.Count - 5).ToList();
            if (last5.All(t => t == last5[0]) && ExtractToolIdFromLoopKey(last5[0]) != "step-complete")
            {
                return LoopDetectionResult.ForceStop;
            }
        }

        if (recentToolCalls.Count >= 3)
        {
            var last3 = recentToolCalls.Skip(recentToolCalls.Count - 3).ToList();
            if (last3.All(t => t == last3[0]) && ExtractToolIdFromLoopKey(last3[0]) != "step-complete")
            {
                return LoopDetectionResult.Warning;
            }
        }

        return LoopDetectionResult.None;
    }

    /// <summary>
    /// Gets the tool ID that caused the loop (for error messages).
    /// Returns the last tool call in the list, or null if empty.
    /// </summary>
    internal static string? GetLoopingToolId(IReadOnlyList<string> recentToolCalls)
    {
        return recentToolCalls.Count > 0 ? recentToolCalls[recentToolCalls.Count - 1] : null;
    }

    /// <summary>
    /// Extracts the tool ID from a composite loop key (format: "toolId:argsHash" or just "toolId").
    /// Used for display messages and step-complete exclusion checks.
    /// </summary>
    internal static string ExtractToolIdFromLoopKey(string loopKey)
    {
        var colonIndex = loopKey.IndexOf(':');
        return colonIndex >= 0 ? loopKey.Substring(0, colonIndex) : loopKey;
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
