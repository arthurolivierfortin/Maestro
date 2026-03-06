using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;
using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Sessions;

// === ARCHITECTURE RULE (2026-03-05) ===
// NodeExecutionEngine is PURE CONTROL FLOW.
// It executes while, conditional, sequence, parallel, for-each, set-variable.
// When it encounters a blockRef, it dispatches via BlockExecutorRegistry.
// It NEVER executes logic itself — it orchestrates.
// No LLM calls, no file I/O, no shell commands here.
// ============================================================

/// <summary>
/// Pure control flow engine for workflow node execution.
/// Handles: while, conditional, sequence, parallel, for-each, set-variable, blockRef dispatch.
///
/// ARCHITECTURE (Phase 53-A): Extracted from EntryPointExecutor to separate
/// control flow orchestration from state management (SessionStateManager) and
/// entry point logic (EntryPointExecutor).
/// </summary>
public class NodeExecutionEngine
{
    private readonly IProjectSessionRepository _repository;
    private readonly ILLMGateway _llmGateway;
    private readonly IBlockDiscoveryService _blockDiscovery;
    private readonly BlockExecutors.BlockExecutorRegistry? _executorRegistry;
    private readonly ISessionStateManager _stateManager;
    private readonly ILogger<NodeExecutionEngine> _logger;

    public NodeExecutionEngine(
        IProjectSessionRepository repository,
        ILLMGateway llmGateway,
        IBlockDiscoveryService blockDiscovery,
        ISessionStateManager stateManager,
        ILogger<NodeExecutionEngine> logger,
        BlockExecutors.BlockExecutorRegistry? executorRegistry = null)
    {
        _repository = repository;
        _llmGateway = llmGateway;
        _blockDiscovery = blockDiscovery;
        _stateManager = stateManager;
        _logger = logger;
        _executorRegistry = executorRegistry;
    }

    // ===== Node Execution =====

    /// <summary>
    /// Executes tree nodes sequentially, updating session state after each.
    /// </summary>
    public async Task ExecuteNodesAsync(
        Domain.Entities.ProjectSession session,
        List<object> tree,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        string? activePhaseId)
    {
        string? previousOutput = null;
        var totalNodes = tree.Count;

        for (int i = 0; i < tree.Count; i++)
        {
            if (tree[i] is not Dictionary<string, object> nodeDict) continue;

            var nodeId = nodeDict["id"]?.ToString() ?? "unknown";
            var nodeName = nodeDict["name"]?.ToString() ?? nodeId;

            // Set running
            _stateManager.UpdateNodeById(tree, nodeId, "running");
            session.SetVariable("_executionTree", tree);
            _stateManager.SetActiveBlock(session, nodeId, nodeName, SessionStateManager.InferBlockType(nodeId), "running");
            _stateManager.AppendExecutionLog(session, "info", $"{nodeId}: Starting...");

            if (!string.IsNullOrEmpty(activePhaseId))
            {
                var progress = (int)((double)i / totalNodes * 100);
                _stateManager.UpdatePhaseStatus(session, activePhaseId, "running", progress);
            }

            await _repository.SaveAsync(session);

            string output;
            try
            {
                output = await DispatchRegularNodeAsync(session, nodeId, workflowConfig, workingDir, activePhaseId, tree, previousOutput) ?? "";
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Node execution failed: {NodeId}", nodeId);
                output = $"(error: {ex.Message})";
                _stateManager.UpdateNodeById(tree, nodeId, "error", output);
                session.SetVariable("_executionTree", tree);
                _stateManager.UpdateActiveBlockStatus(session, "error");
                _stateManager.AppendExecutionLog(session, "error", $"{nodeId}: {ex.Message}");
                await _repository.SaveAsync(session);
                continue;
            }

            var truncatedOutput = output.Length > 500 ? output[..500] + "..." : output;
            _stateManager.UpdateNodeById(tree, nodeId, "done", truncatedOutput);
            session.SetVariable("_executionTree", tree);
            _stateManager.UpdateActiveBlockOutput(session, output.Length > 2000 ? output[..2000] + "..." : output);
            _stateManager.UpdateActiveBlockStatus(session, "done");
            _stateManager.AppendExecutionLog(session, "success", $"{nodeId}: Completed ({output.Length} chars)");
            _stateManager.StoreBlockOutput(session, nodeId, SessionStateManager.InferBlockType(nodeId), output);

            await _repository.SaveAsync(session);
            await Task.Delay(500);

            previousOutput = output;
        }
    }

    // ===== Config-Driven Node Execution (generic while/conditional support) =====

    /// <summary>
    /// Walks config.nodes from the workflow block JSON and executes based on node type.
    /// Regular nodes are executed directly. "while" and "conditional" nodes are
    /// dispatched to their respective handlers. This is the GENERIC infrastructure
    /// that reads control flow from block JSON — no session-specific logic here.
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

            // Auto-update _phases for top-level nodes (activePhaseId == null).
            // Nested contexts (for-each, while, phase) manage their own phase status.
            //
            // Phase mapping priority:
            //   1. Explicit "phaseId" property on the node (allows N-to-1 mapping)
            //   2. Fall back to the node's own "id" (convention: nodeId == phaseId)
            //
            // UpdatePhaseStatus returns false if no phase matched, avoiding unnecessary saves.
            // This is fully data-driven: the template defines which phases exist,
            // the workflow nodes optionally declare which phase they belong to.
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
                // Restore the _nodeResult for this node (needed by downstream template resolution)
                var savedResult = session.GetVariable($"_nodeResult_{nodeId}");
                if (savedResult != null)
                    lastOutput = savedResult.ToString();
                continue;
            }

            try
            {
                // Check for pause before each node execution
                await CheckPauseAsync(session, nodeId);

                switch (nodeType)
                {
                    case "while":
                        lastOutput = await ExecuteWhileNodeAsync(session, configNode, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, lastOutput);
                        break;
                    case "for-each":
                        lastOutput = await ExecuteForEachNodeAsync(session, configNode, workflowConfig, workingDir, workflowId, displayTree, lastOutput);
                        break;
                    case "phase":
                        lastOutput = await ExecutePhaseNodeInlineAsync(session, configNode, workflowConfig, workingDir, workflowId, displayTree, lastOutput);
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
                    case "set-variable":
                        lastOutput = ExecuteSetVariableNode(session, configNode, lastOutput);
                        _stateManager.UpdateNodeById(displayTree, nodeId, "done", $"Variable set");
                        session.SetVariable("_executionTree", displayTree);
                        break;
                    default:
                        lastOutput = await DispatchRegularNodeAsync(session, nodeId, workflowConfig, workingDir, activePhaseId, displayTree, lastOutput, configNode);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Config node execution failed: {NodeId}", nodeId);
                _stateManager.UpdateNodeById(displayTree, nodeId, "error", $"(error: {ex.Message})");
                session.SetVariable("_executionTree", displayTree);
                _stateManager.AppendExecutionLog(session, "error", $"{nodeId}: {ex.Message}");

                // Mark phase as error (top-level only)
                if (autoPhaseId != null)
                    _stateManager.UpdatePhaseStatus(session, autoPhaseId, "error");

                await _repository.SaveAsync(session);

                // Stop sequence on error by default (aligned with "no silent failures" principle).
                // Nodes can opt-in to "continueOnError": true for non-critical steps.
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

            // Save checkpoint after successful node execution (enables resume after crash)
            var checkpoint = session.GetVariable("_workflowCheckpoint") as List<object> ?? new List<object>();
            checkpoint.Add(new Dictionary<string, object>
            {
                ["nodeId"] = nodeId,
                ["status"] = "completed",
                ["timestamp"] = DateTime.UtcNow.ToString("o"),
                ["previousOutput"] = lastOutput ?? ""
            });
            session.SetVariable("_workflowCheckpoint", checkpoint);

            // Mark phase as done after node completes (top-level only)
            if (autoPhaseId != null && _stateManager.UpdatePhaseStatus(session, autoPhaseId, "done"))
                await _repository.SaveAsync(session);
        }

        return lastOutput;
    }

    /// <summary>
    /// Generic while loop execution. Reads condition and maxIterations from block JSON,
    /// evaluates condition using session variables, and loops through children.
    /// Phase progress is updated as iteration/maxIterations.
    /// </summary>
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

        // Read maxIterations from block config (may be a template reference)
        var maxIterStr = "50";
        if (whileNode.TryGetProperty("maxIterations", out var maxProp))
        {
            maxIterStr = maxProp.ValueKind == JsonValueKind.Number
                ? maxProp.GetInt32().ToString()
                : maxProp.GetString() ?? "50";
        }
        var resolvedMax = ResolveTemplate(maxIterStr, session);
        var safetyMaxIterations = int.TryParse(resolvedMax, out var mi) ? mi : 50;

        // Set while node to running in display tree
        _stateManager.UpdateNodeById(displayTree, nodeId, "running");
        session.SetVariable("_executionTree", displayTree);

        var iteration = 0;
        string? lastOutput = previousOutput;

        // Resume while loop from checkpoint if available
        var whileState = session.GetVariable("_workflowCheckpoint_whileState") as Dictionary<string, object>;
        if (whileState != null && whileState.TryGetValue("nodeId", out var wsId) && wsId?.ToString() == nodeId)
        {
            if (whileState.TryGetValue("iteration", out var wsIter))
            {
                var resumeIter = wsIter is int ri ? ri : (int.TryParse(wsIter?.ToString(), out var parsed) ? parsed : 0);
                iteration = resumeIter;
                _stateManager.AppendExecutionLog(session, "info", $"Resuming while '{nodeId}' at iteration {iteration}");
            }
            // Clear the while state so it's not re-used on next normal execution
            session.SetVariable("_workflowCheckpoint_whileState", null);
        }

        // Initialize iteration variable for condition evaluation
        session.SetVariable("iteration", iteration);
        session.SetVariable("currentIteration", iteration);

        _stateManager.AppendExecutionLog(session, "info", $"Entering while loop '{nodeId}' (max: {safetyMaxIterations})");
        await _repository.SaveAsync(session);

        while (iteration < safetyMaxIterations && EvaluateCondition(condition, session))
        {
            // Check for early stop signal (plateau detection, etc.)
            if (session.GetVariable<bool>("_shouldStop", false))
            {
                _stateManager.AppendExecutionLog(session, "info", $"Early stop: plateau detected at iteration {iteration}");
                break;
            }

            iteration++;
            session.SetVariable("iteration", iteration);
            session.SetVariable("currentIteration", iteration);

            _stateManager.AppendExecutionLog(session, "info", $"While '{nodeId}': iteration {iteration}/{safetyMaxIterations}");

            // Update phase progress based on iteration
            if (!string.IsNullOrEmpty(activePhaseId))
            {
                var progress = (int)((double)iteration / safetyMaxIterations * 100);
                _stateManager.UpdatePhaseStatus(session, activePhaseId, "running", Math.Min(progress, 99));
            }

            // Update while node display with iteration info
            _stateManager.UpdateNodeById(displayTree, nodeId, "running", $"Iteration {iteration}/{safetyMaxIterations}");
            session.SetVariable("_executionTree", displayTree);

            // Reset children to pending for this iteration (except first)
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

            // Save while-loop checkpoint state (enables resume at correct iteration)
            session.SetVariable("_workflowCheckpoint_whileState", new Dictionary<string, object>
            {
                ["nodeId"] = nodeId,
                ["iteration"] = iteration,
                ["maxIterations"] = safetyMaxIterations
            });

            // Execute child nodes
            if (whileNode.TryGetProperty("nodes", out var children) && children.ValueKind == JsonValueKind.Array)
            {
                // CRITICAL: Clear child node IDs from _workflowCheckpoint before each iteration.
                // Without this, after iteration 1 completes "plan"/"validate-plan"/"plan-format-gate",
                // the checkpoint marks them as completed. At iteration 2, ExecuteConfigNodesAsync
                // sees them in the checkpoint and SKIPS them — even though they must re-execute.
                // Must collect RECURSIVELY to include nodes inside conditional branches.
                var childNodeIds = new HashSet<string>();
                CollectNodeIdsRecursive(children, childNodeIds);

                var currentCheckpoint = session.GetVariable("_workflowCheckpoint") as List<object>;
                if (currentCheckpoint != null && childNodeIds.Count > 0)
                {
                    currentCheckpoint.RemoveAll(entry =>
                        entry is Dictionary<string, object> dict
                        && dict.TryGetValue("nodeId", out var nid)
                        && childNodeIds.Contains(nid?.ToString() ?? ""));
                    session.SetVariable("_workflowCheckpoint", currentCheckpoint);
                }

                lastOutput = await ExecuteConfigNodesAsync(session, children, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, lastOutput);
            }

            // Log iteration result and store detailed metrics
            var fitness = SessionStateManager.ReadDoubleVariable(session, "currentFitness", 0);
            _stateManager.StoreIterationMetrics(session, activePhaseId, iteration, fitness);
            _stateManager.AppendExecutionLog(session, "info", $"Iteration {iteration} complete. Fitness: {fitness:F2}");
            await _repository.SaveAsync(session);
        }

        // While loop done
        var finalFitness = SessionStateManager.ReadDoubleVariable(session, "currentFitness", 0);
        var earlyStopped = session.GetVariable<bool>("_shouldStop", false);
        string exitReason;
        if (earlyStopped)
            exitReason = $"plateau (best: {SessionStateManager.ReadDoubleVariable(session, "_bestFitness", 0):F2}, no improvement for {SessionStateManager.ReadIntVariable(session, "_plateauCount", 0)} runs)";
        else if (!EvaluateCondition(condition, session))
            exitReason = $"condition met (fitness: {finalFitness:F2})";
        else
            exitReason = $"max iterations reached ({iteration}/{safetyMaxIterations})";

        _stateManager.UpdateNodeById(displayTree, nodeId, "done", $"Completed: {exitReason}");
        session.SetVariable("_executionTree", displayTree);

        _stateManager.AppendExecutionLog(session, "success", $"While loop '{nodeId}' completed after {iteration} iterations: {exitReason}");
        await _repository.SaveAsync(session);

        return lastOutput;
    }

    /// <summary>
    /// Generic conditional node execution. Reads condition from block JSON,
    /// evaluates it, and executes the node (then/else branch selection is
    /// a future evolution — uses branch nodes or passthrough).
    /// </summary>
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
        var displayName = SessionStateManager.NodeIdToDisplayName(nodeId);

        // Resolve template references in condition (e.g., {{_nodeResult_review}} or {{state.results.review}})
        var resolvedCondition = ResolveTemplate(condition, session);
        var condResult = EvaluateCondition(resolvedCondition, session);
        _stateManager.AppendExecutionLog(session, "info", $"Conditional '{nodeId}': '{condition}' → '{resolvedCondition}' → {condResult}");

        // Update display tree
        _stateManager.UpdateNodeById(displayTree, nodeId, "running", $"Condition: {condResult}");
        _stateManager.SetActiveBlock(session, nodeId, displayName, "conditional", "running");
        session.SetVariable("_executionTree", displayTree);
        await _repository.SaveAsync(session);

        // Multi-way branches: if "branches" property exists, use resolvedCondition as key
        if (condNode.TryGetProperty("branches", out var branchesObj) && branchesObj.ValueKind == JsonValueKind.Object)
        {
            _stateManager.AppendExecutionLog(session, "info", $"Conditional '{nodeId}': multi-way branch, key='{resolvedCondition}'");

            string? mwOutput = null;
            var branchKey = resolvedCondition.Trim().Trim('"'); // Remove surrounding quotes if any

            if (branchesObj.TryGetProperty(branchKey, out var selectedBranch) && selectedBranch.ValueKind == JsonValueKind.Object)
            {
                try
                {
                    if (selectedBranch.TryGetProperty("blockRef", out var brBlockRef) && brBlockRef.ValueKind == JsonValueKind.String)
                    {
                        var branchId = selectedBranch.TryGetProperty("id", out var brIdProp) ? brIdProp.GetString() ?? branchKey : branchKey;
                        mwOutput = await ExecuteBlockRefAsync(session, brBlockRef.GetString()!, selectedBranch, workingDir, displayTree, branchId, previousOutput);
                        session.SetVariable($"_nodeResult_{branchId}", mwOutput ?? "");
                    }
                    else if (selectedBranch.TryGetProperty("blockId", out var brBlockId) && brBlockId.ValueKind == JsonValueKind.String)
                    {
                        _logger.LogWarning("Multi-way branch '{BranchKey}' uses deprecated 'blockId' — use 'blockRef' instead", branchKey);
                        var branchId = selectedBranch.TryGetProperty("id", out var brIdProp) ? brIdProp.GetString() ?? branchKey : branchKey;
                        mwOutput = await ExecuteBlockRefAsync(session, brBlockId.GetString()!, selectedBranch, workingDir, displayTree, branchId, previousOutput);
                        session.SetVariable($"_nodeResult_{branchId}", mwOutput ?? "");
                    }
                    else if (selectedBranch.TryGetProperty("nodes", out var brNodes) && brNodes.ValueKind == JsonValueKind.Array)
                    {
                        mwOutput = await ExecuteConfigNodesAsync(session, brNodes, workflowConfig, workingDir, nodeId, null, displayTree, previousOutput);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Multi-way branch '{BranchKey}' failed in '{NodeId}'", branchKey, nodeId);
                    mwOutput = $"(error in branch '{branchKey}': {ex.Message})";
                }
            }
            else
            {
                // No matching branch — check for "default" branch
                if (branchesObj.TryGetProperty("default", out var defaultBranch) && defaultBranch.ValueKind == JsonValueKind.Object)
                {
                    _stateManager.AppendExecutionLog(session, "info", $"Conditional '{nodeId}': no branch for '{branchKey}', using default");
                    if (defaultBranch.TryGetProperty("blockRef", out var defBlockRef) && defBlockRef.ValueKind == JsonValueKind.String)
                    {
                        mwOutput = await ExecuteBlockRefAsync(session, defBlockRef.GetString()!, defaultBranch, workingDir, displayTree, "default", previousOutput);
                    }
                }
                else
                {
                    _stateManager.AppendExecutionLog(session, "warning", $"Conditional '{nodeId}': no branch for '{branchKey}' and no default");
                }
            }

            // Finalize
            mwOutput ??= previousOutput ?? "";
            var mwTruncated = mwOutput.Length > 500 ? mwOutput[..500] + "..." : mwOutput;
            _stateManager.UpdateNodeById(displayTree, nodeId, "done", mwTruncated);
            session.SetVariable("_executionTree", displayTree);
            session.SetVariable($"_nodeResult_{nodeId}", mwOutput);
            _stateManager.AppendExecutionLog(session, "success", $"{nodeId}: Multi-way branch completed");
            await _repository.SaveAsync(session);
            return mwOutput;
        }

        // Binary branches (existing behavior): then/else
        string? output = null;
        var branchName = condResult ? "then" : "else";
        var hasBranch = condNode.TryGetProperty(branchName, out var branchNode) && branchNode.ValueKind == JsonValueKind.Object;

        if (hasBranch)
        {
            try
            {
                // Branch node has a blockRef (or deprecated blockId) — dispatch it
                var hasBrBlockRef = branchNode.TryGetProperty("blockRef", out var brBlockRefProp) && brBlockRefProp.ValueKind == JsonValueKind.String;
                if (!hasBrBlockRef)
                {
                    hasBrBlockRef = branchNode.TryGetProperty("blockId", out brBlockRefProp) && brBlockRefProp.ValueKind == JsonValueKind.String;
                    if (hasBrBlockRef)
                        _logger.LogWarning("Conditional '{NodeId}' branch '{BranchName}' uses deprecated 'blockId' — use 'blockRef' instead", nodeId, branchName);
                }

                if (hasBrBlockRef)
                {
                    var branchId = branchNode.TryGetProperty("id", out var branchIdProp) ? branchIdProp.GetString() ?? branchName : branchName;
                    var blockRefId = ResolveTemplate(brBlockRefProp.GetString()!, session);
                    _stateManager.AppendExecutionLog(session, "info", $"Conditional '{nodeId}': executing '{branchName}' branch → blockRef '{blockRefId}'");
                    output = await ExecuteBlockRefAsync(session, blockRefId, branchNode, workingDir, displayTree, branchId, previousOutput);
                    session.SetVariable($"_nodeResult_{branchId}", output ?? "");
                }
                else
                {
                    // Branch has child nodes — execute them
                    if (branchNode.TryGetProperty("nodes", out var nodesEl) && nodesEl.ValueKind == JsonValueKind.Array)
                    {
                        output = await ExecuteConfigNodesAsync(session, nodesEl, workflowConfig, workingDir, nodeId, null, displayTree, previousOutput);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Conditional '{Branch}' branch execution failed: {NodeId}", branchName, nodeId);
                output = $"(error in '{branchName}' branch: {ex.Message})";
                _stateManager.UpdateNodeById(displayTree, nodeId, "error", output);
                session.SetVariable("_executionTree", displayTree);
                _stateManager.UpdateActiveBlockStatus(session, "error");
                _stateManager.AppendExecutionLog(session, "error", $"{nodeId}: {ex.Message}");
                await _repository.SaveAsync(session);
                return previousOutput;
            }
        }
        else
        {
            // No branch definition — passthrough with warning
            _logger.LogWarning("Conditional node '{NodeId}' has no then/else branches — treated as passthrough", nodeId);
            _stateManager.AppendExecutionLog(session, "warning",
                $"{nodeId}: Conditional without branches — passthrough. Add then/else nodes.");
            output = previousOutput;
        }

        // Set done
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

    /// <summary>
    /// Executes a sequence node — runs child nodes sequentially, passing output through.
    /// This is the named counterpart of the implicit behavior of ExecuteConfigNodesAsync
    /// but for nested sequence groups within a workflow.
    /// </summary>
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
        // Also support "nodes" property (alternative naming)
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

    /// <summary>
    /// Executes children in parallel using Task.WhenAll.
    /// Each child runs independently. When all complete, the parallel node is marked done.
    /// If any child fails, the error is logged but other children continue.
    ///
    /// IMPORTANT: The interaction-handler is typically one of the parallel children.
    /// It should be cancelled when the main workflow completes. This is handled by
    /// using a CancellationTokenSource that cancels when the first non-interaction child completes.
    /// For now (MVP), we use simple Task.WhenAll without cancellation.
    /// </summary>
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

        // Collect children from "children" or "nodes" property
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

        // Execute children sequentially to avoid shared-state race conditions.
        // The displayTree, session variables, and repository are shared mutable state.
        // True parallelism requires per-mutation locking across all Execute* methods.
        // TODO: Add proper SemaphoreSlim-based locking to enable true parallel execution
        // when the interaction-handler has a working executor.
        var results = new List<string?>();
        var childIds = new List<string>();

        foreach (var child in childrenEl.EnumerateArray())
        {
            if (child.ValueKind != JsonValueKind.Object) continue;

            var childId = child.TryGetProperty("id", out var cIdProp) ? cIdProp.GetString() ?? "child" : "child";
            childIds.Add(childId);

            try
            {
                var childType = child.TryGetProperty("type", out var ctProp) ? ctProp.GetString() : null;

                var result = childType switch
                {
                    "sequence" => await ExecuteSequenceNodeAsync(session, child, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, previousOutput),
                    "while" => await ExecuteWhileNodeAsync(session, child, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, previousOutput),
                    "for-each" => await ExecuteForEachNodeAsync(session, child, workflowConfig, workingDir, workflowId, displayTree, previousOutput),
                    "conditional" => await ExecuteConditionalNodeAsync(session, child, workflowConfig, workingDir, displayTree, previousOutput),
                    _ => await DispatchRegularNodeAsync(session, childId, workflowConfig, workingDir, activePhaseId, displayTree, previousOutput, child)
                };
                results.Add(result);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Parallel child '{ChildId}' failed in '{NodeId}'", childId, nodeId);
                _stateManager.AppendExecutionLog(session, "error", $"Parallel child '{childId}': {ex.Message}");
                results.Add(previousOutput);
            }
        }

        // Use the output of the first child as the "main" output (convention: first child is main-workflow)
        var mainOutput = results.Count > 0 ? results[0] : previousOutput;

        _stateManager.UpdateNodeById(displayTree, nodeId, "done", $"All {results.Count} children completed");
        session.SetVariable("_executionTree", displayTree);
        _stateManager.AppendExecutionLog(session, "success", $"Parallel '{nodeId}': All {results.Count} children completed");
        await _repository.SaveAsync(session);

        return mainOutput;
    }

    /// <summary>
    /// Checks if the workflow is paused (via session variable _workflowStatus).
    /// If paused, polls every 1 second until resumed or cancelled.
    /// This enables the interaction-handler to pause/resume the workflow.
    /// </summary>
    private async Task CheckPauseAsync(Domain.Entities.ProjectSession session, string nodeId)
    {
        const int pollIntervalMs = 1000;
        const int maxPauseMs = 300_000; // 5 minutes max pause
        var elapsed = 0;

        while (true)
        {
            // Re-read session from disk to get latest state (interaction-handler may have modified it)
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
    /// Sets a session variable from a template value or previousOutput.
    /// Config: { "type": "set-variable", "id": "store-plan", "variable": "_planSteps", "value": "{{previousOutput}}" }
    /// If "value" is absent, uses previousOutput directly.
    /// If the value is a JSON array/object string, parses it for proper List/Dict storage.
    ///
    /// ARCHITECTURE: This is GENERIC infrastructure. It stores any value in any variable.
    /// It knows nothing about plans, steps, or dev workflows.
    /// </summary>
    private string ExecuteSetVariableNode(
        Domain.Entities.ProjectSession session,
        JsonElement nodeConfig,
        string? previousOutput)
    {
        var nodeId = nodeConfig.TryGetProperty("id", out var idProp)
            ? idProp.GetString() ?? "set-variable" : "set-variable";
        var variableName = nodeConfig.TryGetProperty("variable", out var varProp)
            ? varProp.GetString() : null;
        var mode = nodeConfig.TryGetProperty("mode", out var modeProp) && modeProp.ValueKind == JsonValueKind.String
            ? modeProp.GetString() : null;

        if (string.IsNullOrEmpty(variableName))
        {
            _stateManager.AppendExecutionLog(session, "error", $"set-variable '{nodeId}': missing 'variable' property");
            return previousOutput ?? "";
        }

        // Resolve value — from template, or use previousOutput
        var rawValue = previousOutput ?? "";
        if (nodeConfig.TryGetProperty("value", out var valProp) && valProp.ValueKind == JsonValueKind.String)
        {
            var templateValue = valProp.GetString() ?? "";
            // Handle {{previousOutput}} the same way ExecuteBlockRefAsync does
            rawValue = templateValue.Contains("{{previousOutput}}")
                ? templateValue.Replace("{{previousOutput}}", previousOutput ?? "")
                : ResolveTemplate(templateValue, session);
        }

        // Append mode: add value to existing list instead of overwriting
        if (mode == "append")
        {
            var existing = session.GetVariable(variableName);
            if (existing is List<object> list)
            {
                list.Add(rawValue);
                session.SetVariable(variableName, list);
            }
            else
            {
                session.SetVariable(variableName, new List<object> { rawValue });
            }
            _stateManager.AppendExecutionLog(session, "info",
                $"set-variable '{nodeId}': appended to '{variableName}'");
            return rawValue;
        }

        // Try to parse as JSON for proper List<object>/Dictionary storage.
        // CRITICAL: Use Newtonsoft JToken (reference types) instead of System.Text.Json JsonElement
        // (value struct). Boxed JsonElement stored in Dictionary<string,object> session variables
        // has proven unreliable for ValueKind checks after retrieval — three attempts with
        // System.Text.Json all failed despite compiled code being correct. JArray/JObject are
        // reference types with no boxing issues.
        var trimmed = rawValue.Trim();
        // Strip BOM/zero-width chars that LLMs sometimes emit
        trimmed = trimmed.TrimStart('\uFEFF', '\u200B', '\u200C', '\u200D');
        if (trimmed.StartsWith("[") || trimmed.StartsWith("{"))
        {
            try
            {
                var token = JToken.Parse(trimmed);

                if (token is JArray jArr)
                {
                    var list = JArrayToNativeList(jArr);
                    session.SetVariable(variableName, list);
                    _stateManager.AppendExecutionLog(session, "info",
                        $"set-variable '{nodeId}': stored {list.Count}-item list in '{variableName}' ({trimmed.Length} chars)");
                }
                else if (token is JObject jObj)
                {
                    // Common LLM pattern: agent wraps output in {"summary":"[{...}]"} or {"result":"[{...}]"}.
                    // If the JObject has a string field that contains a JSON array, unwrap it.
                    // This is critical for the task-planner → store-plan → for-each pipeline.
                    //
                    // PHASE 35-E FIX 36: Three-pass extraction:
                    // Pass 1: String property that STARTS with "[" (fastest, original logic)
                    // Pass 2: String property with embedded "[{" anywhere (prose-wrapped JSON)
                    // Pass 3: JArray property directly (object wrapping an array)
                    JArray? unwrappedArray = null;
                    string? unwrapField = null;

                    // Pass 1: String property starting with "["
                    foreach (var prop in jObj.Properties())
                    {
                        if (prop.Value.Type == JTokenType.String)
                        {
                            var strVal = prop.Value.Value<string>();
                            if (!string.IsNullOrEmpty(strVal) && strVal.TrimStart().StartsWith("["))
                            {
                                try
                                {
                                    unwrappedArray = JArray.Parse(strVal);
                                    unwrapField = prop.Name;
                                    break;
                                }
                                catch { /* not a valid JSON array, continue */ }
                            }
                        }
                    }

                    // Pass 2: String property with embedded JSON array (prose wrapping)
                    // Handles: "Here's the plan:\n[{\"id\":1,...}]" or "```json\n[{...}]\n```"
                    if (unwrappedArray == null)
                    {
                        foreach (var prop in jObj.Properties())
                        {
                            if (prop.Value.Type == JTokenType.String)
                            {
                                var strVal = prop.Value.Value<string>();
                                var extracted = TryExtractJsonArrayFromText(strVal);
                                if (extracted != null)
                                {
                                    unwrappedArray = extracted;
                                    unwrapField = prop.Name + " (embedded)";
                                    break;
                                }
                            }
                        }
                    }

                    // Pass 3: JArray property directly ({"steps":[{...}]} pattern)
                    if (unwrappedArray == null)
                    {
                        foreach (var prop in jObj.Properties())
                        {
                            if (prop.Value is JArray directArr && directArr.Count > 0)
                            {
                                unwrappedArray = directArr;
                                unwrapField = prop.Name + " (array)";
                                break;
                            }
                        }
                    }

                    if (unwrappedArray != null && unwrappedArray.Count > 0)
                    {
                        // Unwrap: convert JArray → List<object> of native types
                        var list = JArrayToNativeList(unwrappedArray);
                        session.SetVariable(variableName, list);
                        _stateManager.AppendExecutionLog(session, "info",
                            $"set-variable '{nodeId}': unwrapped '{unwrapField}' → stored {list.Count}-item list in '{variableName}'");
                    }
                    else
                    {
                        // Store object as-is (config objects, non-array wrappers)
                        session.SetVariable(variableName, jObj);
                        _stateManager.AppendExecutionLog(session, "info",
                            $"set-variable '{nodeId}': stored JSON object in '{variableName}' ({trimmed.Length} chars)");
                    }
                }
                else
                {
                    session.SetVariable(variableName, rawValue);
                    _stateManager.AppendExecutionLog(session, "info",
                        $"set-variable '{nodeId}': stored value in '{variableName}' ({trimmed.Length} chars, token type: {token.Type})");
                }
            }
            catch (Exception ex)
            {
                session.SetVariable(variableName, rawValue);
                _stateManager.AppendExecutionLog(session, "warn",
                    $"set-variable '{nodeId}': JSON parse failed, stored as string in '{variableName}' ({rawValue.Length} chars, err: {ex.Message})");
            }
        }
        else
        {
            // PHASE 35-E FIX 36: Plain text may contain an embedded JSON array
            // (LLM wrapped its output in prose, markdown code fences, etc.)
            var embeddedArray = TryExtractJsonArrayFromText(rawValue);
            if (embeddedArray != null && embeddedArray.Count > 0)
            {
                var list = JArrayToNativeList(embeddedArray);
                session.SetVariable(variableName, list);
                _stateManager.AppendExecutionLog(session, "info",
                    $"set-variable '{nodeId}': extracted {list.Count}-item list from plain text in '{variableName}'");
            }
            else
            {
                session.SetVariable(variableName, rawValue);
                _stateManager.AppendExecutionLog(session, "info",
                    $"set-variable '{nodeId}': stored plain text in '{variableName}' ({rawValue.Length} chars)");
            }
        }

        return rawValue;
    }

    /// <summary>
    /// Generic for-each iteration execution. Reads a list from a session variable,
    /// iterates over each item, resets scoped variables, updates item status,
    /// and executes child nodes for each iteration.
    ///
    /// ARCHITECTURE: This is GENERIC infrastructure. The list variable name,
    /// item ID field, variables to reset, and status tracking are all read from
    /// the for-each node's JSON configuration. No session-specific logic.
    /// </summary>
    private async Task<string?> ExecuteForEachNodeAsync(
        Domain.Entities.ProjectSession session,
        JsonElement forEachNode,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        string workflowId,
        List<object> displayTree,
        string? previousOutput)
    {
        var nodeId = forEachNode.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "for-each" : "for-each";
        var source = forEachNode.TryGetProperty("source", out var srcProp) ? srcProp.GetString() ?? "" : "";
        var itemIdField = forEachNode.TryGetProperty("itemId", out var iidProp) ? iidProp.GetString() ?? "id" : "id";
        var configLookup = !forEachNode.TryGetProperty("configLookup", out var clProp) || clProp.GetBoolean();

        if (string.IsNullOrEmpty(source))
        {
            _stateManager.AppendExecutionLog(session, "error", $"for-each '{nodeId}': missing 'source' property");
            throw new InvalidOperationException($"for-each '{nodeId}': missing 'source' property");
        }

        // Normalize source variable (may be JArray/JsonElement from API — convert to List<object>)
        SessionStateManager.NormalizeJsonElementToList(session, source);

        // If the source variable is a string containing JSON, try to parse it.
        // This happens when set-variable stores agent output (a string) that contains a JSON array.
        var rawSourceVar = session.GetVariable(source);
        if (rawSourceVar is string sourceStr && !string.IsNullOrWhiteSpace(sourceStr))
        {
            // Try to extract a JSON array from the string (may have prose/error prefix)
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
                        // Store as JArray, then NormalizeJsonElementToList will convert to List<Dictionary>
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

        // Read the source list from session variable
        // Defense-in-depth: normalize again in case set-variable's normalization didn't stick
        SessionStateManager.NormalizeJsonElementToList(session, source);
        var sourceVar = session.GetVariable(source);

        // Direct JsonElement → List<object> conversion if NormalizeJsonElementToList didn't work
        // This handles the case where JsonElement is stored but ValueKind check fails silently
        if (sourceVar is JsonElement directJsonEl)
        {
            _logger.LogWarning("for-each '{NodeId}': source is still JsonElement (kind={Kind}), converting directly",
                nodeId, directJsonEl.ValueKind);
            if (directJsonEl.ValueKind == JsonValueKind.Array)
            {
                var directList = new List<object>();
                foreach (var item in directJsonEl.EnumerateArray())
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
                                JsonValueKind.Array => prop.Value.ToString()!,
                                JsonValueKind.Object => prop.Value.ToString()!,
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
                    sourceVar = directList;
                    _stateManager.AppendExecutionLog(session, "info",
                        $"for-each '{nodeId}': directly converted JsonElement to {directList.Count} items");
                }
            }
            else if (directJsonEl.ValueKind == JsonValueKind.String)
            {
                // JsonElement wrapping a string — try to parse the string as JSON array
                var strContent = directJsonEl.GetString();
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
                                sourceVar = innerList;
                                _stateManager.AppendExecutionLog(session, "info",
                                    $"for-each '{nodeId}': parsed JsonElement string to {innerList.Count} items");
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "for-each '{NodeId}': failed to parse JsonElement string content", nodeId);
                        }
                    }
                }
            }
        }

        // Defense-in-depth: if source is still a JArray (Newtonsoft), convert to List<object> here
        if (sourceVar is JArray jArrSource)
        {
            _logger.LogWarning("for-each '{NodeId}': source is JArray ({Count} items), normalizing", nodeId, jArrSource.Count);
            SessionStateManager.NormalizeJsonElementToList(session, source);
            sourceVar = session.GetVariable(source);
        }
        // Defense-in-depth: if source is a JToken string wrapping JSON array
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
                catch { /* fallthrough to error below */ }
            }
        }
        // PHASE 35-E FIX 37: if source is a JObject, try to extract arrays from its properties.
        // This handles the case where task-planner output was stored as {"summary":"prose with [{...}]"}
        // or {"steps":[{...}]} — set-variable stored it as JObject because extraction failed.
        else if (sourceVar is JObject jObjSource)
        {
            _logger.LogWarning("for-each '{NodeId}': source is JObject, attempting array extraction", nodeId);
            JArray? extractedArr = null;
            string? extractField = null;

            // Check JArray properties first ({"steps":[...]} pattern)
            foreach (var prop in jObjSource.Properties())
            {
                if (prop.Value is JArray directArr && directArr.Count > 0)
                {
                    extractedArr = directArr;
                    extractField = prop.Name;
                    break;
                }
            }

            // Then check string properties for embedded JSON arrays
            if (extractedArr == null)
            {
                foreach (var prop in jObjSource.Properties())
                {
                    if (prop.Value.Type == JTokenType.String)
                    {
                        var strVal = prop.Value.Value<string>();
                        var embedded = TryExtractJsonArrayFromText(strVal);
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
                var list = JArrayToNativeList(extractedArr);
                session.SetVariable(source, list);
                sourceVar = list;
                _stateManager.AppendExecutionLog(session, "info",
                    $"for-each '{nodeId}': extracted {list.Count} items from JObject property '{extractField}'");
            }
        }

        if (sourceVar is not List<object> items || items.Count == 0)
        {
            var errorMsg = $"for-each '{nodeId}': source '{source}' is empty or not a list (type: {sourceVar?.GetType().Name ?? "null"})";
            _stateManager.AppendExecutionLog(session, "error", errorMsg);
            throw new InvalidOperationException(errorMsg);
        }

        // Read resetVariables from JSON config (data-driven, not hardcoded)
        var resetVars = new Dictionary<string, object?>();
        if (forEachNode.TryGetProperty("resetVariables", out var rvProp) && rvProp.ValueKind == JsonValueKind.Object)
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
            // Clear the state so it's not re-used
            session.SetVariable("_workflowCheckpoint_foreachIndex", null);
        }

        var failCount = 0;

        foreach (var item in items)
        {
            if (item is not Dictionary<string, object> itemDict) continue;

            // Extract item ID
            var itemId = itemDict.TryGetValue(itemIdField, out var idVal) ? idVal?.ToString() : null;
            if (string.IsNullOrEmpty(itemId)) continue;

            // Check if item is already done (skip completed items on resume)
            if (itemDict.TryGetValue("status", out var statusVal) && statusVal?.ToString() == "done")
            {
                itemIndex++;
                continue;
            }

            // Skip items below checkpoint resume index (items processed before crash)
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

            // Get per-item config via GetWorkflowConfig if configLookup is enabled
            var iterationConfig = configLookup
                ? GetWorkflowConfig(session, workflowId, itemId) ?? workflowConfig
                : workflowConfig;

            // Reset scoped variables (data-driven from JSON)
            foreach (var (varName, defaultValue) in resetVars)
            {
                session.SetVariable(varName, defaultValue ?? 0);
            }

            // Handle plateau-based phases
            var phaseStopCondition = GetConfigString(iterationConfig, "evaluation.stopCondition", "target");
            var originalTarget = SessionStateManager.ReadDoubleVariable(session, "targetFitness", 0.85);
            if (phaseStopCondition == "plateau")
            {
                session.SetVariable("targetFitness", 1.0); // Unreachable; plateau stops via _shouldStop
                _stateManager.AppendExecutionLog(session, "info", $"Item '{itemId}' uses plateau detection (runs: {GetConfigInt(iterationConfig, "evaluation.plateauRuns", 5)})");
            }

            // Resolve phaseId: explicit phaseId on item takes priority, fallback to itemId
            var phaseId = itemDict.TryGetValue("phaseId", out var pidVal) ? pidVal?.ToString() : null;

            // Update item status to running (if item has a status field and a valid ID)
            if (itemDict.ContainsKey("status") && itemId != null)
            {
                _stateManager.UpdatePhaseStatus(session, itemId, "running", 0);
            }
            // Also update explicit phaseId if it differs from itemId
            if (phaseId != null && phaseId != itemId)
            {
                _stateManager.UpdatePhaseStatus(session, phaseId, "running", 0);
            }

            // Reset child nodes in display tree for this iteration
            var forEachTreeNode = _stateManager.FindNodeById(displayTree, nodeId);
            if (forEachTreeNode != null &&
                forEachTreeNode.TryGetValue("children", out var childrenObj) &&
                childrenObj is List<object> childrenList)
            {
                _stateManager.ResetNodeTree(childrenList);
            }

            // Save for-each checkpoint state (enables resume at correct item)
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

            // Execute child nodes with per-item config and itemId as activePhaseId.
            // IMPORTANT: Clear child node IDs from _workflowCheckpoint before each iteration.
            // Without this, after item 1 completes "implement-step", the checkpoint contains
            // {"nodeId":"implement-step","status":"completed"}. When item 2 starts,
            // ExecuteConfigNodesAsync reads the checkpoint, sees "implement-step" is already
            // completed, and SKIPS it — even though it hasn't run for item 2 yet.
            // The fix: collect child node IDs (recursively) and remove them from the checkpoint before each item.
            if (forEachNode.TryGetProperty("nodes", out var children) && children.ValueKind == JsonValueKind.Array)
            {
                var childNodeIds = new HashSet<string>();
                CollectNodeIdsRecursive(children, childNodeIds);

                // Remove child node IDs from checkpoint so they aren't skipped for this new item
                var currentCheckpoint = session.GetVariable("_workflowCheckpoint") as List<object>;
                if (currentCheckpoint != null && childNodeIds.Count > 0)
                {
                    currentCheckpoint.RemoveAll(entry =>
                        entry is Dictionary<string, object> dict
                        && dict.TryGetValue("nodeId", out var nid)
                        && childNodeIds.Contains(nid?.ToString() ?? ""));
                    session.SetVariable("_workflowCheckpoint", currentCheckpoint);
                }

                lastOutput = await ExecuteConfigNodesAsync(
                    session, children, iterationConfig, workingDir, workflowId, itemId, displayTree, lastOutput);
            }

            // Restore targetFitness if overridden for plateau mode
            if (phaseStopCondition == "plateau")
            {
                session.SetVariable("targetFitness", originalTarget);
            }

            // Collect results
            var fitness = phaseStopCondition == "plateau"
                ? SessionStateManager.ReadDoubleVariable(session, "_bestFitness", SessionStateManager.ReadDoubleVariable(session, "currentFitness", 0))
                : SessionStateManager.ReadDoubleVariable(session, "currentFitness", 0);
            var iteration = SessionStateManager.ReadIntVariable(session, "currentIteration", 0);
            var tokens = SessionStateManager.ReadIntVariable(session, "_tokenCount", 0);

            // Detect item failure: check if lastOutput contains an error marker
            var itemFailed = false;
            if (lastOutput is string lastOutputStr)
            {
                itemFailed = lastOutputStr.StartsWith("Error:", StringComparison.OrdinalIgnoreCase)
                    || lastOutputStr.Contains("\"error\":", StringComparison.OrdinalIgnoreCase);
            }
            // Also check session variable for execution errors
            var execError = session.GetVariable<string>("_lastExecutionError", "");
            if (!string.IsNullOrEmpty(execError)) itemFailed = true;

            // Update item status based on result
            var itemStatus = itemFailed ? "error" : "done";
            if (itemDict.ContainsKey("status") && itemId != null)
            {
                _stateManager.UpdatePhaseStatus(session, itemId, itemStatus);
                _stateManager.StorePhaseSummary(session, itemId, iteration, fitness);
            }
            // Also update explicit phaseId if it differs from itemId
            if (phaseId != null && phaseId != itemId)
            {
                _stateManager.UpdatePhaseStatus(session, phaseId, itemStatus);
                _stateManager.StorePhaseSummary(session, phaseId, iteration, fitness);
            }
            if (itemFailed) failCount++;

            var logLevel = itemFailed ? "error" : "success";
            var logMsg = $"Item '{itemId}' {(itemFailed ? "failed" : "completed")} (fitness: {fitness:F2}, iterations: {iteration}";
            if (tokens > 0) logMsg += $", ~{tokens} tokens";
            logMsg += ")";
            _stateManager.AppendExecutionLog(session, logLevel, logMsg);
            await _repository.SaveAsync(session);
        }

        // For-each loop done — status reflects child results
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

    /// <summary>
    /// Inline phase execution (Phase 53-C: replaced ExecutePhaseNodeAsync).
    /// Phase = named grouping of child nodes with config section + status tracking, executed once.
    /// </summary>
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
        var phaseConfig = GetWorkflowConfig(session, workflowId, configSection) ?? workflowConfig;

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
            var blockRefId = ResolveTemplate(blockRefProp.GetString()!, session);
            lastOutput = await ExecuteBlockRefAsync(session, blockRefId, phaseNode, workingDir, displayTree, nodeId, previousOutput);
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

    /// <summary>
    /// Dispatches execution to a referenced block (e.g., agent, tool) via BlockExecutorRegistry.
    /// Resolves the block by ID, builds inputs from the phase node config, and runs it.
    /// </summary>
    public async Task<string?> ExecuteBlockRefAsync(
        Domain.Entities.ProjectSession session,
        string blockRefId,
        JsonElement phaseNode,
        string workingDir,
        List<object> displayTree,
        string nodeId,
        string? previousOutput)
    {
        if (_executorRegistry == null)
        {
            _logger.LogWarning("BlockExecutorRegistry not available — cannot execute blockRef '{BlockRef}'", blockRefId);
            _stateManager.AppendExecutionLog(session, "error", $"No executor registry for blockRef '{blockRefId}'");
            throw new InvalidOperationException($"BlockExecutorRegistry not available — cannot execute blockRef '{blockRefId}'");
        }

        // Resolve the block definition
        var block = await _blockDiscovery.GetByIdAsync(NormalizeBlockId(blockRefId), session.BlockSearchPaths);
        if (block == null)
        {
            _logger.LogWarning("Block not found for blockRef: {BlockRef}", blockRefId);
            _stateManager.AppendExecutionLog(session, "error", $"Block not found: {blockRefId}");
            throw new InvalidOperationException($"Block not found: {blockRefId}");
        }

        // Get executor for this block type
        var executor = _executorRegistry.Get(block.BlockType);
        if (executor == null)
        {
            _logger.LogWarning("No executor for block type '{BlockType}' (blockRef: {BlockRef})", block.BlockType, blockRefId);
            _stateManager.AppendExecutionLog(session, "error", $"No executor for block type '{block.BlockType}'");
            throw new InvalidOperationException($"No executor for block type '{block.BlockType}' (blockRef: {blockRefId})");
        }

        // Merge per-node config overrides into the block's config.
        // Agent loop templates use this to override model/maxTokens/temperature on inference nodes.
        if (phaseNode.TryGetProperty("config", out var nodeConfigEl) && nodeConfigEl.ValueKind == JsonValueKind.Object)
        {
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

        // Build inputs from phase node config
        var inputs = new Dictionary<string, object>();
        if (phaseNode.TryGetProperty("inputs", out var inputsEl) && inputsEl.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in inputsEl.EnumerateObject())
            {
                var rawValue = prop.Value.GetString() ?? prop.Value.ToString();
                // Resolve template references like {{inputs.task}} and {{previousOutput}}
                var resolved = rawValue.Contains("{{previousOutput}}")
                    ? rawValue.Replace("{{previousOutput}}", previousOutput ?? "")
                    : ResolveTemplate(rawValue, session);
                inputs[prop.Name] = resolved;
            }
        }

        // Add workingDir if not explicitly set
        if (!inputs.ContainsKey("workingDir"))
        {
            inputs["workingDir"] = workingDir;
        }

        _stateManager.AppendExecutionLog(session, "info", $"Executing blockRef '{blockRefId}' (type: {block.BlockType}) with {inputs.Count} inputs");
        await _repository.SaveAsync(session);

        // Workflow blocks with config.nodes are executed by walking their nodes.
        // Agent/tool blocks with config.nodes use them for LLM params (not execution steps) —
        // they are dispatched to their type-specific executor (AgentBlockExecutor reads config.nodes for model params).
        var isWorkflowBlock = string.Equals(block.BlockType, "workflow", StringComparison.OrdinalIgnoreCase);
        if (isWorkflowBlock && block.Config != null && block.Config.TryGetValue("nodes", out var nodesObj))
        {
            JsonElement? nodesElement = null;

            // config.nodes can be: JsonElement (from System.Text.Json deserialization),
            // JArray (from Newtonsoft API deserialization), or JsonArray (from JsonNode API)
            if (nodesObj is JsonElement je && je.ValueKind == JsonValueKind.Array)
            {
                nodesElement = je;
            }
            else if (nodesObj is Newtonsoft.Json.Linq.JArray jArr)
            {
                using var nd = JsonDocument.Parse(jArr.ToString());
                nodesElement = nd.RootElement.Clone();
            }
            else
            {
                // Try serializing whatever it is
                try
                {
                    var serialized = System.Text.Json.JsonSerializer.Serialize(nodesObj);
                    using var nd = JsonDocument.Parse(serialized);
                    if (nd.RootElement.ValueKind == JsonValueKind.Array)
                        nodesElement = nd.RootElement.Clone();
                }
                catch { /* not serializable as array, fall through to executor */ }
            }

            if (nodesElement.HasValue)
            {
                _stateManager.AppendExecutionLog(session, "info",
                    $"blockRef '{blockRefId}' has {nodesElement.Value.GetArrayLength()} config.nodes — executing as composite");

                try
                {
                    var compositeOutput = await ExecuteConfigNodesAsync(
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

        // Standard executor dispatch (for non-composite blocks: single-call inference, agentic loop, tools)
        // Build execution context — must propagate workspace/session/agent IDs
        // so AgentBlockExecutor can build a proper CliExecutionContext for tool calls
        var execContext = new Domain.Entities.ExecutionContext();
        execContext.Variables["sessionId"] = session.Id;
        execContext.Variables["workingDir"] = workingDir;
        if (!string.IsNullOrEmpty(session.ParentWorkspaceId))
            execContext.Variables["workspaceId"] = session.ParentWorkspaceId;
        execContext.Variables["agentId"] = blockRefId;
        // Pass session permissions for tool-level path validation
        var effectivePermissions = session.GetEffectivePermissions();
        execContext.Variables["_permissions_allowedPaths"] = effectivePermissions.AllowedPaths;

        try
        {
            var result = await executor.ExecuteAsync(block, execContext, inputs);

            // Propagate agent/executor internal logs to session execution log
            // so they're visible in the TUI monitor for diagnosis
            if (result.Logs != null && result.Logs.Count > 0)
            {
                foreach (var log in result.Logs)
                    _stateManager.AppendExecutionLog(session, "info", $"[{blockRefId}] {log}");
            }

            // Log LLM activity if available — agents use "result" key, inference blocks use "response" or "content"
            var responseText = result.Outputs.TryGetValue("response", out var resp) ? resp?.ToString()
                             : result.Outputs.TryGetValue("result", out var res) ? res?.ToString()
                             : result.Outputs.TryGetValue("content", out var cnt) ? cnt?.ToString()
                             : null;
            if (responseText != null)
            {
                _stateManager.AppendToLLMActivity(session, new Dictionary<string, object>
                {
                    { "type", block?.BlockType ?? "block" },
                    { "blockRef", blockRefId },
                    { "response", responseText.Length > 500 ? responseText[..500] + "..." : responseText },
                    { "timestamp", DateTime.UtcNow.ToString("o") },
                    { "toolCalls", result.Outputs.TryGetValue("warning", out var w) && w?.ToString()?.Contains("tool calls") == true ? w.ToString()! : "" },
                    { "tokens", result.TotalTokens }
                });
            }

            // Extract internal metadata keys (starting with '_') and save them as session variables
            // before filtering them out of the output string. This preserves _conversationState
            // for the TUI to display agent conversation history.
            foreach (var kv in result.Outputs.Where(kv => kv.Key.StartsWith("_")))
            {
                var varName = $"{kv.Key}_{blockRefId}";
                session.SetVariable(varName, kv.Value);
            }

            // Build output string from non-internal keys only
            var contentOutputs = result.Outputs
                .Where(kv => !kv.Key.StartsWith("_"))
                .ToDictionary(kv => kv.Key, kv => kv.Value);

            // Prefer "response" key if available (clean text from agent step-complete),
            // then "result" (JSON from agent), then single output, then multi-key JSON format.
            string output;
            if (contentOutputs.TryGetValue("response", out var respOutput) && respOutput != null)
            {
                output = respOutput.ToString() ?? "";
            }
            else if (contentOutputs.Count == 1)
            {
                var singleVal = contentOutputs.Values.First();
                output = SerializeOutputValue(singleVal);
            }
            else if (contentOutputs.Count > 1)
            {
                // Serialize as JSON object so {{_nodeResult_xxx.key}} sub-path access works
                var jsonDict = new Dictionary<string, object?>();
                foreach (var kv in contentOutputs)
                    jsonDict[kv.Key] = kv.Value;
                output = JsonSerializer.Serialize(jsonDict, new JsonSerializerOptions { WriteIndented = false });
            }
            else
            {
                output = result.Success
                    ? $"Block '{blockRefId}' completed successfully"
                    : $"Block '{blockRefId}' failed";
            }

            if (!result.Success)
            {
                _stateManager.AppendExecutionLog(session, "error", $"blockRef '{blockRefId}' failed: {output}");
                // Propagate block failure as exception so caller marks node as "error"
                // and sequence-level error handling can stop execution.
                throw new InvalidOperationException($"Block '{blockRefId}' failed: {output}");
            }

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

    /// <summary>
    /// Dispatches a regular (non-control-flow) config node.
    /// Phase 53-C: Simplified from ExecuteRegularNodeAsync — blockRef dispatch + passthrough.
    /// Native handlers (shell, tree-doc, LLM, etc.) are now standalone block executors
    /// dispatched via blockRef in config.nodes. Nodes without blockRef get passthrough.
    /// </summary>
    private async Task<string?> DispatchRegularNodeAsync(
        Domain.Entities.ProjectSession session,
        string nodeId,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        string? activePhaseId,
        List<object> displayTree,
        string? previousOutput,
        JsonElement? nodeConfig = null)
    {
        // BlockRef dispatch — if the node has a blockRef (or deprecated blockId), dispatch via executor registry
        string? resolvedBlockRef = null;
        if (nodeConfig.HasValue)
        {
            if (nodeConfig.Value.TryGetProperty("blockRef", out var blockRefProp) && blockRefProp.ValueKind == JsonValueKind.String)
            {
                resolvedBlockRef = ResolveTemplate(blockRefProp.GetString()!, session);
            }
            else if (nodeConfig.Value.TryGetProperty("blockId", out var blockIdProp) && blockIdProp.ValueKind == JsonValueKind.String)
            {
                resolvedBlockRef = ResolveTemplate(blockIdProp.GetString()!, session);
                _logger.LogWarning("Node '{NodeId}' uses deprecated 'blockId' — use 'blockRef' instead", nodeId);
            }
        }

        if (resolvedBlockRef != null)
        {
            var blockRefId = resolvedBlockRef;
            var displayName = SessionStateManager.NodeIdToDisplayName(nodeId);

            _stateManager.UpdateNodeById(displayTree, nodeId, "running", $"Executing {blockRefId}...");
            session.SetVariable("_executionTree", displayTree);
            _stateManager.SetActiveBlock(session, nodeId, displayName, "block", "running");
            _stateManager.AppendExecutionLog(session, "info", $"{nodeId}: Starting blockRef '{blockRefId}'...");
            await _repository.SaveAsync(session);

            try
            {
                var output = await ExecuteBlockRefAsync(
                    session, blockRefId, nodeConfig.Value, workingDir, displayTree, nodeId, previousOutput);

                var truncated = output != null && output.Length > 500 ? output[..500] + "..." : output;
                _stateManager.UpdateNodeById(displayTree, nodeId, "done", truncated);
                session.SetVariable("_executionTree", displayTree);
                _stateManager.UpdateActiveBlockOutput(session, output != null && output.Length > 2000 ? output[..2000] + "..." : output ?? "");
                _stateManager.UpdateActiveBlockStatus(session, "done");
                _stateManager.AppendExecutionLog(session, "success", $"{nodeId}: blockRef '{blockRefId}' completed ({output?.Length ?? 0} chars)");
                _stateManager.StoreBlockOutput(session, nodeId, "block", output ?? "");
                session.SetVariable($"_nodeResult_{nodeId}", output ?? "");
                await _repository.SaveAsync(session);
                await Task.Delay(500);
                return output;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "BlockRef execution failed: {NodeId} → {BlockRef}", nodeId, blockRefId);
                var errorMsg = $"(error executing blockRef '{blockRefId}': {ex.Message})";
                _stateManager.UpdateNodeById(displayTree, nodeId, "error", errorMsg);
                session.SetVariable("_executionTree", displayTree);
                _stateManager.UpdateActiveBlockStatus(session, "error");
                _stateManager.AppendExecutionLog(session, "error", $"{nodeId}: {ex.Message}");
                session.SetVariable($"_nodeResult_{nodeId}", errorMsg);
                await _repository.SaveAsync(session);
                throw;
            }
        }

        // Guard: a node with child "nodes" but no "type" is a workflow authoring error.
        // Every container node MUST have an explicit type (sequence, parallel, while, etc.).
        if (nodeConfig.HasValue
            && nodeConfig.Value.TryGetProperty("nodes", out var childNodes)
            && childNodes.ValueKind == JsonValueKind.Array
            && childNodes.GetArrayLength() > 0)
        {
            var errorMsg = $"Node '{nodeId}' has {childNodes.GetArrayLength()} child nodes but no 'type' property. " +
                           "Every container node must declare its type (sequence, parallel, while, for-each, conditional). " +
                           "Fix the workflow block JSON.";
            _logger.LogError(errorMsg);
            _stateManager.AppendExecutionLog(session, "error", errorMsg);
            _stateManager.UpdateNodeById(displayTree, nodeId, "error", errorMsg);
            session.SetVariable("_executionTree", displayTree);
            await _repository.SaveAsync(session);
            throw new InvalidOperationException(errorMsg);
        }

        // Phase 53-C: Pattern-matching dispatch removed.
        // Nodes without blockRef and without a container type are passthrough or authoring errors.
        // All real work should be dispatched via blockRef → BlockExecutorRegistry.
        var passthroughMsg = previousOutput ?? $"Node '{nodeId}' executed (passthrough — no blockRef)";
        _logger.LogWarning("Node '{NodeId}' has no blockRef and no container type — treated as passthrough. " +
                           "Add a blockRef to dispatch via BlockExecutorRegistry.", nodeId);
        _stateManager.AppendExecutionLog(session, "warning",
            $"{nodeId}: No blockRef — passthrough. Migrate this node to use blockRef in Phase 53-D.");
        _stateManager.UpdateNodeById(displayTree, nodeId, "done", "passthrough (no blockRef)");
        session.SetVariable("_executionTree", displayTree);
        session.SetVariable($"_nodeResult_{nodeId}", passthroughMsg);
        await _repository.SaveAsync(session);

        return passthroughMsg;
    }

    // Phase 53-C: Native handler methods REMOVED — now dispatched via BlockExecutorRegistry:
    //   ExecuteNodeAsync (pattern-matching) → blockRef dispatch
    //   ExecuteLoadNodeAsync → FileReadBlockExecutor
    //   ExecuteLLMNodeAsync → InferenceBlockExecutor
    //   ExecuteWriteNodeAsync → ToolBlockExecutor (file-write)
    //   ExecuteTreeDocumenterAsync, DocumentNodesRecursive, InferSystemBlockInfo → TreeDocumenterBlockExecutor
    //   ExecuteShellNodeAsync, RunShellAsync → ShellBlockExecutor
    //   ExecuteValidationNode, EvaluateFitnessDetailed → future ValidatorBlockExecutor
    //   Helpers removed: GetNodeInput, GetConfigFloat, GetConfigStringList, EstimateTokenCount,
    //     TryExtractJson, IsValidJson, GetScoreHistory

    // ===== Config Helpers (navigate session variable _workflowConfig) =====

    /// <summary>
    /// Extracts the workflow-specific config from session variable _workflowConfig.
    /// Phase-aware: if phaseId is provided, looks for config[workflowKey][phaseId] first,
    /// then falls back to config[workflowKey] for backward compatibility.
    /// </summary>
    public static Dictionary<string, object>? GetWorkflowConfig(Domain.Entities.ProjectSession session, string workflowId, string? phaseId = null)
    {
        var configVar = session.GetVariable("_workflowConfig");
        if (configVar == null) return null;

        var keys = ExtractWorkflowKeys(workflowId);

        // First, find the workflow-level config
        Dictionary<string, object>? workflowLevelConfig = null;

        if (configVar is Dictionary<string, object> dict)
        {
            foreach (var key in keys)
            {
                if (dict.TryGetValue(key, out var value) && value is Dictionary<string, object> wc)
                {
                    workflowLevelConfig = wc;
                    break;
                }
            }
        }

        if (workflowLevelConfig == null && configVar is JObject jObj)
        {
            foreach (var key in keys)
            {
                if (jObj.TryGetValue(key, out var prop))
                {
                    workflowLevelConfig = JObjectToDict(prop as JObject);
                    break;
                }
            }
        }

        if (workflowLevelConfig == null && configVar is JsonElement jsonEl && jsonEl.ValueKind == JsonValueKind.Object)
        {
            foreach (var key in keys)
            {
                if (jsonEl.TryGetProperty(key, out var prop))
                {
                    workflowLevelConfig = JsonElementToDict(prop);
                    break;
                }
            }
        }

        if (workflowLevelConfig == null) return null;

        // If phaseId provided, look for phase-specific sub-config
        if (!string.IsNullOrEmpty(phaseId))
        {
            // Try to get phase-specific config from the workflow config
            if (workflowLevelConfig.TryGetValue(phaseId, out var phaseConfig))
            {
                if (phaseConfig is Dictionary<string, object> phaseDict)
                    return phaseDict;
                if (phaseConfig is JObject phaseJObj)
                    return JObjectToDict(phaseJObj);
                if (phaseConfig is JsonElement phaseEl && phaseEl.ValueKind == JsonValueKind.Object)
                    return JsonElementToDict(phaseEl);
            }
        }

        // Fallback: return workflow-level config (backward compat)
        return workflowLevelConfig;
    }

    private static string[] ExtractWorkflowKeys(string workflowId)
    {
        // workflow:foundry/agent-improvement-loop → try multiple key forms
        var stripped = workflowId
            .Replace("workflow:", "")
            .Replace("foundry:", "");
        var lastSegment = stripped.Contains('/') ? stripped.Split('/').Last() : stripped;
        return new[] { lastSegment, stripped, workflowId };
    }

    private static string GetConfigString(Dictionary<string, object>? config, string dotPath, string? defaultValue)
    {
        if (config == null) return defaultValue ?? "";

        var parts = dotPath.Split('.');
        object? current = config;

        foreach (var part in parts)
        {
            if (current is Dictionary<string, object> dict)
            {
                if (!dict.TryGetValue(part, out current)) return defaultValue ?? "";
            }
            else if (current is JObject jObj)
            {
                if (!jObj.TryGetValue(part, out var jToken)) return defaultValue ?? "";
                current = jToken;
            }
            else if (current is JsonElement jsonEl && jsonEl.ValueKind == JsonValueKind.Object)
            {
                if (!jsonEl.TryGetProperty(part, out var prop)) return defaultValue ?? "";
                current = prop;
            }
            else
            {
                return defaultValue ?? "";
            }
        }

        if (current is string s) return s;
        if (current is JValue jVal) return jVal.Value?.ToString() ?? defaultValue ?? "";
        if (current is JToken jt) return jt.ToString();
        if (current is JsonElement je && je.ValueKind == JsonValueKind.String) return je.GetString() ?? defaultValue ?? "";
        return current?.ToString() ?? defaultValue ?? "";
    }

    private static int GetConfigInt(Dictionary<string, object>? config, string dotPath, int defaultValue)
    {
        var str = GetConfigString(config, dotPath, null);
        return str != null && int.TryParse(str, out var val) ? val : defaultValue;
    }

    public static string NormalizeBlockId(string workflowId)
    {
        // workflow:foundry/agent-improvement-loop → foundry:agent-improvement-loop
        var stripped = workflowId.Replace("workflow:", "");
        if (stripped.Contains('/'))
        {
            var parts = stripped.Split('/', 2);
            return $"{parts[0]}:{parts[1]}";
        }
        return stripped;
    }


    // ===== Template Resolution & Condition Evaluation =====

    /// <summary>
    /// Resolves {{variable}} references in a template string using session variables.
    /// Handles {{inputs.xxx}} by looking up session variable "xxx".
    /// Returns the resolved string with all placeholders replaced.
    /// </summary>
    private static string ResolveTemplate(string template, Domain.Entities.ProjectSession session)
    {
        return Regex.Replace(template, @"\{\{([^}]+)\}\}", match =>
        {
            var varPath = match.Groups[1].Value.Trim();
            string? jsonSubPath = null;

            // {{inputs.xxx}} → session variable "xxx"
            if (varPath.StartsWith("inputs."))
                varPath = varPath["inputs.".Length..];

            // {{state.results.xxx}} → session variable "_nodeResult_xxx"
            // {{state.results.xxx.yyy}} → session variable "_nodeResult_xxx", sub-path "yyy"
            if (varPath.StartsWith("state.results."))
            {
                var afterResults = varPath["state.results.".Length..];
                var dotIdx = afterResults.IndexOf('.');
                if (dotIdx >= 0)
                {
                    var nodeId = afterResults[..dotIdx];
                    jsonSubPath = afterResults[(dotIdx + 1)..];
                    varPath = $"_nodeResult_{nodeId}";
                }
                else
                {
                    varPath = $"_nodeResult_{afterResults}";
                }
            }
            // {{state.xxx}} → session variable "_state_xxx" (general state access)
            else if (varPath.StartsWith("state."))
            {
                var statePath = varPath["state.".Length..];
                var stateKey = statePath.Contains('.') ? statePath[..statePath.IndexOf('.')] : statePath;
                varPath = $"_state_{stateKey}";
            }
            // {{_nodeResult_xxx.yyy}} → variable "_nodeResult_xxx", sub-path "yyy"
            else if (varPath.StartsWith("_nodeResult_") && varPath.Contains('.'))
            {
                var dotIdx = varPath.IndexOf('.');
                jsonSubPath = varPath[(dotIdx + 1)..];
                varPath = varPath[..dotIdx];
            }

            var value = session.GetVariable(varPath);
            if (value == null) return "";

            // Phase 32-C: JSON sub-path extraction
            // If a sub-path is specified (e.g., .approved, .score), try to extract from JSON
            if (jsonSubPath != null)
            {
                var extracted = ExtractJsonSubPath(value, jsonSubPath);
                if (extracted != null) return extracted;
            }

            if (value is double d) return d.ToString(System.Globalization.CultureInfo.InvariantCulture);
            if (value is int i) return i.ToString(System.Globalization.CultureInfo.InvariantCulture);
            if (value is long l) return l.ToString(System.Globalization.CultureInfo.InvariantCulture);
            if (value is float f) return f.ToString(System.Globalization.CultureInfo.InvariantCulture);

            if (value is JsonElement je)
            {
                return je.ValueKind switch
                {
                    JsonValueKind.Number => je.GetDouble().ToString(System.Globalization.CultureInfo.InvariantCulture),
                    JsonValueKind.String => je.GetString() ?? "0",
                    JsonValueKind.True => "true",
                    JsonValueKind.False => "false",
                    _ => je.ToString()
                };
            }

            if (value is JValue jv)
            {
                if (jv.Value is double jd) return jd.ToString(System.Globalization.CultureInfo.InvariantCulture);
                return jv.Value?.ToString() ?? "0";
            }

            // Collections (List<object>, Dictionary<string,object>) must be serialized to JSON,
            // not .ToString() which returns the C# type name.
            if (value is System.Collections.IList || value is System.Collections.IDictionary)
            {
                return JsonSerializer.Serialize(value);
            }

            return value.ToString() ?? "0";
        });
    }

    /// <summary>
    /// Extract a field from a JSON value by sub-path (e.g., "approved", "score").
    /// Handles string values that are parseable JSON, JsonElement objects, and JObject/JValue.
    /// </summary>
    /// <summary>
    /// Recursively collects all node IDs from a JSON array of nodes,
    /// including nodes inside conditional branches and nested node arrays.
    /// Used to clear checkpoints before loop iterations.
    /// </summary>
    private static void CollectNodeIdsRecursive(JsonElement nodes, HashSet<string> ids)
    {
        if (nodes.ValueKind != JsonValueKind.Array) return;
        foreach (var node in nodes.EnumerateArray())
        {
            if (node.TryGetProperty("id", out var idProp))
                ids.Add(idProp.GetString() ?? "");

            // Recurse into child nodes (for sequence/while/foreach)
            if (node.TryGetProperty("nodes", out var childNodes) && childNodes.ValueKind == JsonValueKind.Array)
                CollectNodeIdsRecursive(childNodes, ids);

            // Recurse into conditional branches
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

    private static string? ExtractJsonSubPath(object value, string subPath)
    {
        try
        {
            // If value is a string, try to parse as JSON
            var jsonStr = value as string;
            if (jsonStr == null && value is JsonElement je && je.ValueKind == JsonValueKind.String)
                jsonStr = je.GetString();

            if (jsonStr != null)
            {
                // Strip markdown code fences if present (e.g., ```json ... ```)
                var stripped = jsonStr.Trim();
                var fenceMatch = System.Text.RegularExpressions.Regex.Match(
                    stripped, @"```(?:json)?\s*(\{.*\})\s*```", System.Text.RegularExpressions.RegexOptions.Singleline);
                if (fenceMatch.Success)
                    stripped = fenceMatch.Groups[1].Value;

                using var doc = JsonDocument.Parse(stripped);
                if (doc.RootElement.TryGetProperty(subPath, out var prop))
                {
                    return prop.ValueKind switch
                    {
                        JsonValueKind.Number => prop.GetDouble().ToString(System.Globalization.CultureInfo.InvariantCulture),
                        JsonValueKind.String => prop.GetString() ?? "0",
                        JsonValueKind.True => "true",
                        JsonValueKind.False => "false",
                        _ => prop.ToString()
                    };
                }
            }

            // If value is a JsonElement object, navigate directly
            if (value is JsonElement obj && obj.ValueKind == JsonValueKind.Object)
            {
                if (obj.TryGetProperty(subPath, out var prop))
                {
                    return prop.ValueKind switch
                    {
                        JsonValueKind.Number => prop.GetDouble().ToString(System.Globalization.CultureInfo.InvariantCulture),
                        JsonValueKind.String => prop.GetString() ?? "0",
                        JsonValueKind.True => "true",
                        JsonValueKind.False => "false",
                        _ => prop.ToString()
                    };
                }
            }

            // If value is a JObject (Newtonsoft), navigate
            if (value is Newtonsoft.Json.Linq.JObject jObj)
            {
                var token = jObj[subPath];
                if (token != null) return token.ToString();
            }
        }
        catch
        {
            // Parse failure — fall back to returning null (caller uses full value)
        }

        return null;
    }

    /// <summary>
    /// Serializes a block output value to a string suitable for storage in session variables.
    /// Strings pass through unchanged; complex objects (lists, dicts) get JSON-serialized
    /// so that {{_nodeResult_xxx.key}} sub-path extraction works via ExtractJsonSubPath.
    /// </summary>
    private static string SerializeOutputValue(object? value)
    {
        if (value == null) return "";
        if (value is string s) return s;
        if (value is JsonElement je)
            return je.ValueKind == JsonValueKind.String ? je.GetString() ?? "" : je.GetRawText();

        // For primitive types, just use ToString
        var type = value.GetType();
        if (type.IsPrimitive || type == typeof(decimal))
            return value.ToString() ?? "";

        // For complex types (List<T>, Dictionary, etc.), serialize to JSON
        try
        {
            return JsonSerializer.Serialize(value, new JsonSerializerOptions { WriteIndented = false });
        }
        catch
        {
            return value.ToString() ?? "";
        }
    }

    /// <summary>
    /// Evaluates a boolean condition expression after resolving template variables.
    /// Supports: &amp;&amp;, ||, &lt;, &gt;, &lt;=, &gt;=, ==, !=
    /// Example: "0.25 &lt; 0.85 &amp;&amp; 1 &lt; 50" → true
    /// </summary>
    private static bool EvaluateCondition(string conditionTemplate, Domain.Entities.ProjectSession session)
    {
        var resolved = ResolveTemplate(conditionTemplate, session);

        // Split on && (all parts must be true)
        var andParts = resolved.Split(new[] { "&&" }, StringSplitOptions.TrimEntries);

        foreach (var andPart in andParts)
        {
            // Each andPart may contain || (any sub-part must be true)
            var orParts = andPart.Split(new[] { "||" }, StringSplitOptions.TrimEntries);
            var anyTrue = false;

            foreach (var orPart in orParts)
            {
                if (EvaluateSimpleComparison(orPart.Trim()))
                {
                    anyTrue = true;
                    break;
                }
            }

            if (!anyTrue) return false;
        }

        return true;
    }

    /// <summary>
    /// Evaluates a single comparison expression (e.g., "0.25 &lt; 0.85").
    /// Tries numeric comparison first, falls back to string comparison.
    /// </summary>
    private static bool EvaluateSimpleComparison(string expr)
    {
        // Try operators in specificity order: <=, >=, !=, ==, <, >
        string[] operators = { "<=", ">=", "!=", "==", "<", ">" };

        foreach (var op in operators)
        {
            var idx = expr.IndexOf(op, StringComparison.Ordinal);
            if (idx >= 0)
            {
                var left = expr[..idx].Trim();
                var right = expr[(idx + op.Length)..].Trim();

                // Strip surrounding quotes from both sides.
                // Conditions like {{var}} != "" resolve to ' != ""' after template substitution.
                // Without unquoting, the comparison becomes "" != "\"\"" → true (wrong).
                left = StripSurroundingQuotes(left);
                right = StripSurroundingQuotes(right);

                // Numeric comparison
                if (double.TryParse(left, System.Globalization.CultureInfo.InvariantCulture, out var leftNum) &&
                    double.TryParse(right, System.Globalization.CultureInfo.InvariantCulture, out var rightNum))
                {
                    return op switch
                    {
                        "<" => leftNum < rightNum,
                        ">" => leftNum > rightNum,
                        "<=" => leftNum <= rightNum,
                        ">=" => leftNum >= rightNum,
                        "==" => Math.Abs(leftNum - rightNum) < 0.0001,
                        "!=" => Math.Abs(leftNum - rightNum) >= 0.0001,
                        _ => false
                    };
                }

                // String comparison
                return op switch
                {
                    "==" => left == right,
                    "!=" => left != right,
                    _ => false
                };
            }
        }

        // Boolean literal
        if (bool.TryParse(expr, out var boolVal)) return boolVal;

        // Truthy: non-empty, non-zero
        if (double.TryParse(expr, System.Globalization.CultureInfo.InvariantCulture, out var numVal)) return numVal != 0;
        return !string.IsNullOrEmpty(expr) && expr != "0" && expr.ToLowerInvariant() != "false";
    }

    /// <summary>
    /// Strips surrounding double quotes from a string literal.
    /// Handles conditions like {{var}} != "" where after template resolution
    /// the empty string value is compared against the literal "".
    /// </summary>
    private static string StripSurroundingQuotes(string s)
    {
        if (s.Length >= 2 && s[0] == '"' && s[^1] == '"')
            return s[1..^1];
        return s;
    }

    private static Dictionary<string, object>? JObjectToDict(JObject? jObj)
    {
        if (jObj == null) return null;
        var dict = new Dictionary<string, object>();
        foreach (var prop in jObj.Properties())
        {
            dict[prop.Name] = prop.Value;
        }
        return dict;
    }

    private static Dictionary<string, object>? JsonElementToDict(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object) return null;
        var dict = new Dictionary<string, object>();
        foreach (var prop in element.EnumerateObject())
        {
            dict[prop.Name] = prop.Value;
        }
        return dict;
    }


    public static string GetProjectPath(Domain.Entities.ProjectSession session)
    {
        if (!string.IsNullOrEmpty(session.WorkingDirectory) && session.WorkingDirectory != ".")
            return session.WorkingDirectory;

        // Fall back to repository path for repo-bound sessions
        if (!string.IsNullOrEmpty(session.RepositoryPath))
            return session.RepositoryPath;

        return Environment.CurrentDirectory;
    }

    /// <summary>
    /// PHASE 35-E FIX 36: Attempt to extract a JSON array from text that may contain
    /// prose, markdown code fences, or other non-JSON content around the array.
    /// Returns null if no valid JSON array is found.
    /// </summary>
    private static JArray? TryExtractJsonArrayFromText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        // Step 1: Strip markdown code fences (```json ... ``` or ``` ... ```)
        var stripped = Regex.Replace(text, @"```(?:json|JSON)?\s*\n?", "").Trim();

        // Step 2: Find the first "[{" pattern (start of a JSON array of objects)
        var arrayStart = stripped.IndexOf("[{", StringComparison.Ordinal);
        if (arrayStart < 0)
        {
            // Also try just "[" for arrays of primitives or "[\"" for arrays of strings
            arrayStart = stripped.IndexOf('[');
        }
        if (arrayStart < 0) return null;

        // Step 3: Find the matching "]" — search from the end backwards
        var arrayEnd = stripped.LastIndexOf(']');
        if (arrayEnd <= arrayStart) return null;

        // Step 4: Extract and validate
        var candidate = stripped.Substring(arrayStart, arrayEnd - arrayStart + 1);
        try
        {
            var parsed = JArray.Parse(candidate);
            // Only return if the array has items (empty arrays aren't useful)
            return parsed.Count > 0 ? parsed : null;
        }
        catch
        {
            // If the greedy approach failed, try a more conservative bracket-matching approach
            // Count brackets to find the correct closing bracket for the first "["
            var depth = 0;
            var inString = false;
            var escaped = false;
            for (var i = arrayStart; i <= arrayEnd; i++)
            {
                var c = stripped[i];
                if (escaped) { escaped = false; continue; }
                if (c == '\\') { escaped = true; continue; }
                if (c == '"') { inString = !inString; continue; }
                if (inString) continue;
                if (c == '[') depth++;
                if (c == ']')
                {
                    depth--;
                    if (depth == 0)
                    {
                        var balanced = stripped.Substring(arrayStart, i - arrayStart + 1);
                        try
                        {
                            var parsed2 = JArray.Parse(balanced);
                            return parsed2.Count > 0 ? parsed2 : null;
                        }
                        catch { return null; }
                    }
                }
            }
            return null;
        }
    }

    /// <summary>
    /// PHASE 35-E FIX 36: Convert a Newtonsoft JArray to a native List&lt;object&gt;
    /// of Dictionary/string/primitive types suitable for session variable storage.
    /// </summary>
    private static List<object> JArrayToNativeList(JArray jArr)
    {
        var list = new List<object>();
        foreach (var item in jArr)
        {
            if (item is JObject jObj)
            {
                var dict = new Dictionary<string, object>();
                foreach (var prop in jObj.Properties())
                {
                    dict[prop.Name] = prop.Value.Type switch
                    {
                        JTokenType.String => prop.Value.Value<string>()!,
                        JTokenType.Integer => (object)prop.Value.Value<long>(),
                        JTokenType.Float => (object)prop.Value.Value<double>(),
                        JTokenType.Boolean => (object)prop.Value.Value<bool>(),
                        JTokenType.Array => prop.Value.ToString(),
                        JTokenType.Object => prop.Value.ToString(),
                        _ => prop.Value.ToString()
                    };
                }
                list.Add(dict);
            }
            else if (item.Type == JTokenType.String)
            {
                list.Add(item.Value<string>()!);
            }
            else
            {
                list.Add(item.ToString());
            }
        }
        return list;
    }
}
