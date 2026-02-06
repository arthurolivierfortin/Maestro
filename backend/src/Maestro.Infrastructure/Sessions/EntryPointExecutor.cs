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
    private readonly ILogger<EntryPointExecutor> _logger;

    public EntryPointExecutor(
        IProjectSessionRepository repository,
        ILLMGateway llmGateway,
        IBlockDiscoveryService blockDiscovery,
        ILogger<EntryPointExecutor> logger)
    {
        _repository = repository;
        _llmGateway = llmGateway;
        _blockDiscovery = blockDiscovery;
        _logger = logger;
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
        var workflowBlock = await _blockDiscovery.GetByIdAsync(blockId);
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

        // 5. Get workflow-specific config from session variable _workflowConfig
        var workflowConfig = GetWorkflowConfig(session, workflowId);
        _logger.LogInformation("WorkflowConfig found: {Found}", workflowConfig != null);

        // 6. Activate the first pending phase
        var activePhaseId = GetConfigString(workflowConfig, "phaseId", null);
        _logger.LogInformation("Phase from config: '{PhaseId}'", activePhaseId ?? "(null)");
        if (string.IsNullOrEmpty(activePhaseId))
        {
            activePhaseId = FindFirstPendingPhase(session);
            _logger.LogInformation("Phase from FindFirstPending: '{PhaseId}'", activePhaseId ?? "(null)");
        }
        if (!string.IsNullOrEmpty(activePhaseId))
        {
            UpdatePhaseStatus(session, activePhaseId, "running", 0);
            _logger.LogInformation("Phase '{PhaseId}' set to running", activePhaseId);
        }

        AppendExecutionLog(session, "info", $"Starting workflow: {workflowId}");
        await _repository.SaveAsync(session);

        // 7. Execute config nodes (generic: handles while, conditional, regular nodes)
        // The execution structure comes from the workflow block's config.nodes.
        // Control flow (while, conditional) is defined in block JSON, not hardcoded here.
        if (workflowBlock?.Config != null && workflowBlock.Config.ContainsKey("nodes"))
        {
            var configNodesObj = workflowBlock.Config["nodes"];
            if (configNodesObj is JsonElement nodesEl && nodesEl.ValueKind == JsonValueKind.Array)
            {
                await ExecuteConfigNodesAsync(session, nodesEl, workflowConfig, workingDir, activePhaseId, tree);
            }
        }
        else
        {
            // Fallback: no workflow block config, execute flat display tree sequentially
            await ExecuteNodesAsync(session, tree, workflowConfig, workingDir, activePhaseId);
        }

        // 8. Finalize — mark phase done when workflow completes
        if (!string.IsNullOrEmpty(activePhaseId))
        {
            UpdatePhaseStatus(session, activePhaseId, "done");
            var fitness = ReadDoubleVariable(session, "currentFitness", 0);
            var iteration = ReadIntVariable(session, "currentIteration", 0);
            AppendExecutionLog(session, "info", $"Phase '{activePhaseId}' completed (fitness: {fitness:F2}, iterations: {iteration})");
        }

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

        // Nest children for while/conditional nodes
        if (node.TryGetProperty("nodes", out var nestedNodes) && nestedNodes.ValueKind == JsonValueKind.Array)
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
        string? activePhaseId,
        List<object> displayTree,
        string? previousOutput = null)
    {
        string? lastOutput = previousOutput;

        foreach (var configNode in configNodes.EnumerateArray())
        {
            if (configNode.ValueKind != JsonValueKind.Object) continue;

            var nodeId = configNode.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "unknown" : "unknown";
            var nodeType = configNode.TryGetProperty("type", out var typeProp) ? typeProp.GetString() : null;

            switch (nodeType)
            {
                case "while":
                    lastOutput = await ExecuteWhileNodeAsync(session, configNode, workflowConfig, workingDir, activePhaseId, displayTree, lastOutput);
                    break;
                case "conditional":
                    lastOutput = await ExecuteConditionalNodeAsync(session, configNode, workflowConfig, workingDir, displayTree, lastOutput);
                    break;
                default:
                    lastOutput = await ExecuteRegularNodeAsync(session, nodeId, workflowConfig, workingDir, activePhaseId, displayTree, lastOutput);
                    break;
            }
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

        // Initialize iteration variable for condition evaluation
        session.SetVariable("iteration", iteration);
        session.SetVariable("currentIteration", iteration);

        AppendExecutionLog(session, "info", $"Entering while loop '{nodeId}' (max: {safetyMaxIterations})");
        await _repository.SaveAsync(session);

        while (iteration < safetyMaxIterations && EvaluateCondition(condition, session))
        {
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

            // Execute child nodes
            if (whileNode.TryGetProperty("nodes", out var children) && children.ValueKind == JsonValueKind.Array)
            {
                lastOutput = await ExecuteConfigNodesAsync(session, children, workflowConfig, workingDir, activePhaseId, displayTree, lastOutput);
            }

            // Log iteration result
            var fitness = ReadDoubleVariable(session, "currentFitness", 0);
            AppendExecutionLog(session, "info", $"Iteration {iteration} complete. Fitness: {fitness:F2}");
            await _repository.SaveAsync(session);
        }

        // While loop done
        var finalFitness = ReadDoubleVariable(session, "currentFitness", 0);
        var conditionStillTrue = iteration < safetyMaxIterations && EvaluateCondition(condition, session);
        var exitReason = !conditionStillTrue
            ? $"condition met (fitness: {finalFitness:F2})"
            : $"max iterations reached ({iteration}/{safetyMaxIterations})";

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

        var condResult = EvaluateCondition(condition, session);
        AppendExecutionLog(session, "info", $"Conditional '{nodeId}': evaluated to {condResult}");

        // Update display tree
        UpdateNodeById(displayTree, nodeId, "running", $"Condition: {condResult}");
        SetActiveBlock(session, nodeId, displayName, "conditional", "running");
        session.SetVariable("_executionTree", displayTree);
        await _repository.SaveAsync(session);

        // Execute the node
        string output;
        try
        {
            output = await ExecuteNodeAsync(session, nodeId, workflowConfig, workingDir, previousOutput);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Conditional node execution failed: {NodeId}", nodeId);
            output = $"(error: {ex.Message})";
            UpdateNodeById(displayTree, nodeId, "error", output);
            session.SetVariable("_executionTree", displayTree);
            UpdateActiveBlockStatus(session, "error");
            AppendExecutionLog(session, "error", $"{nodeId}: {ex.Message}");
            await _repository.SaveAsync(session);
            return previousOutput;
        }

        // Set done
        var truncated = output.Length > 500 ? output[..500] + "..." : output;
        UpdateNodeById(displayTree, nodeId, "done", truncated);
        session.SetVariable("_executionTree", displayTree);
        UpdateActiveBlockOutput(session, output.Length > 2000 ? output[..2000] + "..." : output);
        UpdateActiveBlockStatus(session, "done");
        StoreBlockOutput(session, nodeId, "conditional", output);
        AppendExecutionLog(session, "success", $"{nodeId}: Completed ({output.Length} chars)");
        await _repository.SaveAsync(session);

        return output;
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
        string? previousOutput)
    {
        var displayName = NodeIdToDisplayName(nodeId);
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
        SetActiveBlock(session, nodeId, displayName, blockType, "running");
        AppendExecutionLog(session, "info", $"{nodeId}: Starting...");
        await _repository.SaveAsync(session);

        // Execute the node
        string output;
        try
        {
            output = await ExecuteNodeAsync(session, nodeId, workflowConfig, workingDir, previousOutput);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Node execution failed: {NodeId}", nodeId);
            output = $"(error: {ex.Message})";
            UpdateNodeById(displayTree, nodeId, "error", output);
            session.SetVariable("_executionTree", displayTree);
            UpdateActiveBlockStatus(session, "error");
            AppendExecutionLog(session, "error", $"{nodeId}: {ex.Message}");
            await _repository.SaveAsync(session);
            return previousOutput;
        }

        // Set done
        var truncatedOutput = output.Length > 500 ? output[..500] + "..." : output;
        UpdateNodeById(displayTree, nodeId, "done", truncatedOutput);
        session.SetVariable("_executionTree", displayTree);
        UpdateActiveBlockOutput(session, output.Length > 2000 ? output[..2000] + "..." : output);
        UpdateActiveBlockStatus(session, "done");
        AppendExecutionLog(session, "success", $"{nodeId}: Completed ({output.Length} chars)");
        StoreBlockOutput(session, nodeId, blockType, output);
        await _repository.SaveAsync(session);
        await Task.Delay(500);

        return output;
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
        string? previousOutput)
    {
        // Order matters: more specific patterns first, broader patterns last.

        // Apply/write nodes: write output to file (before "generate" to avoid "apply-improvements" matching "improvement")
        if (nodeId.Contains("apply") || nodeId.Contains("write"))
        {
            return await ExecuteWriteNodeAsync(session, workflowConfig, workingDir, previousOutput);
        }

        // Shell/evaluate nodes: run shell commands
        if (nodeId.Contains("evaluate") || nodeId.Contains("load") || nodeId.Contains("training"))
        {
            var gitDiff = await RunShellAsync(workingDir, "git diff --stat");
            var gitLog = await RunShellAsync(workingDir, "git log --oneline -5");
            return $"Git Diff:\n{gitDiff}\n\nRecent Commits:\n{gitLog}";
        }

        // LLM/generate nodes: call LLM with config-driven prompts
        if (nodeId.Contains("generate"))
        {
            return await ExecuteLLMNodeAsync(session, workflowConfig, previousOutput);
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

        // Default: passthrough
        return previousOutput ?? $"Node '{nodeId}' executed (passthrough)";
    }

    // ===== Node Type Executors (read config from session variables) =====

    private async Task<string> ExecuteLLMNodeAsync(
        Domain.Entities.ProjectSession session,
        Dictionary<string, object>? workflowConfig,
        string? context)
    {
        var systemPrompt = GetConfigString(workflowConfig, "llm.systemPrompt",
            "You are an assistant. Process the following context and generate output.");
        var userTemplate = GetConfigString(workflowConfig, "llm.userPromptTemplate",
            "Process the following:\n\n{{context}}");
        var maxTokens = GetConfigInt(workflowConfig, "llm.maxTokens", 1024);
        var temperature = GetConfigFloat(workflowConfig, "llm.temperature", 0.7f);

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
            Temperature = temperature
        };

        var response = await _llmGateway.SendAsync(request);
        AppendExecutionLog(session, "success", $"LLM response received ({response.Content.Length} chars)");
        return response.Content;
    }

    private async Task<string> ExecuteWriteNodeAsync(
        Domain.Entities.ProjectSession session,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        string? content)
    {
        var filename = GetConfigString(workflowConfig, "output.filename", "output.json");
        var outputPath = Path.Combine(workingDir, filename);

        if (string.IsNullOrEmpty(content))
        {
            return $"No content to write to {filename}";
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

    private string ExecuteValidationNode(
        Domain.Entities.ProjectSession session,
        Dictionary<string, object>? workflowConfig,
        string? output)
    {
        var criteria = GetConfigStringList(workflowConfig, "evaluation.criteria");
        var (fitness, criteriaScores) = EvaluateFitnessDetailed(output ?? "", criteria);

        session.SetVariable("currentFitness", fitness);

        var scoreHistory = GetScoreHistory(session);
        scoreHistory.Add(fitness);
        session.SetVariable("scoreHistory", scoreHistory);

        // Store detailed validation results in _blockOutputs
        var target = session.GetVariable<double>("targetFitness", 0.85);
        var validationDetail = new Dictionary<string, object>
        {
            ["type"] = "validator",
            ["criteriaScores"] = criteriaScores,
            ["totalScore"] = fitness,
            ["passed"] = fitness >= target
        };
        StoreBlockOutput(session, "validation", "validator", null, validationDetail);

        // Store validation feedback for the LLM to use in next iteration
        var sb = new StringBuilder();
        sb.AppendLine($"Score: {fitness:F2} / {target:F2}");
        foreach (var kvp in criteriaScores)
        {
            var icon = (double)kvp.Value >= 0.5 ? "PASS" : "FAIL";
            sb.AppendLine($"  [{icon}] {kvp.Key}: {kvp.Value:F2}");
        }
        if (fitness < target)
        {
            sb.AppendLine("Failing criteria need improvement. Output must start with { or [ for hasJsonStructure. Must contain \"name\", \"type\", \"description\" fields for hasRequiredFields.");
        }
        session.SetVariable("_lastValidationFeedback", sb.ToString().TrimEnd());

        // Pass through the original content so the next node receives it (not the fitness summary)
        return output ?? "";
    }

    // ===== Config Helpers (navigate session variable _workflowConfig) =====

    /// <summary>
    /// Extracts the workflow-specific config from session variable _workflowConfig.
    /// Matches by workflow ID (tries multiple key formats).
    /// </summary>
    private static Dictionary<string, object>? GetWorkflowConfig(Domain.Entities.ProjectSession session, string workflowId)
    {
        var configVar = session.GetVariable("_workflowConfig");
        if (configVar == null) return null;

        var keys = ExtractWorkflowKeys(workflowId);

        if (configVar is Dictionary<string, object> dict)
        {
            foreach (var key in keys)
            {
                if (dict.TryGetValue(key, out var value))
                    return value as Dictionary<string, object>;
            }
        }

        // Handle Newtonsoft.Json JObject (from API deserialization)
        if (configVar is JObject jObj)
        {
            foreach (var key in keys)
            {
                if (jObj.TryGetValue(key, out var prop))
                    return JObjectToDict(prop as JObject);
            }
        }

        // Handle System.Text.Json JsonElement (from block config)
        if (configVar is JsonElement jsonEl && jsonEl.ValueKind == JsonValueKind.Object)
        {
            foreach (var key in keys)
            {
                if (jsonEl.TryGetProperty(key, out var prop))
                    return JsonElementToDict(prop);
            }
        }

        return null;
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

            // {{inputs.xxx}} → session variable "xxx"
            if (varPath.StartsWith("inputs."))
                varPath = varPath["inputs.".Length..];

            var value = session.GetVariable(varPath);
            if (value == null) return "0";

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

            return value.ToString() ?? "0";
        });
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

    private static void UpdatePhaseStatus(Domain.Entities.ProjectSession session, string phaseId, string status, int? progress = null)
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
                    break;
                }
            }
            session.SetVariable("_phases", phaseList);
        }
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

        // Keep last 50 entries
        if (logList.Count > 50)
            logList = logList.Skip(logList.Count - 50).ToList();

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

    private async Task<string> RunShellAsync(string workingDirectory, string command)
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

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
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
}
