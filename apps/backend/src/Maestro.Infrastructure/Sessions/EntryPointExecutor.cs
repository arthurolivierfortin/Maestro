using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;
using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Sessions;

/// <summary>
/// Executes entry point workflows as background tasks, updating session variables
/// so the TUI Monitor can display real-time progress.
///
/// ARCHITECTURE: This class is GENERIC infrastructure. All session-specific data
/// (phases, prompts, output paths, evaluation criteria) comes from session variables
/// defined in the template JSON. See CLAUDE.md "Session Architecture Principles".
/// </summary>
public class EntryPointExecutor
{
    private readonly IProjectSessionRepository _repository;
    private readonly ILLMGateway _llmGateway;
    private readonly IBlockDiscoveryService _blockDiscovery;
    private readonly BlockExecutors.BlockExecutorRegistry? _executorRegistry;
    private readonly ILogger<EntryPointExecutor> _logger;

    public EntryPointExecutor(
        IProjectSessionRepository repository,
        ILLMGateway llmGateway,
        IBlockDiscoveryService blockDiscovery,
        ILogger<EntryPointExecutor> logger,
        BlockExecutors.BlockExecutorRegistry? executorRegistry = null)
    {
        _repository = repository;
        _llmGateway = llmGateway;
        _blockDiscovery = blockDiscovery;
        _logger = logger;
        _executorRegistry = executorRegistry;
    }

    /// <summary>
    /// Starts executing an entry point workflow in the background.
    /// Returns an invocation ID immediately.
    /// </summary>
    public string StartExecution(SessionId sessionId, string entryPoint, string workflowId, Dictionary<string, object>? inputs = null)
    {
        var invocationId = Guid.NewGuid().ToString("N")[..12];

        _ = Task.Run(async () =>
        {
            try
            {
                await ExecuteWorkflowAsync(sessionId, entryPoint, workflowId, invocationId, inputs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Entry point execution failed: {EntryPoint} on session {SessionId}", entryPoint, sessionId.Value);
                // Update session state so the monitor shows the failure instead of silently stopping
                try
                {
                    var failedSession = await _repository.GetByIdAsync(sessionId);
                    if (failedSession != null)
                    {
                        AppendExecutionLog(failedSession, "error", $"Workflow crashed: {ex.Message}");
                        await _repository.SaveAsync(failedSession);
                    }
                }
                catch (Exception saveEx)
                {
                    _logger.LogError(saveEx, "Failed to save error state for session {SessionId}", sessionId.Value);
                }
            }
        });

        return invocationId;
    }

    /// <summary>
    /// Generic workflow execution. Loads the workflow block, reads session variables
    /// for configuration, builds the execution tree dynamically, and runs nodes.
    /// </summary>
    private async Task ExecuteWorkflowAsync(
        SessionId sessionId,
        string entryPoint,
        string workflowId,
        string invocationId,
        Dictionary<string, object>? inputs)
    {
        _logger.LogInformation("Starting workflow execution: {WorkflowId} for entry point {EntryPoint} on session {SessionId}",
            workflowId, entryPoint, sessionId.Value);

        var session = await _repository.GetByIdAsync(sessionId);
        if (session == null) return;

        var workingDir = GetProjectPath(session);

        // 1. Load workflow block (optional — execution still works without it)
        var blockId = NormalizeBlockId(workflowId);
        var workflowBlock = await _blockDiscovery.GetByIdAsync(blockId, session.BlockSearchPaths);
        if (workflowBlock == null)
        {
            _logger.LogWarning("Workflow block not found: {BlockId}. Using minimal execution.", blockId);
        }

        // 2. Initialize from session data (reads _phases, _monitorDescriptor from template)
        InitializeFromSessionData(session);

        // 3. Build execution tree from workflow block config.nodes
        var tree = BuildExecutionTree(workflowBlock);

        // 4. Set execution state
        session.SetVariable("_executionTree", tree);
        session.SetVariable("_activeWorkflow", workflowId);

        // Store invoke inputs as session variables so {{inputs.xxx}} templates can resolve them
        if (inputs != null)
        {
            foreach (var kv in inputs)
            {
                session.SetVariable(kv.Key, kv.Value);
            }
        }

        // Auto-inject repoPath from session's RepositoryPath if not explicitly provided.
        // Workflows reference {{inputs.repoPath}} for tool/agent workingDir, and without this
        // the template resolves to "0" (null default), causing process start failures.
        if (!string.IsNullOrEmpty(session.RepositoryPath) && session.GetVariable("repoPath") == null)
        {
            session.SetVariable("repoPath", session.RepositoryPath);
        }

        AppendExecutionLog(session, "info", $"Starting workflow: {workflowId}");
        await _repository.SaveAsync(session);

        // 5. Execute workflow nodes — control flow (for-each, while, conditional) is handled
        // by the node dispatch in ExecuteConfigNodesAsync. Phase iteration is explicit
        // via for-each nodes in the workflow JSON, not implicit in C#.
        var workflowConfig = GetWorkflowConfig(session, workflowId, null);

        // Workflow blocks walk config.nodes as execution steps.
        // Agent/tool blocks with config.nodes use them for LLM params (not execution steps) —
        // they are dispatched via BlockExecutorRegistry instead.
        var isWorkflowWithNodes = workflowBlock?.Config != null
            && workflowBlock.Config.ContainsKey("nodes")
            && string.Equals(workflowBlock.BlockType, "workflow", StringComparison.OrdinalIgnoreCase);

        if (isWorkflowWithNodes)
        {
            var configNodesObj = workflowBlock.Config["nodes"];
            if (configNodesObj is JsonElement nodesEl && nodesEl.ValueKind == JsonValueKind.Array)
            {
                await ExecuteConfigNodesAsync(session, nodesEl, workflowConfig, workingDir, workflowId, null, tree);
            }
        }
        else if (workflowBlock != null && _executorRegistry?.Get(workflowBlock.BlockType) != null)
        {
            // Entry point maps directly to an executable block (agent, tool, etc.)
            // Dispatch via BlockExecutorRegistry instead of passthrough
            AppendExecutionLog(session, "info", $"Executing block '{workflowId}' directly (type: {workflowBlock.BlockType})");
            UpdateNodeById(tree, "execute", "running", $"Running {workflowBlock.BlockType}...");
            session.SetVariable("_executionTree", tree);
            await _repository.SaveAsync(session);

            var dummyPhaseNode = JsonSerializer.SerializeToElement(new
            {
                id = "execute",
                blockRef = workflowId,
                inputs = inputs ?? new Dictionary<string, object>()
            });
            var output = await ExecuteBlockRefAsync(session, workflowId, dummyPhaseNode, workingDir, tree, "execute", null);

            UpdateNodeById(tree, "execute", "done", output?.Length > 200 ? output[..200] + "..." : output);
            session.SetVariable("_executionTree", tree);
            await _repository.SaveAsync(session);
        }
        else
        {
            await ExecuteNodesAsync(session, tree, workflowConfig, workingDir, null);
        }

        // Clean up checkpoint variables on normal workflow completion
        // (prevents stale checkpoint data from affecting the next workflow invocation)
        session.SetVariable("_workflowCheckpoint", null);
        session.SetVariable("_workflowCheckpoint_whileState", null);
        session.SetVariable("_workflowCheckpoint_foreachIndex", null);

        ClearActiveBlock(session);
        session.SetVariable("_activeWorkflow", "");
        await _repository.SaveAsync(session);

        _logger.LogInformation("Workflow execution completed: {WorkflowId} on session {SessionId}",
            workflowId, sessionId.Value);
    }

    // ===== Initialization =====

    /// <summary>
    /// Reads existing session variables (_phases, _monitorDescriptor, etc.).
    /// Does NOT create them — they must come from the template.
    /// Initializes runtime-only variables (_executionLog, _artifacts) if not present.
    /// </summary>
    private void InitializeFromSessionData(Domain.Entities.ProjectSession session)
    {
        if (!session.HasVariable("_phases"))
            _logger.LogWarning("Session {SessionId} missing _phases variable. TUI phase display will be empty.", session.Id);
        else
        {
            var beforeType = session.GetVariable("_phases")?.GetType().Name ?? "null";
            NormalizeJsonElementToList(session, "_phases");
            var afterType = session.GetVariable("_phases")?.GetType().Name ?? "null";
            _logger.LogInformation("_phases normalized: {Before} -> {After}", beforeType, afterType);
        }

        if (!session.HasVariable("_monitorDescriptor"))
            _logger.LogWarning("Session {SessionId} missing _monitorDescriptor variable. TUI will use default layout.", session.Id);

        // Runtime variables — safe to initialize if missing
        if (!session.HasVariable("_executionLog"))
            session.SetVariable("_executionLog", new List<object>());

        if (!session.HasVariable("_artifacts"))
            session.SetVariable("_artifacts", new List<object>());

        if (!session.HasVariable("_blockOutputs"))
            session.SetVariable("_blockOutputs", new Dictionary<string, object>());

        if (!session.HasVariable("_llmActivity"))
            session.SetVariable("_llmActivity", new List<object>());

        if (!session.HasVariable("_phaseMetrics"))
            session.SetVariable("_phaseMetrics", new Dictionary<string, object>());
    }

    /// <summary>
    /// Converts a session variable from JsonElement (from API) to a mutable List so
    /// methods like UpdatePhaseStatus can modify it in-place.
    /// </summary>
    private static void NormalizeJsonElementToList(Domain.Entities.ProjectSession session, string key)
    {
        var value = session.GetVariable(key);

        // Handle Newtonsoft.Json JArray (from API deserialization)
        if (value is JArray jArray)
        {
            var list = new List<object>();
            foreach (var item in jArray)
            {
                if (item is JObject jObj)
                {
                    var dict = new Dictionary<string, object>();
                    foreach (var prop in jObj.Properties())
                    {
                        dict[prop.Name] = prop.Value.Type switch
                        {
                            JTokenType.String => prop.Value.Value<string>()!,
                            JTokenType.Integer => prop.Value.Value<long>(),
                            JTokenType.Float => prop.Value.Value<double>(),
                            JTokenType.Boolean => prop.Value.Value<bool>(),
                            _ => prop.Value.ToString()
                        };
                    }
                    list.Add(dict);
                }
                else
                {
                    list.Add(item.ToString());
                }
            }
            session.SetVariable(key, list);
            return;
        }

        // Handle System.Text.Json JsonElement (from block config)
        if (value is JsonElement jsonEl && jsonEl.ValueKind == JsonValueKind.Array)
        {
            var list = new List<object>();
            foreach (var item in jsonEl.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.Object)
                {
                    var dict = new Dictionary<string, object>();
                    foreach (var prop in item.EnumerateObject())
                    {
                        dict[prop.Name] = prop.Value.ValueKind switch
                        {
                            JsonValueKind.String => prop.Value.GetString()!,
                            JsonValueKind.Number => prop.Value.GetDouble(),
                            JsonValueKind.True => true,
                            JsonValueKind.False => false,
                            _ => prop.Value.ToString()!
                        };
                    }
                    list.Add(dict);
                }
                else
                {
                    list.Add(item.ToString()!);
                }
            }
            session.SetVariable(key, list);
            return;
        }

        // Handle string containing a JSON array (from LLM output stored as _nodeResult_xxx)
        if (value is string strValue)
        {
            var trimmed = strValue.Trim();
            if (trimmed.StartsWith("["))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<JsonElement>(trimmed);
                    if (parsed.ValueKind == JsonValueKind.Array)
                    {
                        var list = new List<object>();
                        foreach (var item in parsed.EnumerateArray())
                        {
                            if (item.ValueKind == JsonValueKind.Object)
                            {
                                var dict = new Dictionary<string, object>();
                                foreach (var prop in item.EnumerateObject())
                                {
                                    dict[prop.Name] = prop.Value.ValueKind switch
                                    {
                                        JsonValueKind.String => prop.Value.GetString()!,
                                        JsonValueKind.Number => prop.Value.TryGetInt32(out var i) ? (object)i : prop.Value.GetDouble(),
                                        JsonValueKind.True => true,
                                        JsonValueKind.False => false,
                                        JsonValueKind.Array => prop.Value.ToString()!,
                                        JsonValueKind.Object => prop.Value.ToString()!,
                                        _ => prop.Value.ToString()!
                                    };
                                }
                                list.Add(dict);
                            }
                            else
                            {
                                list.Add(item.ToString()!);
                            }
                        }
                        session.SetVariable(key, list);
                    }
                }
                catch (JsonException)
                {
                    // Not valid JSON — leave as string, for-each will fail with a clear message
                }
            }
        }
    }

    // ===== Execution Tree Building =====

    /// <summary>
    /// Builds a HIERARCHICAL execution tree from a workflow block's config.nodes.
    /// While/conditional nodes contain their children nested under them.
    /// The TUI renders this tree recursively with indentation.
    /// </summary>
    private List<object> BuildExecutionTree(Domain.Entities.BlockDefinition? workflowBlock)
    {
        if (workflowBlock?.Config == null || !workflowBlock.Config.ContainsKey("nodes"))
        {
            return new List<object> { CreateNode("execute", "Execute Workflow", "pending") };
        }

        var nodesObj = workflowBlock.Config["nodes"];

        if (nodesObj is JsonElement jsonEl && jsonEl.ValueKind == JsonValueKind.Array)
        {
            var tree = new List<object>();
            foreach (var node in jsonEl.EnumerateArray())
            {
                var treeNode = BuildTreeNode(node);
                if (treeNode != null) tree.Add(treeNode);
            }
            return tree.Count > 0 ? tree : new List<object> { CreateNode("execute", "Execute Workflow", "pending") };
        }

        return new List<object> { CreateNode("execute", "Execute Workflow", "pending") };
    }

    /// <summary>
    /// Recursively builds a tree node, preserving hierarchy.
    /// While/conditional nodes get their children nested under them.
    /// </summary>
    private static Dictionary<string, object>? BuildTreeNode(JsonElement node)
    {
        if (node.ValueKind != JsonValueKind.Object) return null;

        var id = node.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "unknown" : "unknown";
        var displayName = NodeIdToDisplayName(id);
        var treeNode = CreateNode(id, displayName, "pending");

        // Nest children for while/conditional/sequence/parallel nodes
        // Support "children" key (used by sequence/parallel nodes in v4 workflows)
        if (node.TryGetProperty("children", out var childNodes) && childNodes.ValueKind == JsonValueKind.Array)
        {
            var children = new List<object>();
            foreach (var child in childNodes.EnumerateArray())
            {
                var childNode = BuildTreeNode(child);
                if (childNode != null) children.Add(childNode);
            }
            treeNode["children"] = children;
        }
        else if (node.TryGetProperty("nodes", out var nestedNodes) && nestedNodes.ValueKind == JsonValueKind.Array)
        {
            var children = new List<object>();
            foreach (var child in nestedNodes.EnumerateArray())
            {
                var childNode = BuildTreeNode(child);
                if (childNode != null) children.Add(childNode);
            }
            treeNode["children"] = children;
        }

        return treeNode;
    }

    // ===== Node Execution =====

    /// <summary>
    /// Executes tree nodes sequentially, updating session state after each.
    /// </summary>
    private async Task ExecuteNodesAsync(
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
            UpdateNodeById(tree, nodeId, "running");
            session.SetVariable("_executionTree", tree);
            SetActiveBlock(session, nodeId, nodeName, InferBlockType(nodeId), "running");
            AppendExecutionLog(session, "info", $"{nodeId}: Starting...");

            if (!string.IsNullOrEmpty(activePhaseId))
            {
                var progress = (int)((double)i / totalNodes * 100);
                UpdatePhaseStatus(session, activePhaseId, "running", progress);
            }

            await _repository.SaveAsync(session);

            string output;
            try
            {
                output = await ExecuteNodeAsync(session, nodeId, workflowConfig, workingDir, previousOutput);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Node execution failed: {NodeId}", nodeId);
                output = $"(error: {ex.Message})";
                UpdateNodeById(tree, nodeId, "error", output);
                session.SetVariable("_executionTree", tree);
                UpdateActiveBlockStatus(session, "error");
                AppendExecutionLog(session, "error", $"{nodeId}: {ex.Message}");
                await _repository.SaveAsync(session);
                continue;
            }

            var truncatedOutput = output.Length > 500 ? output[..500] + "..." : output;
            UpdateNodeById(tree, nodeId, "done", truncatedOutput);
            session.SetVariable("_executionTree", tree);
            UpdateActiveBlockOutput(session, output.Length > 2000 ? output[..2000] + "..." : output);
            UpdateActiveBlockStatus(session, "done");
            AppendExecutionLog(session, "success", $"{nodeId}: Completed ({output.Length} chars)");
            StoreBlockOutput(session, nodeId, InferBlockType(nodeId), output);

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
    private async Task<string?> ExecuteConfigNodesAsync(
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

                if (UpdatePhaseStatus(session, autoPhaseId!, "running", 0))
                    await _repository.SaveAsync(session);
            }

            // Skip already-completed nodes on checkpoint resume
            if (completedNodeIds.Contains(nodeId))
            {
                _logger.LogInformation("Skipping already-completed node '{NodeId}' (checkpoint resume)", nodeId);
                AppendExecutionLog(session, "info", $"Skipped '{nodeId}' (checkpoint resume)");
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
                        lastOutput = await ExecutePhaseNodeAsync(session, configNode, workflowConfig, workingDir, workflowId, displayTree, lastOutput);
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
                        UpdateNodeById(displayTree, nodeId, "done", $"Variable set");
                        session.SetVariable("_executionTree", displayTree);
                        break;
                    default:
                        lastOutput = await ExecuteRegularNodeAsync(session, nodeId, workflowConfig, workingDir, activePhaseId, displayTree, lastOutput, configNode);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Config node execution failed: {NodeId}", nodeId);
                UpdateNodeById(displayTree, nodeId, "error", $"(error: {ex.Message})");
                session.SetVariable("_executionTree", displayTree);
                AppendExecutionLog(session, "error", $"{nodeId}: {ex.Message}");

                // Mark phase as error (top-level only)
                if (autoPhaseId != null)
                    UpdatePhaseStatus(session, autoPhaseId, "error");

                await _repository.SaveAsync(session);

                // Stop sequence on error by default (aligned with "no silent failures" principle).
                // Nodes can opt-in to "continueOnError": true for non-critical steps.
                var continueOnError = configNode.TryGetProperty("continueOnError", out var coeProp)
                    && coeProp.ValueKind == JsonValueKind.True;
                if (!continueOnError)
                {
                    AppendExecutionLog(session, "warning", $"Stopping sequence: node '{nodeId}' failed");
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
            if (autoPhaseId != null && UpdatePhaseStatus(session, autoPhaseId, "done"))
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
        UpdateNodeById(displayTree, nodeId, "running");
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
                AppendExecutionLog(session, "info", $"Resuming while '{nodeId}' at iteration {iteration}");
            }
            // Clear the while state so it's not re-used on next normal execution
            session.SetVariable("_workflowCheckpoint_whileState", null);
        }

        // Initialize iteration variable for condition evaluation
        session.SetVariable("iteration", iteration);
        session.SetVariable("currentIteration", iteration);

        AppendExecutionLog(session, "info", $"Entering while loop '{nodeId}' (max: {safetyMaxIterations})");
        await _repository.SaveAsync(session);

        while (iteration < safetyMaxIterations && EvaluateCondition(condition, session))
        {
            // Check for early stop signal (plateau detection, etc.)
            if (session.GetVariable<bool>("_shouldStop", false))
            {
                AppendExecutionLog(session, "info", $"Early stop: plateau detected at iteration {iteration}");
                break;
            }

            iteration++;
            session.SetVariable("iteration", iteration);
            session.SetVariable("currentIteration", iteration);

            AppendExecutionLog(session, "info", $"While '{nodeId}': iteration {iteration}/{safetyMaxIterations}");

            // Update phase progress based on iteration
            if (!string.IsNullOrEmpty(activePhaseId))
            {
                var progress = (int)((double)iteration / safetyMaxIterations * 100);
                UpdatePhaseStatus(session, activePhaseId, "running", Math.Min(progress, 99));
            }

            // Update while node display with iteration info
            UpdateNodeById(displayTree, nodeId, "running", $"Iteration {iteration}/{safetyMaxIterations}");
            session.SetVariable("_executionTree", displayTree);

            // Reset children to pending for this iteration (except first)
            if (iteration > 1)
            {
                var whileTreeNode = FindNodeById(displayTree, nodeId);
                if (whileTreeNode != null &&
                    whileTreeNode.TryGetValue("children", out var childrenObj) &&
                    childrenObj is List<object> childrenList)
                {
                    ResetNodeTree(childrenList);
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
                lastOutput = await ExecuteConfigNodesAsync(session, children, workflowConfig, workingDir, workflowId, activePhaseId, displayTree, lastOutput);
            }

            // Log iteration result and store detailed metrics
            var fitness = ReadDoubleVariable(session, "currentFitness", 0);
            StoreIterationMetrics(session, activePhaseId, iteration, fitness);
            AppendExecutionLog(session, "info", $"Iteration {iteration} complete. Fitness: {fitness:F2}");
            await _repository.SaveAsync(session);
        }

        // While loop done
        var finalFitness = ReadDoubleVariable(session, "currentFitness", 0);
        var earlyStopped = session.GetVariable<bool>("_shouldStop", false);
        string exitReason;
        if (earlyStopped)
            exitReason = $"plateau (best: {ReadDoubleVariable(session, "_bestFitness", 0):F2}, no improvement for {ReadIntVariable(session, "_plateauCount", 0)} runs)";
        else if (!EvaluateCondition(condition, session))
            exitReason = $"condition met (fitness: {finalFitness:F2})";
        else
            exitReason = $"max iterations reached ({iteration}/{safetyMaxIterations})";

        UpdateNodeById(displayTree, nodeId, "done", $"Completed: {exitReason}");
        session.SetVariable("_executionTree", displayTree);

        AppendExecutionLog(session, "success", $"While loop '{nodeId}' completed after {iteration} iterations: {exitReason}");
        await _repository.SaveAsync(session);

        return lastOutput;
    }

    /// <summary>
    /// Generic conditional node execution. Reads condition from block JSON,
    /// evaluates it, and executes the node (then/else branch selection is
    /// a future evolution — currently executes the node via ExecuteNodeAsync).
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
        var displayName = NodeIdToDisplayName(nodeId);

        // Resolve template references in condition (e.g., {{_nodeResult_review}} or {{state.results.review}})
        var resolvedCondition = ResolveTemplate(condition, session);
        var condResult = EvaluateCondition(resolvedCondition, session);
        AppendExecutionLog(session, "info", $"Conditional '{nodeId}': '{condition}' → '{resolvedCondition}' → {condResult}");

        // Update display tree
        UpdateNodeById(displayTree, nodeId, "running", $"Condition: {condResult}");
        SetActiveBlock(session, nodeId, displayName, "conditional", "running");
        session.SetVariable("_executionTree", displayTree);
        await _repository.SaveAsync(session);

        // Multi-way branches: if "branches" property exists, use resolvedCondition as key
        if (condNode.TryGetProperty("branches", out var branchesObj) && branchesObj.ValueKind == JsonValueKind.Object)
        {
            AppendExecutionLog(session, "info", $"Conditional '{nodeId}': multi-way branch, key='{resolvedCondition}'");

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
                    AppendExecutionLog(session, "info", $"Conditional '{nodeId}': no branch for '{branchKey}', using default");
                    if (defaultBranch.TryGetProperty("blockRef", out var defBlockRef) && defBlockRef.ValueKind == JsonValueKind.String)
                    {
                        mwOutput = await ExecuteBlockRefAsync(session, defBlockRef.GetString()!, defaultBranch, workingDir, displayTree, "default", previousOutput);
                    }
                }
                else
                {
                    AppendExecutionLog(session, "warning", $"Conditional '{nodeId}': no branch for '{branchKey}' and no default");
                }
            }

            // Finalize
            mwOutput ??= previousOutput ?? "";
            var mwTruncated = mwOutput.Length > 500 ? mwOutput[..500] + "..." : mwOutput;
            UpdateNodeById(displayTree, nodeId, "done", mwTruncated);
            session.SetVariable("_executionTree", displayTree);
            session.SetVariable($"_nodeResult_{nodeId}", mwOutput);
            AppendExecutionLog(session, "success", $"{nodeId}: Multi-way branch completed");
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
                    var blockRefId = brBlockRefProp.GetString()!;
                    AppendExecutionLog(session, "info", $"Conditional '{nodeId}': executing '{branchName}' branch → blockRef '{blockRefId}'");
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
                UpdateNodeById(displayTree, nodeId, "error", output);
                session.SetVariable("_executionTree", displayTree);
                UpdateActiveBlockStatus(session, "error");
                AppendExecutionLog(session, "error", $"{nodeId}: {ex.Message}");
                await _repository.SaveAsync(session);
                return previousOutput;
            }
        }
        else
        {
            // Fallback: no branch definition, try legacy ExecuteNodeAsync
            try
            {
                output = await ExecuteNodeAsync(session, nodeId, workflowConfig, workingDir, previousOutput);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Conditional node execution failed: {NodeId}", nodeId);
                output = $"(error: {ex.Message})";
            }
        }

        // Set done
        output ??= previousOutput ?? "";
        var truncated = output.Length > 500 ? output[..500] + "..." : output;
        UpdateNodeById(displayTree, nodeId, "done", truncated);
        session.SetVariable("_executionTree", displayTree);
        UpdateActiveBlockOutput(session, output.Length > 2000 ? output[..2000] + "..." : output);
        UpdateActiveBlockStatus(session, "done");
        StoreBlockOutput(session, nodeId, "conditional", output);
        session.SetVariable($"_nodeResult_{nodeId}", output);
        AppendExecutionLog(session, "success", $"{nodeId}: Completed ({output.Length} chars)");
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

        UpdateNodeById(displayTree, nodeId, "running");
        session.SetVariable("_executionTree", displayTree);
        AppendExecutionLog(session, "info", $"Sequence '{nodeId}': Starting");
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

        UpdateNodeById(displayTree, nodeId, "done");
        session.SetVariable("_executionTree", displayTree);
        AppendExecutionLog(session, "success", $"Sequence '{nodeId}': Completed");
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

        UpdateNodeById(displayTree, nodeId, "running");
        session.SetVariable("_executionTree", displayTree);
        AppendExecutionLog(session, "info", $"Parallel '{nodeId}': Starting children in parallel");
        await _repository.SaveAsync(session);

        // Collect children from "children" or "nodes" property
        JsonElement childrenEl = default;
        var hasChildren = parallelNode.TryGetProperty("children", out childrenEl) && childrenEl.ValueKind == JsonValueKind.Array;
        if (!hasChildren)
            hasChildren = parallelNode.TryGetProperty("nodes", out childrenEl) && childrenEl.ValueKind == JsonValueKind.Array;

        if (!hasChildren)
        {
            AppendExecutionLog(session, "warning", $"Parallel '{nodeId}': No children found");
            UpdateNodeById(displayTree, nodeId, "done", "No children");
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
                    _ => await ExecuteRegularNodeAsync(session, childId, workflowConfig, workingDir, activePhaseId, displayTree, previousOutput, child)
                };
                results.Add(result);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Parallel child '{ChildId}' failed in '{NodeId}'", childId, nodeId);
                AppendExecutionLog(session, "error", $"Parallel child '{childId}': {ex.Message}");
                results.Add(previousOutput);
            }
        }

        // Use the output of the first child as the "main" output (convention: first child is main-workflow)
        var mainOutput = results.Count > 0 ? results[0] : previousOutput;

        UpdateNodeById(displayTree, nodeId, "done", $"All {results.Count} children completed");
        session.SetVariable("_executionTree", displayTree);
        AppendExecutionLog(session, "success", $"Parallel '{nodeId}': All {results.Count} children completed");
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

            AppendExecutionLog(session, "info", $"Workflow paused at node '{nodeId}'. Waiting...");
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

        if (string.IsNullOrEmpty(variableName))
        {
            AppendExecutionLog(session, "error", $"set-variable '{nodeId}': missing 'variable' property");
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
                    AppendExecutionLog(session, "info",
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
                        AppendExecutionLog(session, "info",
                            $"set-variable '{nodeId}': unwrapped '{unwrapField}' → stored {list.Count}-item list in '{variableName}'");
                    }
                    else
                    {
                        // Store object as-is (config objects, non-array wrappers)
                        session.SetVariable(variableName, jObj);
                        AppendExecutionLog(session, "info",
                            $"set-variable '{nodeId}': stored JSON object in '{variableName}' ({trimmed.Length} chars)");
                    }
                }
                else
                {
                    session.SetVariable(variableName, rawValue);
                    AppendExecutionLog(session, "info",
                        $"set-variable '{nodeId}': stored value in '{variableName}' ({trimmed.Length} chars, token type: {token.Type})");
                }
            }
            catch (Exception ex)
            {
                session.SetVariable(variableName, rawValue);
                AppendExecutionLog(session, "warn",
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
                AppendExecutionLog(session, "info",
                    $"set-variable '{nodeId}': extracted {list.Count}-item list from plain text in '{variableName}'");
            }
            else
            {
                session.SetVariable(variableName, rawValue);
                AppendExecutionLog(session, "info",
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
            AppendExecutionLog(session, "error", $"for-each '{nodeId}': missing 'source' property");
            throw new InvalidOperationException($"for-each '{nodeId}': missing 'source' property");
        }

        // Normalize source variable (may be JArray/JsonElement from API — convert to List<object>)
        NormalizeJsonElementToList(session, source);

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
                        NormalizeJsonElementToList(session, source);
                        var normalized = session.GetVariable(source);
                        var count = normalized is List<object> nl ? nl.Count : 0;
                        AppendExecutionLog(session, "info", $"for-each '{nodeId}': parsed source string into {count} items");
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
        NormalizeJsonElementToList(session, source);
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
                    AppendExecutionLog(session, "info",
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
                                AppendExecutionLog(session, "info",
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
            NormalizeJsonElementToList(session, source);
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
                    NormalizeJsonElementToList(session, source);
                    sourceVar = session.GetVariable(source);
                    AppendExecutionLog(session, "info", $"for-each '{nodeId}': parsed JValue string to list");
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
                AppendExecutionLog(session, "info",
                    $"for-each '{nodeId}': extracted {list.Count} items from JObject property '{extractField}'");
            }
        }

        if (sourceVar is not List<object> items || items.Count == 0)
        {
            var errorMsg = $"for-each '{nodeId}': source '{source}' is empty or not a list (type: {sourceVar?.GetType().Name ?? "null"})";
            AppendExecutionLog(session, "error", errorMsg);
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
        UpdateNodeById(displayTree, nodeId, "running", $"0/{items.Count}");
        session.SetVariable("_executionTree", displayTree);

        AppendExecutionLog(session, "info", $"Entering for-each '{nodeId}' over '{source}' ({items.Count} items)");
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
                AppendExecutionLog(session, "info", $"Resuming for-each '{nodeId}' from item index {foreachResumeIndex}");
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
                AppendExecutionLog(session, "info", $"Skipped item '{itemId}' (checkpoint resume)");
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
            var originalTarget = ReadDoubleVariable(session, "targetFitness", 0.85);
            if (phaseStopCondition == "plateau")
            {
                session.SetVariable("targetFitness", 1.0); // Unreachable; plateau stops via _shouldStop
                AppendExecutionLog(session, "info", $"Item '{itemId}' uses plateau detection (runs: {GetConfigInt(iterationConfig, "evaluation.plateauRuns", 5)})");
            }

            // Resolve phaseId: explicit phaseId on item takes priority, fallback to itemId
            var phaseId = itemDict.TryGetValue("phaseId", out var pidVal) ? pidVal?.ToString() : null;

            // Update item status to running (if item has a status field and a valid ID)
            if (itemDict.ContainsKey("status") && itemId != null)
            {
                UpdatePhaseStatus(session, itemId, "running", 0);
            }
            // Also update explicit phaseId if it differs from itemId
            if (phaseId != null && phaseId != itemId)
            {
                UpdatePhaseStatus(session, phaseId, "running", 0);
            }

            // Reset child nodes in display tree for this iteration
            var forEachTreeNode = FindNodeById(displayTree, nodeId);
            if (forEachTreeNode != null &&
                forEachTreeNode.TryGetValue("children", out var childrenObj) &&
                childrenObj is List<object> childrenList)
            {
                ResetNodeTree(childrenList);
            }

            // Save for-each checkpoint state (enables resume at correct item)
            session.SetVariable("_workflowCheckpoint_foreachIndex", new Dictionary<string, object>
            {
                ["nodeId"] = nodeId,
                ["currentIndex"] = itemIndex,
                ["totalItems"] = items.Count
            });

            UpdateNodeById(displayTree, nodeId, "running", $"Item {itemIndex}/{items.Count}: {itemId}");
            session.SetVariable("_executionTree", displayTree);
            AppendExecutionLog(session, "info", $"Starting item '{itemId}' ({itemIndex}/{items.Count})");
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
            // The fix: collect child node IDs and remove them from the checkpoint before each item.
            if (forEachNode.TryGetProperty("nodes", out var children) && children.ValueKind == JsonValueKind.Array)
            {
                var childNodeIds = new HashSet<string>();
                foreach (var child in children.EnumerateArray())
                {
                    if (child.TryGetProperty("id", out var cid))
                        childNodeIds.Add(cid.GetString() ?? "");
                }

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
                ? ReadDoubleVariable(session, "_bestFitness", ReadDoubleVariable(session, "currentFitness", 0))
                : ReadDoubleVariable(session, "currentFitness", 0);
            var iteration = ReadIntVariable(session, "currentIteration", 0);
            var tokens = ReadIntVariable(session, "_tokenCount", 0);

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
                UpdatePhaseStatus(session, itemId, itemStatus);
                StorePhaseSummary(session, itemId, iteration, fitness);
            }
            // Also update explicit phaseId if it differs from itemId
            if (phaseId != null && phaseId != itemId)
            {
                UpdatePhaseStatus(session, phaseId, itemStatus);
                StorePhaseSummary(session, phaseId, iteration, fitness);
            }
            if (itemFailed) failCount++;

            var logLevel = itemFailed ? "error" : "success";
            var logMsg = $"Item '{itemId}' {(itemFailed ? "failed" : "completed")} (fitness: {fitness:F2}, iterations: {iteration}";
            if (tokens > 0) logMsg += $", ~{tokens} tokens";
            logMsg += ")";
            AppendExecutionLog(session, logLevel, logMsg);
            await _repository.SaveAsync(session);
        }

        // For-each loop done — status reflects child results
        var forEachStatus = failCount == items.Count ? "error" : "done";
        var forEachSummary = failCount > 0
            ? $"Completed: {items.Count} items ({failCount} failed)"
            : $"Completed: {items.Count} items";
        UpdateNodeById(displayTree, nodeId, forEachStatus, forEachSummary);
        session.SetVariable("_executionTree", displayTree);
        var forEachLogLevel = failCount == items.Count ? "error" : (failCount > 0 ? "warning" : "success");
        AppendExecutionLog(session, forEachLogLevel, $"for-each '{nodeId}' completed ({items.Count} items, {failCount} failed)");
        await _repository.SaveAsync(session);

        return lastOutput;
    }

    /// <summary>
    /// Executes a "phase" scope node. A phase is a named grouping of child nodes
    /// that share a config section and phase status tracking, but do NOT iterate.
    /// Unlike for-each (iterates over a list) or while (loops on a condition),
    /// a phase executes its children exactly once.
    ///
    /// JSON schema:
    ///   "type": "phase"
    ///   "configSection": "validation"   — key in _workflowConfig for per-phase config
    ///   "nodes": [...]                  — child nodes to execute
    ///
    /// ARCHITECTURE: This is GENERIC infrastructure. The config section name
    /// and child nodes come from the workflow block JSON.
    /// </summary>
    private async Task<string?> ExecutePhaseNodeAsync(
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

        // Resolve per-phase config from _workflowConfig
        var phaseConfig = GetWorkflowConfig(session, workflowId, configSection) ?? workflowConfig;

        // Update phase status to running
        UpdatePhaseStatus(session, configSection, "running", 0);
        UpdateNodeById(displayTree, nodeId, "running", configSection);
        session.SetVariable("_executionTree", displayTree);
        AppendExecutionLog(session, "info", $"Starting phase '{configSection}'");
        await _repository.SaveAsync(session);

        // Execute child nodes with the per-phase config, OR dispatch to blockRef
        string? lastOutput = previousOutput;
        if (phaseNode.TryGetProperty("nodes", out var children) && children.ValueKind == JsonValueKind.Array)
        {
            lastOutput = await ExecuteConfigNodesAsync(
                session, children, phaseConfig, workingDir, workflowId, configSection, displayTree, lastOutput);
        }
        else if (phaseNode.TryGetProperty("blockRef", out var blockRefProp) && blockRefProp.ValueKind == JsonValueKind.String)
        {
            // Phase references an external block (e.g., an agent) — dispatch via BlockExecutorRegistry
            var blockRefId = blockRefProp.GetString()!;
            lastOutput = await ExecuteBlockRefAsync(session, blockRefId, phaseNode, workingDir, displayTree, nodeId, previousOutput);
        }

        // Collect results and finalize phase
        var fitness = ReadDoubleVariable(session, "currentFitness", 0);
        var iteration = ReadIntVariable(session, "currentIteration", 0);

        // Store metrics for this phase (single iteration — phase nodes are one-shot)
        StoreIterationMetrics(session, configSection, Math.Max(iteration, 1), fitness);

        UpdatePhaseStatus(session, configSection, "done");
        StorePhaseSummary(session, configSection, Math.Max(iteration, 1), fitness);

        UpdateNodeById(displayTree, nodeId, "done", $"Phase '{configSection}' complete (fitness: {fitness:F2})");
        session.SetVariable("_executionTree", displayTree);
        AppendExecutionLog(session, "success", $"Phase '{configSection}' completed (fitness: {fitness:F2})");
        await _repository.SaveAsync(session);

        return lastOutput;
    }

    /// <summary>
    /// Dispatches execution to a referenced block (e.g., agent, tool) via BlockExecutorRegistry.
    /// Resolves the block by ID, builds inputs from the phase node config, and runs it.
    /// </summary>
    private async Task<string?> ExecuteBlockRefAsync(
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
            AppendExecutionLog(session, "error", $"No executor registry for blockRef '{blockRefId}'");
            throw new InvalidOperationException($"BlockExecutorRegistry not available — cannot execute blockRef '{blockRefId}'");
        }

        // Resolve the block definition
        var block = await _blockDiscovery.GetByIdAsync(NormalizeBlockId(blockRefId), session.BlockSearchPaths);
        if (block == null)
        {
            _logger.LogWarning("Block not found for blockRef: {BlockRef}", blockRefId);
            AppendExecutionLog(session, "error", $"Block not found: {blockRefId}");
            throw new InvalidOperationException($"Block not found: {blockRefId}");
        }

        // Get executor for this block type
        var executor = _executorRegistry.Get(block.BlockType);
        if (executor == null)
        {
            _logger.LogWarning("No executor for block type '{BlockType}' (blockRef: {BlockRef})", block.BlockType, blockRefId);
            AppendExecutionLog(session, "error", $"No executor for block type '{block.BlockType}'");
            throw new InvalidOperationException($"No executor for block type '{block.BlockType}' (blockRef: {blockRefId})");
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

        AppendExecutionLog(session, "info", $"Executing blockRef '{blockRefId}' (type: {block.BlockType}) with {inputs.Count} inputs");
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
                AppendExecutionLog(session, "info",
                    $"blockRef '{blockRefId}' has {nodesElement.Value.GetArrayLength()} config.nodes — executing as composite");

                try
                {
                    var compositeOutput = await ExecuteConfigNodesAsync(
                        session, nodesElement.Value, null, workingDir, blockRefId, null, displayTree, previousOutput);
                    AppendExecutionLog(session, "success", $"blockRef '{blockRefId}' composite execution completed");
                    return compositeOutput;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Composite blockRef execution failed: {BlockRef}", blockRefId);
                    AppendExecutionLog(session, "error", $"blockRef '{blockRefId}' composite error: {ex.Message}");
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

        try
        {
            var result = await executor.ExecuteAsync(block, execContext, inputs);

            // Propagate agent/executor internal logs to session execution log
            // so they're visible in the TUI monitor for diagnosis
            if (result.Logs != null && result.Logs.Count > 0)
            {
                foreach (var log in result.Logs)
                    AppendExecutionLog(session, "info", $"[{blockRefId}] {log}");
            }

            // Log LLM activity if available
            if (result.Outputs.TryGetValue("response", out var response))
            {
                AppendToLLMActivity(session, new Dictionary<string, object>
                {
                    { "type", "agent" },
                    { "blockRef", blockRefId },
                    { "response", response?.ToString()?.Length > 500 ? response.ToString()![..500] + "..." : response?.ToString() ?? "" },
                    { "timestamp", DateTime.UtcNow.ToString("o") }
                });
            }

            // Build output string from result.
            // Filter out internal metadata keys (starting with '_') so they don't
            // contaminate downstream JSON parsing (e.g., _conversationState from agents).
            var contentOutputs = result.Outputs
                .Where(kv => !kv.Key.StartsWith("_"))
                .ToDictionary(kv => kv.Key, kv => kv.Value);

            // Single output: raw value (no "key: " prefix that would break downstream JSON parsing)
            // Multiple outputs: keep "key: value" format for disambiguation
            string output;
            if (contentOutputs.Count == 1)
            {
                output = contentOutputs.Values.First()?.ToString() ?? "";
            }
            else if (contentOutputs.Count > 1)
            {
                var outputParts = new List<string>();
                foreach (var kv in contentOutputs)
                    outputParts.Add($"{kv.Key}: {kv.Value}");
                output = string.Join("\n", outputParts);
            }
            else
            {
                output = result.Success
                    ? $"Block '{blockRefId}' completed successfully"
                    : $"Block '{blockRefId}' failed";
            }

            if (!result.Success)
            {
                AppendExecutionLog(session, "error", $"blockRef '{blockRefId}' failed: {output}");
                // Propagate block failure as exception so caller marks node as "error"
                // and sequence-level error handling can stop execution.
                throw new InvalidOperationException($"Block '{blockRefId}' failed: {output}");
            }

            AppendExecutionLog(session, "success", $"blockRef '{blockRefId}' completed ({output.Length} chars)");
            return output;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "BlockRef execution failed: {BlockRef}", blockRefId);
            AppendExecutionLog(session, "error", $"blockRef '{blockRefId}' error: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Executes a single regular (non-control-flow) config node.
    /// Updates the display tree, sets active block, and chains output.
    /// </summary>
    private async Task<string?> ExecuteRegularNodeAsync(
        Domain.Entities.ProjectSession session,
        string nodeId,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        string? activePhaseId,
        List<object> displayTree,
        string? previousOutput,
        JsonElement? nodeConfig = null)
    {
        // INFRA-1: BlockRef dispatch — if the node has a blockRef (or deprecated blockId), dispatch via executor registry
        // This takes priority over pattern-matching by nodeId.
        string? resolvedBlockRef = null;
        if (nodeConfig.HasValue)
        {
            if (nodeConfig.Value.TryGetProperty("blockRef", out var blockRefProp) && blockRefProp.ValueKind == JsonValueKind.String)
            {
                resolvedBlockRef = blockRefProp.GetString();
            }
            else if (nodeConfig.Value.TryGetProperty("blockId", out var blockIdProp) && blockIdProp.ValueKind == JsonValueKind.String)
            {
                resolvedBlockRef = blockIdProp.GetString();
                _logger.LogWarning("Node '{NodeId}' uses deprecated 'blockId' — use 'blockRef' instead", nodeId);
            }
        }

        if (resolvedBlockRef != null)
        {
            var blockRefId = resolvedBlockRef;
            var displayName = NodeIdToDisplayName(nodeId);

            UpdateNodeById(displayTree, nodeId, "running", $"Executing {blockRefId}...");
            session.SetVariable("_executionTree", displayTree);
            SetActiveBlock(session, nodeId, displayName, "block", "running");
            AppendExecutionLog(session, "info", $"{nodeId}: Starting blockRef '{blockRefId}'...");
            await _repository.SaveAsync(session);

            try
            {
                var output = await ExecuteBlockRefAsync(
                    session, blockRefId, nodeConfig.Value, workingDir, displayTree, nodeId, previousOutput);

                var truncated = output != null && output.Length > 500 ? output[..500] + "..." : output;
                UpdateNodeById(displayTree, nodeId, "done", truncated);
                session.SetVariable("_executionTree", displayTree);
                UpdateActiveBlockOutput(session, output != null && output.Length > 2000 ? output[..2000] + "..." : output ?? "");
                UpdateActiveBlockStatus(session, "done");
                AppendExecutionLog(session, "success", $"{nodeId}: blockRef '{blockRefId}' completed ({output?.Length ?? 0} chars)");
                StoreBlockOutput(session, nodeId, "block", output ?? "");
                // Store result as named session variable for {{state.results.<nodeId>}} template resolution
                session.SetVariable($"_nodeResult_{nodeId}", output ?? "");
                await _repository.SaveAsync(session);
                await Task.Delay(500);
                return output;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "BlockRef execution failed: {NodeId} → {BlockRef}", nodeId, blockRefId);
                var errorMsg = $"(error executing blockRef '{blockRefId}': {ex.Message})";
                UpdateNodeById(displayTree, nodeId, "error", errorMsg);
                session.SetVariable("_executionTree", displayTree);
                UpdateActiveBlockStatus(session, "error");
                AppendExecutionLog(session, "error", $"{nodeId}: {ex.Message}");
                // Store error output so _nodeResult_{nodeId} is set even on failure
                session.SetVariable($"_nodeResult_{nodeId}", errorMsg);
                await _repository.SaveAsync(session);
                // Re-throw so the sequence-level handler can stop execution
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
            AppendExecutionLog(session, "error", errorMsg);
            UpdateNodeById(displayTree, nodeId, "error", errorMsg);
            session.SetVariable("_executionTree", displayTree);
            await _repository.SaveAsync(session);
            throw new InvalidOperationException(errorMsg);
        }

        // Standard pattern-matching dispatch (fallback for nodes without blockRef)
        var displayName2 = NodeIdToDisplayName(nodeId);
        var blockType = InferBlockType(nodeId);

        // Hint shown in the tree while the node is running
        var runHint = blockType switch
        {
            "inference" => "Calling LLM...",
            "script" => "Running...",
            "validator" => "Evaluating...",
            _ => null
        };

        // Set running with hint
        UpdateNodeById(displayTree, nodeId, "running", runHint);
        session.SetVariable("_executionTree", displayTree);
        SetActiveBlock(session, nodeId, displayName2, blockType, "running");
        AppendExecutionLog(session, "info", $"{nodeId}: Starting...");
        await _repository.SaveAsync(session);

        // Execute the node
        string output2;
        try
        {
            output2 = await ExecuteNodeAsync(session, nodeId, workflowConfig, workingDir, previousOutput, nodeConfig);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Node execution failed: {NodeId}", nodeId);
            output2 = $"(error: {ex.Message})";
            UpdateNodeById(displayTree, nodeId, "error", output2);
            session.SetVariable("_executionTree", displayTree);
            UpdateActiveBlockStatus(session, "error");
            AppendExecutionLog(session, "error", $"{nodeId}: {ex.Message}");
            await _repository.SaveAsync(session);
            // Re-throw so the sequence-level handler can stop execution
            throw;
        }

        // Set done
        var truncatedOutput = output2.Length > 500 ? output2[..500] + "..." : output2;
        UpdateNodeById(displayTree, nodeId, "done", truncatedOutput);
        session.SetVariable("_executionTree", displayTree);
        UpdateActiveBlockOutput(session, output2.Length > 2000 ? output2[..2000] + "..." : output2);
        UpdateActiveBlockStatus(session, "done");
        AppendExecutionLog(session, "success", $"{nodeId}: Completed ({output2.Length} chars)");
        StoreBlockOutput(session, nodeId, blockType, output2);
        await _repository.SaveAsync(session);
        await Task.Delay(500);

        return output2;
    }

    /// <summary>
    /// Executes a single node based on its ID pattern.
    ///
    /// NOTE: This uses pattern-matching on nodeId as a pragmatic compromise.
    /// The fully generic approach would use BlockExecutorRegistry to dispatch
    /// each node to its IBlockExecutor. This is the next evolution step.
    /// See docs/phases/PHASE-8/REFACTOR-ENTRYPOINT-EXECUTOR.md §4.
    /// </summary>
    private async Task<string> ExecuteNodeAsync(
        Domain.Entities.ProjectSession session,
        string nodeId,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        string? previousOutput,
        JsonElement? nodeConfig = null)
    {
        // Order matters: more specific patterns first, broader patterns last.

        // Apply/write nodes: write output to file (before "generate" to avoid "apply-improvements" matching "improvement")
        if (nodeId.Contains("apply") || nodeId.Contains("write"))
        {
            return await ExecuteWriteNodeAsync(session, workflowConfig, workingDir, previousOutput, nodeConfig);
        }

        // Load nodes: read the current artifact from disk (the file being improved)
        if (nodeId.Contains("load"))
        {
            return await ExecuteLoadNodeAsync(session, workflowConfig, workingDir);
        }

        // Training/run nodes: re-read the current artifact from disk.
        // This ensures each iteration starts fresh from the actual file state,
        // not from stale write-result messages like "Written to X" or "Write blocked".
        if (nodeId.Contains("training") || nodeId.Contains("run-"))
        {
            return await ExecuteLoadNodeAsync(session, workflowConfig, workingDir);
        }

        // Evaluate nodes: passthrough (pass previous output as-is for next node)
        if (nodeId.Contains("evaluate"))
        {
            return previousOutput ?? "(no input to evaluate)";
        }

        // LLM/generate nodes: call LLM with config-driven prompts
        if (nodeId.Contains("generate"))
        {
            return await ExecuteLLMNodeAsync(session, nodeId, workflowConfig, previousOutput, nodeConfig);
        }

        // Validation/fitness/metrics nodes: evaluate with config-driven criteria
        if (nodeId.Contains("check") || nodeId.Contains("fitness") || nodeId.Contains("validate") || nodeId.Contains("metrics"))
        {
            return ExecuteValidationNode(session, workflowConfig, previousOutput);
        }

        // Finalize nodes: summary
        if (nodeId.Contains("finalize") || nodeId.Contains("final"))
        {
            var fitness = session.GetVariable<double>("currentFitness", 0);
            var iteration = session.GetVariable<int>("currentIteration", 0);
            return $"Workflow finalized. Fitness: {fitness:F2}, Iterations: {iteration}";
        }

        // Tree documenter: generates session workflow/block tree as markdown
        if (nodeId.Contains("doc-tree") || nodeId.Contains("tree-doc"))
        {
            return await ExecuteTreeDocumenterAsync(session, workflowConfig, workingDir, nodeConfig);
        }

        // Shell/script nodes: execute a command specified in inputs.command
        if (nodeId.Contains("shell") || nodeId.Contains("script"))
        {
            return await ExecuteShellNodeAsync(session, workingDir, nodeConfig);
        }

        // Default: passthrough
        return previousOutput ?? $"Node '{nodeId}' executed (passthrough)";
    }

    // ===== Node Type Executors (read config from session variables) =====

    /// <summary>
    /// Loads the current artifact file from disk. Reads output.filename from workflowConfig.
    /// If the file doesn't exist yet (first iteration), returns a placeholder.
    /// </summary>
    private async Task<string> ExecuteLoadNodeAsync(
        Domain.Entities.ProjectSession session,
        Dictionary<string, object>? workflowConfig,
        string workingDir)
    {
        var filename = GetConfigString(workflowConfig, "output.filename", "output.json");
        var filePath = Path.Combine(workingDir, filename);

        if (File.Exists(filePath))
        {
            var content = await File.ReadAllTextAsync(filePath);
            // Pre-populate _tokenCount so first iteration prompts have context
            var tokenCount = content.Split(new[] { ' ', '\n', '\t', '\r' }, StringSplitOptions.RemoveEmptyEntries).Length;
            session.SetVariable("_tokenCount", tokenCount);
            AppendExecutionLog(session, "info", $"Loaded artifact: {filename} ({content.Length} chars, ~{tokenCount} tokens)");
            return content;
        }

        AppendExecutionLog(session, "info", $"Artifact not found: {filename} (first iteration, starting fresh)");
        return "(no existing artifact — first iteration)";
    }

    private async Task<string> ExecuteLLMNodeAsync(
        Domain.Entities.ProjectSession session,
        string nodeId,
        Dictionary<string, object>? workflowConfig,
        string? context,
        JsonElement? nodeConfig = null)
    {
        var systemPrompt = GetConfigString(workflowConfig, "llm.systemPrompt",
            "You are an assistant. Process the following context and generate output.");
        var userTemplate = GetConfigString(workflowConfig, "llm.userPromptTemplate",
            "Process the following:\n\n{{context}}");
        var maxTokens = GetConfigInt(workflowConfig, "llm.maxTokens", 1024);
        var temperature = GetConfigFloat(workflowConfig, "llm.temperature", 0.7f);

        // Node-level model selection: read from node inputs first, then phase config, then default
        // Priority: node.inputs.model > _workflowConfig.llm.model > appsettings default
        var modelId = GetNodeInput(nodeConfig, "model")
            ?? GetConfigString(workflowConfig, "llm.model", null);

        // Node-level prompt overrides (allows per-node customization in config.nodes)
        var nodeSystemPrompt = GetNodeInput(nodeConfig, "systemPrompt");
        if (!string.IsNullOrEmpty(nodeSystemPrompt)) systemPrompt = nodeSystemPrompt;
        var nodeUserPrompt = GetNodeInput(nodeConfig, "userPromptTemplate");
        if (!string.IsNullOrEmpty(nodeUserPrompt)) userTemplate = nodeUserPrompt;

        long modelSwitchMs = 0;
        if (!string.IsNullOrEmpty(modelId))
        {
            AppendExecutionLog(session, "info", $"Switching to model: {modelId}");
            await _repository.SaveAsync(session);
            var switchWatch = Stopwatch.StartNew();
            await _llmGateway.SwitchModelAsync(modelId);
            switchWatch.Stop();
            modelSwitchMs = switchWatch.ElapsedMilliseconds;
            AppendExecutionLog(session, "info", $"Model switch: {modelId} ({modelSwitchMs}ms)");
        }

        // Replace {{context}} placeholder first, then resolve remaining {{variable}} references
        var userPrompt = userTemplate.Replace("{{context}}", context ?? "(no context)");
        userPrompt = ResolveTemplate(userPrompt, session);
        systemPrompt = ResolveTemplate(systemPrompt, session);

        var request = new LLMRequest
        {
            Messages = new List<ChatMessage>
            {
                ChatMessage.System(systemPrompt),
                ChatMessage.User(userPrompt)
            },
            MaxNewTokens = maxTokens,
            Temperature = temperature,
            ModelId = !string.IsNullOrEmpty(modelId) ? modelId : null
        };

        var stopwatch = Stopwatch.StartNew();
        var response = await _llmGateway.SendAsync(request);
        stopwatch.Stop();

        var inferenceMs = stopwatch.ElapsedMilliseconds;

        // Track LLM activity for TUI chat view (enriched with timing + tokens)
        var activity = new Dictionary<string, object>
        {
            ["time"] = DateTime.Now.ToString("HH:mm:ss"),
            ["nodeId"] = nodeId,
            ["model"] = modelId ?? "default",
            ["modelSwitchMs"] = modelSwitchMs,
            ["inferenceMs"] = inferenceMs,
            ["totalMs"] = modelSwitchMs + inferenceMs,
            ["promptTokens"] = response.PromptTokens,
            ["completionTokens"] = response.CompletionTokens,
            ["totalTokens"] = response.TotalTokens,
            ["systemPrompt"] = systemPrompt,
            ["userPrompt"] = userPrompt,
            ["promptPreview"] = userPrompt.Length > 200 ? userPrompt[..200] + "..." : userPrompt,
            ["responsePreview"] = response.Content.Length > 300 ? response.Content[..300] + "..." : response.Content,
            ["fullResponse"] = response.Content,
            ["responseLength"] = response.Content.Length,
            ["duration"] = Math.Round(stopwatch.Elapsed.TotalSeconds, 1)
        };
        AppendToLLMActivity(session, activity);

        AppendExecutionLog(session, "success", $"LLM response received ({response.Content.Length} chars, {inferenceMs}ms, switch: {modelSwitchMs}ms, tokens: {response.TotalTokens})");

        // Try to extract clean JSON from LLM response — small LLMs often wrap JSON
        // in markdown code blocks or add prose around it
        var extracted = TryExtractJson(response.Content);
        if (extracted != null && extracted != response.Content)
        {
            AppendExecutionLog(session, "info", $"Extracted JSON from LLM response ({response.Content.Length} → {extracted.Length} chars)");
            return extracted;
        }

        return response.Content;
    }

    private async Task<string> ExecuteWriteNodeAsync(
        Domain.Entities.ProjectSession session,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        string? content,
        JsonElement? nodeConfig = null)
    {
        // Support inputs.filename override from node config
        var filename = GetNodeInput(nodeConfig, "filename")
            ?? GetConfigString(workflowConfig, "output.filename", "output.json");
        var outputPath = Path.Combine(workingDir, filename);

        // Support inputs.source: write a session variable instead of previousOutput
        var sourceVar = GetNodeInput(nodeConfig, "source");
        if (!string.IsNullOrEmpty(sourceVar))
        {
            var varValue = session.GetVariable(sourceVar);
            if (varValue != null)
            {
                content = JsonSerializer.Serialize(varValue, new JsonSerializerOptions { WriteIndented = true });
                AppendExecutionLog(session, "info", $"Writing session variable '{sourceVar}' to {filename}");
            }
            else
            {
                return $"Variable '{sourceVar}' not found";
            }
        }

        if (string.IsNullOrEmpty(content))
        {
            return $"No content to write to {filename}";
        }

        // Quality gate: for .json files, only write valid JSON to prevent garbage feedback loops.
        // If the LLM produced invalid output, keep the previous version on disk.
        if (filename.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                JsonDocument.Parse(content);
            }
            catch (JsonException)
            {
                AppendExecutionLog(session, "warning", $"Write blocked: content is not valid JSON. Keeping previous {filename} on disk.");
                return $"Write blocked: invalid JSON ({content.Length} chars). Previous version preserved.";
            }
        }

        try
        {
            await File.WriteAllTextAsync(outputPath, content);
            var fileSize = new FileInfo(outputPath).Length;
            var sizeStr = fileSize > 1024 ? $"{fileSize / 1024.0:F1} KB" : $"{fileSize} B";
            AddArtifact(session, filename, "output", sizeStr, "new");
            return $"Written to {outputPath} ({sizeStr})";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to write output file: {Path}", outputPath);
            return $"Write failed: {ex.Message}. Content length: {content.Length} chars";
        }
    }

    /// <summary>
    /// Generates a markdown document describing the session's workflow/block tree.
    /// Reads entry points, loads blocks recursively, and documents each block.
    /// Generic — works for any session type and any block type (workflow, agent, task).
    /// Non-atomic blocks are traversed recursively via config.nodes.
    /// </summary>
    private async Task<string> ExecuteTreeDocumenterAsync(
        Domain.Entities.ProjectSession session,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        JsonElement? nodeConfig = null)
    {
        var sb = new System.Text.StringBuilder();
        // Collect node details during traversal for the details section
        var nodeDetails = new List<Dictionary<string, object>>();

        // Header bar (TUI style)
        sb.AppendLine("```");
        sb.AppendLine("\u250c\u2500 SESSION \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
        var shortId = session.Id.Length >= 8 ? session.Id[..8] : session.Id;
        sb.AppendLine($"\u2502  {session.Name,-50} {shortId}  {session.Status,-8} \u2502");
        if (!string.IsNullOrEmpty(session.RepositoryPath))
            sb.AppendLine($"\u2502  repo: {session.RepositoryPath,-60} \u2502");
        sb.AppendLine("\u2502                                                                              \u2502");

        // Entry points
        if (session.EntryPoints.Count > 0)
        {
            sb.AppendLine("\u2502  Entry Points:                                                              \u2502");
            foreach (var ep in session.EntryPoints)
                sb.AppendLine($"\u2502    {ep.Key,-16} \u2192 {ep.Value,-52} \u2502");
        }

        sb.AppendLine("\u251c\u2500 BLOCK TREE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
        sb.AppendLine("\u2502                                                                              \u2502");

        // Collect unique block IDs from entry points
        var entryBlockIds = session.EntryPoints.Values.Distinct().ToList();
        var documentedBlocks = new HashSet<string>();

        foreach (var rawId in entryBlockIds)
        {
            var normalizedId = NormalizeBlockId(rawId);
            var block = await _blockDiscovery.GetByIdAsync(normalizedId, session.BlockSearchPaths);
            if (block == null)
            {
                sb.AppendLine($"\u2502  \u2717 {rawId,-64} [not found] \u2502");
                continue;
            }

            // Root block header with type symbol
            var typeSymbol = block.BlockType switch
            {
                "workflow" => "\u25bc",
                "agent" => "\u25c6",
                "task" => "\u25b6",
                _ => "\u25cb"
            };
            sb.AppendLine($"\u2502  {typeSymbol} {block.Name,-56} [{block.BlockType}] \u2502");
            sb.AppendLine($"\u2502    {block.Id}  v{block.Version}");
            sb.AppendLine("\u2502");

            // Non-atomic blocks may have config.nodes — walk them as a tree
            if (!block.IsAtomic && block.Config != null && block.Config.TryGetValue("nodes", out var nodesObj))
            {
                var nodesJson = JsonSerializer.Serialize(nodesObj);
                var nodes = JsonDocument.Parse(nodesJson).RootElement;
                if (nodes.ValueKind == JsonValueKind.Array)
                {
                    var nodeCount = nodes.GetArrayLength();
                    await DocumentNodesRecursive(sb, nodes, documentedBlocks, nodeDetails, "    ", nodeCount, session.BlockSearchPaths);
                }
            }

            documentedBlocks.Add(block.Id);
        }

        sb.AppendLine("\u2502");

        // NODE DETAILS section
        sb.AppendLine("\u251c\u2500 NODE DETAILS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
        sb.AppendLine("\u2502");

        foreach (var nd in nodeDetails)
        {
            var ndId = nd["nodeId"] as string ?? "?";
            var ndRef = nd.TryGetValue("blockRef", out var brVal) ? brVal as string : null;
            var ndType = nd["blockType"] as string ?? "tool";
            var ndDesc = nd.TryGetValue("description", out var dVal) ? dVal as string : null;
            var ndInputs = nd.TryGetValue("nodeInputs", out var niVal) ? niVal as Dictionary<string, string> : null;

            if (!string.IsNullOrEmpty(ndRef))
                sb.AppendLine($"\u2502  {ndId,-30} \u2192 {ndRef,-22} [{ndType}]");
            else
                sb.AppendLine($"\u2502  {ndId,-30}                        [{ndType}]");

            if (!string.IsNullOrEmpty(ndDesc))
                sb.AppendLine($"\u2502  {ndDesc}");

            if (ndInputs != null && ndInputs.Count > 0)
            {
                sb.AppendLine($"\u2502  Params:");
                foreach (var (key, value) in ndInputs)
                {
                    var displayVal = value.Length > 60 ? value[..57] + "..." : value;
                    sb.AppendLine($"\u2502    {key,-20} = {displayVal}");
                }
            }

            sb.AppendLine("\u2502");
        }

        // Root block details (with inputs/outputs from source JSON)
        foreach (var blockId in documentedBlocks.OrderBy(b => b))
        {
            var block = await _blockDiscovery.GetByIdAsync(blockId, session.BlockSearchPaths);
            if (block == null) continue;

            sb.AppendLine($"\u2502  \u2500\u2500 {block.Name} \u2500\u2500");
            sb.AppendLine($"\u2502  ID: {block.Id}  Type: {block.BlockType}  Atomic: {(block.IsAtomic ? "yes" : "no")}");
            if (!string.IsNullOrEmpty(block.Description))
                sb.AppendLine($"\u2502  {block.Description}");

            // Try to read inputs/outputs from source JSON file
            if (block.Metadata?.TryGetValue("_sourcePath", out var spObj) == true
                && spObj is string sourcePath && File.Exists(sourcePath))
            {
                try
                {
                    var rawJson = await File.ReadAllTextAsync(sourcePath);
                    using var sourceDoc = JsonDocument.Parse(rawJson);
                    var root = sourceDoc.RootElement;

                    if (root.TryGetProperty("inputs", out var inputsEl) && inputsEl.ValueKind == JsonValueKind.Array)
                    {
                        sb.AppendLine("\u2502  Inputs:");
                        foreach (var inp in inputsEl.EnumerateArray())
                        {
                            var iId = inp.TryGetProperty("id", out var ii) ? ii.GetString() : "?";
                            var iType = inp.TryGetProperty("type", out var it) ? it.GetString() : "any";
                            var iDesc = inp.TryGetProperty("description", out var id) ? id.GetString() : "";
                            var iReq = inp.TryGetProperty("required", out var ir) && ir.GetBoolean();
                            sb.AppendLine($"\u2502    {iId,-20} ({iType,-8}) {(iReq ? "*" : " ")} {iDesc}");
                        }
                    }

                    if (root.TryGetProperty("outputs", out var outputsEl) && outputsEl.ValueKind == JsonValueKind.Array)
                    {
                        sb.AppendLine("\u2502  Outputs:");
                        foreach (var outp in outputsEl.EnumerateArray())
                        {
                            var oId = outp.TryGetProperty("id", out var oi) ? oi.GetString() : "?";
                            var oType = outp.TryGetProperty("type", out var ot) ? ot.GetString() : "any";
                            var oDesc = outp.TryGetProperty("description", out var od) ? od.GetString() : "";
                            sb.AppendLine($"\u2502    {oId,-20} ({oType,-8})   {oDesc}");
                        }
                    }
                }
                catch { /* skip if source JSON is unreadable */ }
            }

            sb.AppendLine("\u2502");
        }

        sb.AppendLine("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518");
        sb.AppendLine("```");

        var markdown = sb.ToString();

        // If a filename is specified in node inputs, write directly to file
        var outputFilename = GetNodeInput(nodeConfig, "filename");
        if (!string.IsNullOrEmpty(outputFilename))
        {
            var outputPath = Path.Combine(workingDir, outputFilename);
            var dir = Path.GetDirectoryName(outputPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                Directory.CreateDirectory(dir);
            await File.WriteAllTextAsync(outputPath, markdown);
            AddArtifact(session, outputFilename, "documentation", $"{markdown.Length} B", "new");
            AppendExecutionLog(session, "success", $"Tree documentation written to {outputFilename}");
        }

        return markdown;
    }

    /// <summary>
    /// Recursively documents config.nodes using TUI box-drawing characters.
    /// Collects node details (blockRef, type, description, inputs) for the details section.
    /// </summary>
    private async Task DocumentNodesRecursive(
        System.Text.StringBuilder sb,
        JsonElement nodes,
        HashSet<string> documentedBlocks,
        List<Dictionary<string, object>> nodeDetails,
        string linePrefix,
        int totalSiblings,
        IReadOnlyList<string>? blockSearchPaths = null)
    {
        var index = 0;
        foreach (var node in nodes.EnumerateArray())
        {
            index++;
            var nodeId = node.TryGetProperty("id", out var idP) ? idP.GetString() ?? "?" : "?";
            var blockRef = node.TryGetProperty("blockRef", out var brP) ? brP.GetString() : null;
            var nodeType = node.TryGetProperty("type", out var ntP) ? ntP.GetString() : null;
            var isLast = index == totalSiblings;
            var branch = isLast ? "\u2514\u2500" : "\u251c\u2500";
            var childPrefix = isLast ? "  " : "\u2502 ";

            // Extract node-level inputs for the details section
            var nodeInputs = new Dictionary<string, string>();
            if (node.TryGetProperty("inputs", out var inputsEl) && inputsEl.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in inputsEl.EnumerateObject())
                {
                    nodeInputs[prop.Name] = prop.Value.ValueKind == JsonValueKind.String
                        ? prop.Value.GetString() ?? "" : prop.Value.ToString();
                }
            }

            if (nodeType == "while")
            {
                var condition = node.TryGetProperty("condition", out var cP) ? cP.GetString() : "?";
                sb.AppendLine($"\u2502{linePrefix}{branch} \u21bb {nodeId,-30} (while: {condition})");

                nodeDetails.Add(new Dictionary<string, object>
                {
                    ["nodeId"] = nodeId, ["blockType"] = "while",
                    ["description"] = $"Loop: {condition}"
                });

                if (node.TryGetProperty("nodes", out var children) && children.ValueKind == JsonValueKind.Array)
                {
                    var childCount = children.GetArrayLength();
                    await DocumentNodesRecursive(sb, children, documentedBlocks, nodeDetails,
                        linePrefix + childPrefix, childCount, blockSearchPaths);
                }
            }
            else if (nodeType == "for-each")
            {
                var source = node.TryGetProperty("source", out var sP) ? sP.GetString() : "?";
                sb.AppendLine($"\u2502{linePrefix}{branch} \u2200 {nodeId,-30} (for-each: {source})");

                nodeDetails.Add(new Dictionary<string, object>
                {
                    ["nodeId"] = nodeId, ["blockType"] = "for-each",
                    ["description"] = $"Iterate over: {source}"
                });

                if (node.TryGetProperty("nodes", out var children) && children.ValueKind == JsonValueKind.Array)
                {
                    var childCount = children.GetArrayLength();
                    await DocumentNodesRecursive(sb, children, documentedBlocks, nodeDetails,
                        linePrefix + childPrefix, childCount, blockSearchPaths);
                }
            }
            else if (nodeType == "phase")
            {
                var configSection = node.TryGetProperty("configSection", out var csP) ? csP.GetString() : nodeId;
                sb.AppendLine($"\u2502{linePrefix}{branch} \u25b6 {nodeId,-30} (phase: {configSection})");

                nodeDetails.Add(new Dictionary<string, object>
                {
                    ["nodeId"] = nodeId, ["blockType"] = "phase",
                    ["description"] = $"Phase scope: {configSection}"
                });

                if (node.TryGetProperty("nodes", out var children) && children.ValueKind == JsonValueKind.Array)
                {
                    var childCount = children.GetArrayLength();
                    await DocumentNodesRecursive(sb, children, documentedBlocks, nodeDetails,
                        linePrefix + childPrefix, childCount, blockSearchPaths);
                }
            }
            else if (nodeType == "conditional")
            {
                var condition = node.TryGetProperty("condition", out var cP) ? cP.GetString() : "?";
                sb.AppendLine($"\u2502{linePrefix}{branch} \u25c7 {nodeId,-30} (if: {condition})");

                nodeDetails.Add(new Dictionary<string, object>
                {
                    ["nodeId"] = nodeId, ["blockType"] = "conditional",
                    ["description"] = $"Condition: {condition}"
                });

                if (node.TryGetProperty("nodes", out var children) && children.ValueKind == JsonValueKind.Array)
                {
                    var childCount = children.GetArrayLength();
                    await DocumentNodesRecursive(sb, children, documentedBlocks, nodeDetails,
                        linePrefix + childPrefix, childCount, blockSearchPaths);
                }
            }
            else
            {
                // Resolve block type from discovery or infer from blockRef
                string blockType = "tool";
                string? blockDescription = null;

                if (!string.IsNullOrEmpty(blockRef))
                {
                    var block = await _blockDiscovery.GetByIdAsync(blockRef, blockSearchPaths ?? Array.Empty<string>());
                    if (block != null)
                    {
                        blockType = block.BlockType;
                        blockDescription = block.Description;
                        documentedBlocks.Add(block.Id);

                        if (!block.IsAtomic && block.Config != null
                            && block.Config.TryGetValue("nodes", out var childNodesObj))
                        {
                            var childJson = JsonSerializer.Serialize(childNodesObj);
                            var childNodes = JsonDocument.Parse(childJson).RootElement;
                            if (childNodes.ValueKind == JsonValueKind.Array)
                            {
                                var childCount = childNodes.GetArrayLength();
                                await DocumentNodesRecursive(sb, childNodes, documentedBlocks, nodeDetails,
                                    linePrefix + childPrefix, childCount, blockSearchPaths);
                            }
                        }
                    }
                    else
                    {
                        // System built-in: infer type and description from blockRef name
                        (blockType, blockDescription) = InferSystemBlockInfo(blockRef);
                    }
                }

                sb.AppendLine($"\u2502{linePrefix}{branch} \u25cb {nodeId,-24} \u2192 {blockRef ?? "",-20} [{blockType}]");

                var detail = new Dictionary<string, object>
                {
                    ["nodeId"] = nodeId,
                    ["blockType"] = blockType
                };
                if (!string.IsNullOrEmpty(blockRef)) detail["blockRef"] = blockRef;
                if (!string.IsNullOrEmpty(blockDescription)) detail["description"] = blockDescription;
                if (nodeInputs.Count > 0) detail["nodeInputs"] = nodeInputs;
                nodeDetails.Add(detail);
            }
        }
    }

    /// <summary>
    /// Infers block type and description for system built-in blocks
    /// that don't have a block definition JSON file.
    /// </summary>
    private static (string type, string description) InferSystemBlockInfo(string blockRef)
    {
        var name = blockRef.Contains(':') ? blockRef.Split(':').Last() : blockRef;
        return name switch
        {
            "block-loader" => ("tool", "Loads block definitions from the registry"),
            "artifact-loader" => ("tool", "Loads the current artifact file from disk"),
            "inference" => ("inference", "Calls LLM gateway for text generation"),
            "validator" => ("validator", "Evaluates output against configured criteria"),
            "file-writer" => ("tool", "Writes content to a file in the repository"),
            "shell" => ("tool", "Executes a shell command in the working directory"),
            "tree-documenter" => ("tool", "Generates session block tree documentation"),
            "training-finalizer" => ("tool", "Finalizes phase with summary metrics"),
            _ when name.Contains("inference") || name.Contains("generate") => ("inference", "LLM inference block"),
            _ when name.Contains("valid") || name.Contains("check") => ("validator", "Validation block"),
            _ => ("tool", $"System built-in: {name}")
        };
    }

    /// <summary>
    /// Executes a shell command specified in inputs.command.
    /// Generic: any session can use system:shell nodes to run arbitrary commands.
    /// Supports {{variable}} template resolution in the command string.
    /// </summary>
    private async Task<string> ExecuteShellNodeAsync(
        Domain.Entities.ProjectSession session,
        string workingDir,
        JsonElement? nodeConfig)
    {
        var command = GetNodeInput(nodeConfig, "command");
        if (string.IsNullOrEmpty(command))
            return "(error: shell node missing inputs.command)";

        // Resolve {{variable}} templates in the command
        command = ResolveTemplate(command, session);

        // Optional timeout from inputs (default 60s)
        var timeoutStr = GetNodeInput(nodeConfig, "timeout");
        var timeoutSec = int.TryParse(timeoutStr, out var ts) ? ts : 60;

        AppendExecutionLog(session, "info", $"Shell: {command}");

        var result = await RunShellAsync(workingDir, command, timeoutSec);

        AppendExecutionLog(session, "info",
            $"Shell output: {(result.Length > 200 ? result[..200] + "..." : result)}");

        return result;
    }

    private string ExecuteValidationNode(
        Domain.Entities.ProjectSession session,
        Dictionary<string, object>? workflowConfig,
        string? output)
    {
        var criteria = GetConfigStringList(workflowConfig, "evaluation.criteria");
        var (fitness, criteriaScores) = EvaluateFitnessDetailed(output ?? "", criteria);

        // Token count tracking (generic: always available)
        var tokenCount = EstimateTokenCount(output ?? "");
        session.SetVariable("_tokenCount", tokenCount);

        // Read phase-specific stop condition from config
        var stopCondition = GetConfigString(workflowConfig, "evaluation.stopCondition", "target");

        // Quality floor check (optimization phases: don't let quality drop)
        var qualityFloor = (double)GetConfigFloat(workflowConfig, "evaluation.qualityFloor", -1f);
        if (qualityFloor > 0)
        {
            // Compute quality score from quality-only criteria (excluding optimization criteria like tokenEfficiency)
            var qualityCriteria = GetConfigStringList(workflowConfig, "evaluation.qualityCriteria");
            if (qualityCriteria.Count > 0)
            {
                var (qualityScore, _) = EvaluateFitnessDetailed(output ?? "", qualityCriteria);
                session.SetVariable("_qualityScore", Math.Round(qualityScore, 2));

                // If quality dropped below floor, penalize fitness heavily
                if (qualityScore < qualityFloor)
                {
                    fitness = qualityScore * 0.5; // Heavy penalty signals: don't go this direction
                    AppendExecutionLog(session, "warning",
                        $"Quality below floor ({qualityScore:F2} < {qualityFloor:F2}). Fitness penalized to {fitness:F2}.");
                }
            }
        }

        session.SetVariable("currentFitness", fitness);

        var scoreHistory = GetScoreHistory(session);
        scoreHistory.Add(fitness);
        session.SetVariable("scoreHistory", scoreHistory);

        // Plateau detection (optimization phases: stop after N non-improving iterations)
        if (stopCondition == "plateau")
        {
            var plateauRuns = GetConfigInt(workflowConfig, "evaluation.plateauRuns", 5);
            var bestFitness = ReadDoubleVariable(session, "_bestFitness", 0);
            var plateauCount = ReadIntVariable(session, "_plateauCount", 0);

            if (fitness > bestFitness)
            {
                session.SetVariable("_bestFitness", fitness);
                session.SetVariable("_plateauCount", 0);
            }
            else
            {
                plateauCount++;
                session.SetVariable("_plateauCount", plateauCount);
                if (plateauCount >= plateauRuns)
                {
                    session.SetVariable("_shouldStop", true);
                    AppendExecutionLog(session, "info",
                        $"Plateau detected: {plateauCount} consecutive iterations without improvement (best: {bestFitness:F2}). Stopping phase.");
                }
            }
        }

        // Store detailed validation results in _blockOutputs
        var target = session.GetVariable<double>("targetFitness", 0.85);
        var validationDetail = new Dictionary<string, object>
        {
            ["type"] = "validator",
            ["criteriaScores"] = criteriaScores,
            ["totalScore"] = fitness,
            ["tokenCount"] = tokenCount,
            ["passed"] = stopCondition == "plateau" ? !session.GetVariable<bool>("_shouldStop", false) : fitness >= target
        };
        StoreBlockOutput(session, "validation", "validator", null, validationDetail);

        // Store validation feedback for the LLM to use in next iteration
        var sb = new StringBuilder();
        sb.AppendLine($"Score: {fitness:F2} / {target:F2}");
        if (tokenCount > 0) sb.AppendLine($"Tokens: ~{tokenCount}");
        foreach (var kvp in criteriaScores)
        {
            var icon = (double)kvp.Value >= 0.5 ? "PASS" : "FAIL";
            sb.AppendLine($"  [{icon}] {kvp.Key}: {kvp.Value:F2}");
        }
        if (stopCondition == "target" && fitness < target)
        {
            var failing = criteriaScores.Where(kvp => (double)kvp.Value < 0.5).Select(kvp => kvp.Key);
            sb.AppendLine($"Failing criteria need improvement: {string.Join(", ", failing)}");
        }
        if (stopCondition == "plateau")
        {
            var best = ReadDoubleVariable(session, "_bestFitness", 0);
            var plateau = ReadIntVariable(session, "_plateauCount", 0);
            sb.AppendLine($"Best fitness: {best:F2} | Plateau: {plateau}/{GetConfigInt(workflowConfig, "evaluation.plateauRuns", 5)}");
            sb.AppendLine("Focus: reduce token count while maintaining quality.");
        }
        session.SetVariable("_lastValidationFeedback", sb.ToString().TrimEnd());

        // Pass through the original content so the next node receives it (not the fitness summary)
        return output ?? "";
    }

    // ===== Node Config Helpers (read inputs from config.nodes[].inputs) =====

    /// <summary>
    /// Reads a string value from a config node's inputs.
    /// Supports template resolution via session variables.
    /// Returns null if the node or input is not found.
    /// </summary>
    private static string? GetNodeInput(JsonElement? nodeConfig, string inputName)
    {
        if (nodeConfig == null) return null;
        var node = nodeConfig.Value;

        if (node.TryGetProperty("inputs", out var inputs) && inputs.ValueKind == JsonValueKind.Object)
        {
            if (inputs.TryGetProperty(inputName, out var value))
            {
                return value.ValueKind == JsonValueKind.String ? value.GetString() : value.ToString();
            }
        }

        return null;
    }

    // ===== Config Helpers (navigate session variable _workflowConfig) =====

    /// <summary>
    /// Extracts the workflow-specific config from session variable _workflowConfig.
    /// Phase-aware: if phaseId is provided, looks for config[workflowKey][phaseId] first,
    /// then falls back to config[workflowKey] for backward compatibility.
    /// </summary>
    private static Dictionary<string, object>? GetWorkflowConfig(Domain.Entities.ProjectSession session, string workflowId, string? phaseId = null)
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

    private static float GetConfigFloat(Dictionary<string, object>? config, string dotPath, float defaultValue)
    {
        var str = GetConfigString(config, dotPath, null);
        return str != null && float.TryParse(str, System.Globalization.CultureInfo.InvariantCulture, out var val) ? val : defaultValue;
    }

    private static List<string> GetConfigStringList(Dictionary<string, object>? config, string dotPath)
    {
        if (config == null) return new List<string>();

        var parts = dotPath.Split('.');
        object? current = config;

        foreach (var part in parts)
        {
            if (current is Dictionary<string, object> dict)
            {
                if (!dict.TryGetValue(part, out current)) return new List<string>();
            }
            else if (current is JObject jObj)
            {
                if (!jObj.TryGetValue(part, out var jToken)) return new List<string>();
                current = jToken;
            }
            else if (current is JsonElement jsonEl && jsonEl.ValueKind == JsonValueKind.Object)
            {
                if (!jsonEl.TryGetProperty(part, out var prop)) return new List<string>();
                current = prop;
            }
            else return new List<string>();
        }

        if (current is List<object> list) return list.Select(x => x.ToString() ?? "").ToList();
        if (current is JArray jArr) return jArr.Select(x => x.ToString()).ToList();
        if (current is JsonElement je && je.ValueKind == JsonValueKind.Array)
            return je.EnumerateArray().Select(x => x.GetString() ?? "").ToList();
        return new List<string>();
    }

    /// <summary>
    /// Config-driven fitness evaluation with per-criteria detail.
    /// Returns (totalScore, criteriaScores dictionary).
    /// </summary>
    private static (double totalScore, Dictionary<string, object> criteriaScores) EvaluateFitnessDetailed(string output, List<string> criteria)
    {
        var criteriaScores = new Dictionary<string, object>();

        if (criteria.Count == 0)
        {
            var score = Math.Min(0.5 + (output.Length > 100 ? 0.2 : 0) + (output.Length > 500 ? 0.15 : 0), 0.95);
            criteriaScores["lengthHeuristic"] = score;
            return (score, criteriaScores);
        }

        var totalScore = 0.0;
        var weight = 1.0 / criteria.Count;

        foreach (var criterion in criteria)
        {
            double criterionScore;
            switch (criterion.ToLowerInvariant())
            {
                case "hasjsonstructure":
                    criterionScore = (output.TrimStart().StartsWith("{") || output.TrimStart().StartsWith("[")) ? 1.0 : 0.0;
                    break;
                case "hasrequiredfields":
                    var requiredFields = new[] { "\"name\"", "\"type\"", "\"description\"" };
                    var fieldsFound = requiredFields.Count(f => output.Contains(f));
                    criterionScore = (double)fieldsFound / requiredFields.Length;
                    break;
                case "minlength":
                    criterionScore = output.Length >= 100 ? 1.0 : output.Length / 100.0;
                    break;
                case "tokenefficiency":
                    // Fewer tokens = higher score. Rewards compact output.
                    // 200 chars → 1.0, 500 chars → 0.8, 1000 → 0.6, 2000 → 0.4, 5000+ → 0.2
                    var charCount = output.Length;
                    criterionScore = charCount <= 200 ? 1.0 : Math.Max(0.2, 1.0 - (charCount - 200) / 6000.0);
                    break;
                case "validjsonparse":
                    // Can the output be parsed as valid JSON?
                    try { JsonDocument.Parse(output.Trim()); criterionScore = 1.0; }
                    catch { criterionScore = 0.0; }
                    break;
                case "nomarkdownfences":
                    // Output should not contain markdown code fences
                    criterionScore = output.Contains("```") ? 0.0 : 1.0;
                    break;
                case "purejsonoutput":
                    // Output should start with { or [ and end with } or ] (no surrounding prose)
                    var trimmed = output.Trim();
                    var startsOk = trimmed.StartsWith("{") || trimmed.StartsWith("[");
                    var endsOk = trimmed.EndsWith("}") || trimmed.EndsWith("]");
                    criterionScore = (startsOk && endsOk) ? 1.0 : (startsOk || endsOk) ? 0.5 : 0.0;
                    break;
                case "hasschemafields":
                    // Check for schema-specific fields: name, version, capabilities
                    var schemaFields = new[] { "\"name\"", "\"version\"", "\"capabilities\"" };
                    var schemaFound = schemaFields.Count(f => output.Contains(f));
                    criterionScore = (double)schemaFound / schemaFields.Length;
                    break;
                default:
                    criterionScore = 0.5;
                    break;
            }
            criteriaScores[criterion] = Math.Round(criterionScore, 2);
            totalScore += weight * criterionScore;
        }

        return (Math.Min(totalScore, 0.95), criteriaScores);
    }

    // ===== Utility Helpers =====

    /// <summary>
    /// Rough token count estimate. Approximates ~4 chars per token for English/JSON text.
    /// </summary>
    private static int EstimateTokenCount(string text)
    {
        if (string.IsNullOrEmpty(text)) return 0;
        return (int)Math.Ceiling(text.Length / 4.0);
    }

    /// <summary>
    /// Attempts to extract valid JSON from an LLM response that may contain surrounding prose.
    /// Handles: markdown ```json blocks, bare JSON objects/arrays with leading/trailing text.
    /// Returns the extracted JSON string, or null if no valid JSON found.
    /// </summary>
    private static string? TryExtractJson(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        // If the text is already valid JSON, return as-is
        var trimmed = text.Trim();
        if ((trimmed.StartsWith("{") || trimmed.StartsWith("[")) && IsValidJson(trimmed))
            return trimmed;

        // Try to extract from markdown code block: ```json ... ``` or ``` ... ```
        var codeBlockMatch = Regex.Match(text, @"```(?:json)?\s*\n?([\s\S]*?)```", RegexOptions.IgnoreCase);
        if (codeBlockMatch.Success)
        {
            var inner = codeBlockMatch.Groups[1].Value.Trim();
            if (IsValidJson(inner)) return inner;
        }

        // Try to find the outermost JSON object: first { to last matching }
        var firstBrace = text.IndexOf('{');
        var lastBrace = text.LastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace)
        {
            var candidate = text[firstBrace..(lastBrace + 1)];
            if (IsValidJson(candidate)) return candidate;
        }

        // Try to find outermost JSON array: first [ to last matching ]
        var firstBracket = text.IndexOf('[');
        var lastBracket = text.LastIndexOf(']');
        if (firstBracket >= 0 && lastBracket > firstBracket)
        {
            var candidate = text[firstBracket..(lastBracket + 1)];
            if (IsValidJson(candidate)) return candidate;
        }

        return null;
    }

    private static bool IsValidJson(string text)
    {
        try
        {
            JsonDocument.Parse(text);
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static string NormalizeBlockId(string workflowId)
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

    private static string NodeIdToDisplayName(string nodeId)
    {
        // "evaluate-current" → "Evaluate Current"
        return string.Join(" ", nodeId.Split('-').Select(w =>
            w.Length > 0 ? char.ToUpperInvariant(w[0]) + w[1..] : w));
    }

    private static string InferBlockType(string nodeId)
    {
        if (nodeId.Contains("evaluate") || nodeId.Contains("load") || nodeId.Contains("apply"))
            return "script";
        if (nodeId.Contains("generate") || nodeId.Contains("improvement"))
            return "inference";
        if (nodeId.Contains("check") || nodeId.Contains("fitness") || nodeId.Contains("validate") || nodeId.Contains("metrics"))
            return "validator";
        return "task";
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
                using var doc = JsonDocument.Parse(jsonStr);
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
            if (idx > 0)
            {
                var left = expr[..idx].Trim();
                var right = expr[(idx + op.Length)..].Trim();

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
    /// Reads a double from a session variable, handling JsonElement/JValue/etc.
    /// </summary>
    private static double ReadDoubleVariable(Domain.Entities.ProjectSession session, string key, double defaultValue)
    {
        var value = session.GetVariable(key);
        if (value == null) return defaultValue;
        if (value is double d) return d;
        if (value is int i) return i;
        if (value is long l) return l;
        if (value is float f) return f;
        if (value is JsonElement je && je.ValueKind == JsonValueKind.Number) return je.GetDouble();
        if (value is JValue jv && jv.Value != null) return Convert.ToDouble(jv.Value);
        if (double.TryParse(value.ToString(), System.Globalization.CultureInfo.InvariantCulture, out var parsed)) return parsed;
        return defaultValue;
    }

    /// <summary>
    /// Reads an int from a session variable, handling JsonElement/JValue/etc.
    /// </summary>
    private static int ReadIntVariable(Domain.Entities.ProjectSession session, string key, int defaultValue)
    {
        var value = session.GetVariable(key);
        if (value == null) return defaultValue;
        if (value is int i) return i;
        if (value is long l) return (int)l;
        if (value is double d) return (int)d;
        if (value is JsonElement je && je.ValueKind == JsonValueKind.Number) return je.GetInt32();
        if (value is JValue jv && jv.Value != null) return Convert.ToInt32(jv.Value);
        if (int.TryParse(value.ToString(), out var parsed)) return parsed;
        return defaultValue;
    }

    private static string? FindFirstPendingPhase(Domain.Entities.ProjectSession session)
    {
        var phases = session.GetVariable("_phases");
        if (phases is List<object> phaseList)
        {
            foreach (var item in phaseList)
            {
                if (item is Dictionary<string, object> phase &&
                    phase.TryGetValue("status", out var status) && status?.ToString() == "pending" &&
                    phase.TryGetValue("id", out var id))
                    return id?.ToString();
            }
        }
        if (phases is JArray jArr)
        {
            foreach (var item in jArr)
            {
                if (item is JObject jObj &&
                    jObj.Value<string>("status") == "pending")
                    return jObj.Value<string>("id");
            }
        }
        if (phases is JsonElement jsonEl && jsonEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in jsonEl.EnumerateArray())
            {
                if (item.TryGetProperty("status", out var status) && status.GetString() == "pending" &&
                    item.TryGetProperty("id", out var id))
                    return id.GetString();
            }
        }
        return null;
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

    // ===== Display Descriptor Helpers (generic, session-data-driven) =====

    /// <summary>
    /// Updates a phase's status in the session's _phases variable.
    /// Returns true if a matching phase was found and updated, false otherwise.
    /// This is a no-op when phaseId doesn't match any entry in _phases.
    /// </summary>
    private static bool UpdatePhaseStatus(Domain.Entities.ProjectSession session, string phaseId, string status, int? progress = null)
    {
        var phases = session.GetVariable("_phases");
        if (phases is List<object> phaseList)
        {
            foreach (var item in phaseList)
            {
                if (item is Dictionary<string, object> phase && phase.TryGetValue("id", out var id) && id?.ToString() == phaseId)
                {
                    phase["status"] = status;
                    if (progress.HasValue)
                        phase["progress"] = progress.Value;
                    else
                        phase.Remove("progress");
                    session.SetVariable("_phases", phaseList);
                    return true;
                }
            }
        }
        return false;
    }

    private static void SetActiveBlock(Domain.Entities.ProjectSession session, string id, string name, string type, string status, string? output = null)
    {
        var block = new Dictionary<string, object>
        {
            ["id"] = id,
            ["name"] = name,
            ["type"] = type,
            ["status"] = status,
            ["startedAt"] = DateTimeOffset.UtcNow.ToString("o"),
            ["logs"] = new List<object>(),
            ["metadata"] = new Dictionary<string, object>()
        };
        if (output != null) block["output"] = output;
        session.SetVariable("_activeBlock", block);
    }

    private static void UpdateActiveBlockOutput(Domain.Entities.ProjectSession session, string output)
    {
        var block = session.GetVariable("_activeBlock");
        if (block is Dictionary<string, object> dict)
        {
            dict["output"] = output;
            session.SetVariable("_activeBlock", dict);
        }
    }

    private static void UpdateActiveBlockStatus(Domain.Entities.ProjectSession session, string status)
    {
        var block = session.GetVariable("_activeBlock");
        if (block is Dictionary<string, object> dict)
        {
            dict["status"] = status;
            session.SetVariable("_activeBlock", dict);
        }
    }

    /// <summary>
    /// Stores a block's output in _blockOutputs for the Block Output Browser.
    /// Each block stores its latest output keyed by nodeId.
    /// </summary>
    private static void StoreBlockOutput(Domain.Entities.ProjectSession session, string nodeId, string blockType, string? rawOutput, Dictionary<string, object>? detailOverride = null)
    {
        var blockOutputs = session.GetVariable("_blockOutputs");
        Dictionary<string, object> outputs;

        if (blockOutputs is Dictionary<string, object> existing)
            outputs = new Dictionary<string, object>(existing);
        else
            outputs = new Dictionary<string, object>();

        var entry = detailOverride ?? new Dictionary<string, object>
        {
            ["type"] = blockType,
            ["output"] = rawOutput ?? "",
            ["timestamp"] = DateTimeOffset.UtcNow.ToString("HH:mm:ss")
        };

        if (!entry.ContainsKey("timestamp"))
            entry["timestamp"] = DateTimeOffset.UtcNow.ToString("HH:mm:ss");

        outputs[nodeId] = entry;
        session.SetVariable("_blockOutputs", outputs);
    }

    private static void ClearActiveBlock(Domain.Entities.ProjectSession session)
    {
        session.SetVariable("_activeBlock", null!);
    }

    /// <summary>
    /// Stores iteration/fitness result in the phase object within _phases.
    /// Allows the TUI to display phase summaries for completed phases.
    /// Enriched with cold/warm timing and token totals from _phaseMetrics.
    /// </summary>
    private static void StorePhaseSummary(Domain.Entities.ProjectSession session, string phaseId, int iterations, double fitness)
    {
        var phases = session.GetVariable("_phases");
        if (phases is List<object> phaseList)
        {
            foreach (var item in phaseList)
            {
                if (item is Dictionary<string, object> phase && phase.TryGetValue("id", out var id) && id?.ToString() == phaseId)
                {
                    var result = new Dictionary<string, object>
                    {
                        ["iterations"] = iterations,
                        ["fitness"] = Math.Round(fitness, 2)
                    };
                    // Include token count and quality score if available
                    var tokenCount = session.GetVariable<int>("_tokenCount", 0);
                    if (tokenCount > 0) result["tokenCount"] = tokenCount;
                    var qualityScore = session.GetVariable<double>("_qualityScore", 0);
                    if (qualityScore > 0) result["qualityScore"] = Math.Round(qualityScore, 2);

                    // Add timing aggregates from _phaseMetrics
                    var phaseMetrics = session.GetVariable("_phaseMetrics") as Dictionary<string, object>;
                    if (phaseMetrics?.TryGetValue(phaseId, out var pm) == true
                        && pm is Dictionary<string, object> phaseData
                        && phaseData.TryGetValue("iterations", out var iters)
                        && iters is List<object> iterList)
                    {
                        if (iterList.Count > 0 && iterList[0] is Dictionary<string, object> first)
                        {
                            if (first.TryGetValue("totalMs", out var cs)) result["coldStartMs"] = cs;
                            if (first.TryGetValue("model", out var m)) result["model"] = m;
                        }
                        if (iterList.Count > 1 && iterList[^1] is Dictionary<string, object> last)
                        {
                            if (last.TryGetValue("totalMs", out var ws)) result["warmStartMs"] = ws;
                        }

                        var totalPrompt = iterList.OfType<Dictionary<string, object>>()
                            .Sum(d => d.TryGetValue("promptTokens", out var v) && v is int i ? i : 0);
                        var totalCompletion = iterList.OfType<Dictionary<string, object>>()
                            .Sum(d => d.TryGetValue("completionTokens", out var v) && v is int i ? i : 0);
                        if (totalPrompt > 0) result["totalPromptTokens"] = totalPrompt;
                        if (totalCompletion > 0) result["totalCompletionTokens"] = totalCompletion;
                    }

                    phase["result"] = result;
                    break;
                }
            }
            session.SetVariable("_phases", phaseList);
        }
    }

    /// <summary>
    /// Stores per-iteration detailed metrics in _phaseMetrics.
    /// Collects timing, tokens, fitness, criteria scores, and full response from latest _llmActivity and _blockOutputs.
    /// Generic — any session with a while loop and LLM nodes benefits from this.
    /// </summary>
    private static void StoreIterationMetrics(Domain.Entities.ProjectSession session, string? phaseId, int iteration, double fitness)
    {
        if (string.IsNullOrEmpty(phaseId)) return;

        var metrics = session.GetVariable("_phaseMetrics") as Dictionary<string, object>
            ?? new Dictionary<string, object>();

        // Get latest LLM activity entry for timing/token data
        var llmActivity = session.GetVariable("_llmActivity") as List<object>;
        var latestLlm = llmActivity?.LastOrDefault() as Dictionary<string, object>;

        // Get validation data from _blockOutputs
        var blockOutputs = session.GetVariable("_blockOutputs") as Dictionary<string, object>;
        var validation = blockOutputs?.GetValueOrDefault("validation") as Dictionary<string, object>;

        var iterationData = new Dictionary<string, object>
        {
            ["iteration"] = iteration,
            ["timestamp"] = DateTime.UtcNow.ToString("o"),
            ["fitness"] = Math.Round(fitness, 4),
            ["passed"] = fitness >= ReadDoubleVariable(session, "targetFitness", 0.85)
        };

        // Copy timing and token data from latest LLM activity
        if (latestLlm != null)
        {
            foreach (var key in new[] { "modelSwitchMs", "inferenceMs", "totalMs",
                "promptTokens", "completionTokens", "totalTokens",
                "systemPrompt", "userPrompt", "fullResponse", "model" })
            {
                if (latestLlm.TryGetValue(key, out var v)) iterationData[key] = v;
            }
        }

        // Copy criteria scores from validation
        if (validation?.TryGetValue("criteriaScores", out var scores) == true)
            iterationData["criteriaScores"] = scores;

        // Get or create phase entry
        Dictionary<string, object> phaseEntry;
        if (metrics.TryGetValue(phaseId, out var existing) && existing is Dictionary<string, object> pe)
        {
            phaseEntry = pe;
        }
        else
        {
            phaseEntry = new Dictionary<string, object>
            {
                ["model"] = latestLlm?.GetValueOrDefault("model") ?? "unknown",
                ["iterations"] = new List<object>()
            };
            metrics[phaseId] = phaseEntry;
        }

        // Update model name from latest data (may have been "unknown" initially)
        if (latestLlm?.TryGetValue("model", out var modelVal) == true)
            phaseEntry["model"] = modelVal;

        (phaseEntry["iterations"] as List<object>)?.Add(iterationData);
        session.SetVariable("_phaseMetrics", metrics);
    }

    /// <summary>
    /// Appends an LLM activity entry to _llmActivity (FIFO 20).
    /// Used by the TUI LLM Activity component to show prompt/response chat view.
    /// </summary>
    private static void AppendToLLMActivity(Domain.Entities.ProjectSession session, Dictionary<string, object> activity)
    {
        var existing = session.GetVariable("_llmActivity");
        List<object> list;
        if (existing is List<object> l)
            list = new List<object>(l);
        else
            list = new List<object>();

        list.Add(activity);

        // Keep last 20 entries
        if (list.Count > 20)
            list = list.Skip(list.Count - 20).ToList();

        session.SetVariable("_llmActivity", list);
    }

    private static void AppendExecutionLog(Domain.Entities.ProjectSession session, string level, string message)
    {
        var log = session.GetVariable("_executionLog");
        List<object> logList;
        if (log is List<object> existing)
            logList = new List<object>(existing);
        else
            logList = new List<object>();

        logList.Add(new Dictionary<string, object>
        {
            ["time"] = DateTimeOffset.UtcNow.ToString("HH:mm:ss"),
            ["level"] = level,
            ["msg"] = message
        });

        // Keep last 200 entries (increased from 50 for better debugging of multi-step pipelines)
        if (logList.Count > 200)
            logList = logList.Skip(logList.Count - 200).ToList();

        session.SetVariable("_executionLog", logList);
    }

    private static void AddArtifact(Domain.Entities.ProjectSession session, string name, string type, string? size = null, string status = "new")
    {
        var artifacts = session.GetVariable("_artifacts");
        List<object> list;
        if (artifacts is List<object> existing)
            list = new List<object>(existing);
        else
            list = new List<object>();

        // Update existing or add new
        var found = false;
        foreach (var item in list)
        {
            if (item is Dictionary<string, object> dict && dict.TryGetValue("name", out var n) && n?.ToString() == name)
            {
                dict["status"] = "updated";
                if (size != null) dict["size"] = size;
                found = true;
                break;
            }
        }

        if (!found)
        {
            var artifact = new Dictionary<string, object>
            {
                ["name"] = name,
                ["type"] = type,
                ["status"] = status
            };
            if (size != null) artifact["size"] = size;
            list.Add(artifact);
        }

        session.SetVariable("_artifacts", list);
    }

    // ===== Generic Helpers =====

    private static Dictionary<string, object> CreateNode(string id, string name, string status, string? output = null)
    {
        var node = new Dictionary<string, object>
        {
            ["id"] = id,
            ["name"] = name,
            ["status"] = status,
            ["children"] = new List<object>()
        };
        if (output != null)
            node["output"] = output;
        return node;
    }

    /// <summary>
    /// Finds a node by ID in the hierarchical tree (recursive search).
    /// </summary>
    private static Dictionary<string, object>? FindNodeById(List<object> tree, string nodeId)
    {
        foreach (var item in tree)
        {
            if (item is Dictionary<string, object> node)
            {
                if (node.TryGetValue("id", out var id) && id?.ToString() == nodeId)
                    return node;
                if (node.TryGetValue("children", out var children) && children is List<object> childList)
                {
                    var found = FindNodeById(childList, nodeId);
                    if (found != null) return found;
                }
            }
        }
        return null;
    }

    /// <summary>
    /// Updates a node's status (and optionally output) by ID in the hierarchical tree.
    /// </summary>
    private static void UpdateNodeById(List<object> tree, string nodeId, string status, string? output = null)
    {
        var node = FindNodeById(tree, nodeId);
        if (node == null) return;
        node["status"] = status;
        if (output != null)
            node["output"] = output;
        else if (status == "pending")
            node.Remove("output");
    }

    /// <summary>
    /// Recursively resets all nodes in a list (and their children) to pending.
    /// Used to reset while loop children between iterations.
    /// </summary>
    private static void ResetNodeTree(List<object> nodes)
    {
        foreach (var item in nodes)
        {
            if (item is Dictionary<string, object> node)
            {
                node["status"] = "pending";
                node.Remove("output");
                if (node.TryGetValue("children", out var children) && children is List<object> childList)
                    ResetNodeTree(childList);
            }
        }
    }

    private async Task<string> RunShellAsync(string workingDirectory, string command, int timeoutSeconds = 60)
    {
        try
        {
            var isWindows = OperatingSystem.IsWindows();
            var shell = isWindows ? "cmd.exe" : "/bin/bash";
            var shellArgs = isWindows ? $"/c {command}" : $"-c \"{command.Replace("\"", "\\\"")}\"";

            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = shell,
                    Arguments = shellArgs,
                    WorkingDirectory = workingDirectory,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };

            var stdout = new StringBuilder();
            process.OutputDataReceived += (_, e) => { if (e.Data != null) stdout.AppendLine(e.Data); };

            process.Start();
            process.BeginOutputReadLine();

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));
            try
            {
                await process.WaitForExitAsync(cts.Token);
            }
            catch (OperationCanceledException)
            {
                process.Kill(true);
                return "(command timed out)";
            }

            return stdout.ToString().TrimEnd();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Shell command failed: {Command}", command);
            return $"(error: {ex.Message})";
        }
    }

    private static string GetProjectPath(Domain.Entities.ProjectSession session)
    {
        if (!string.IsNullOrEmpty(session.WorkingDirectory) && session.WorkingDirectory != ".")
            return session.WorkingDirectory;

        // Fall back to repository path for repo-bound sessions
        if (!string.IsNullOrEmpty(session.RepositoryPath))
            return session.RepositoryPath;

        return Environment.CurrentDirectory;
    }

    private static List<object> GetScoreHistory(Domain.Entities.ProjectSession session)
    {
        var existing = session.GetVariable("scoreHistory");
        if (existing is List<object> list)
            return new List<object>(list);
        if (existing is JsonElement jsonElement && jsonElement.ValueKind == JsonValueKind.Array)
        {
            var result = new List<object>();
            foreach (var item in jsonElement.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.Number)
                    result.Add(item.GetDouble());
                else
                    result.Add(item.ToString()!);
            }
            return result;
        }
        return new List<object>();
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
