using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.BlockExecutors;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Sessions.NodeHandlers;

/// <summary>
/// Handles blockRef nodes: resolves block definitions, builds inputs,
/// dispatches to the appropriate IBlockExecutor via BlockExecutorRegistry,
/// and serializes the output.
///
/// ARCHITECTURE (Phase 53-C): Extracted from NodeExecutionEngine.
/// Block dispatch is a distinct concern from control flow orchestration.
///
/// ARCHITECTURE (Phase 59-PRE-2-A): Added pre-execution cost limit check.
/// CheckCostBeforeExecutionAsync is called BEFORE block execution, not after.
/// If a "block" enforcement limit is exceeded, returns a CostLimitStopped result
/// instead of executing the block. "warn" limits set variables but continue.
/// </summary>
public class BlockRefHandler : INodeHandler
{
    private readonly IBlockDiscoveryService _blockDiscovery;
    private readonly BlockExecutors.BlockExecutorRegistry _executorRegistry;
    private readonly ISessionStateManager _stateManager;
    private readonly IProjectSessionRepository _repository;
    private readonly ICostTrackingService? _costTracking;
    private readonly ILogger<BlockRefHandler> _logger;

    public string? NodeType => null; // Default handler for blockRef nodes

    public BlockRefHandler(
        IBlockDiscoveryService blockDiscovery,
        BlockExecutors.BlockExecutorRegistry executorRegistry,
        ISessionStateManager stateManager,
        IProjectSessionRepository repository,
        ILogger<BlockRefHandler> logger,
        ICostTrackingService? costTracking = null)
    {
        _blockDiscovery = blockDiscovery;
        _executorRegistry = executorRegistry;
        _stateManager = stateManager;
        _repository = repository;
        _logger = logger;
        _costTracking = costTracking;
    }

    // === Phase 59-B: System variables blacklist ===
    // These variables must NEVER cross session boundaries (parent → child or child → parent).
    // They are internal to a session's execution state and leaking them causes:
    // - Checkpoint contamination (_workflowCheckpoint*): second agent skips nodes
    // - Agent loop contamination (_agentDone/Result/Iteration): second agent exits immediately
    // - Display/tracking corruption (_executionTree, _llmActivity, _activeWorkflow, etc.)
    private static readonly HashSet<string> SystemVariableBlacklist = new(StringComparer.OrdinalIgnoreCase)
    {
        "_workflowCheckpoint",
        "_workflowCheckpoint_whileState",
        "_workflowCheckpoint_foreachIndex",
        "_agentDone",
        "_agentResult",
        "_agentIteration",
        "_conversationId",
        "_activeWorkflow",
        "_activeBlock",
        "_activeBlockStatus",
        "_activeBlockOutput",
        "_executionLog",
        "_executionTree",
        "_llmActivity",
        "_phases",
        "_phaseMetrics",
        "_artifacts",
        "_blockOutputs",
        "_accumulatedCost",
        "_accumulatedPromptTokens",
        "_accumulatedCompletionTokens"
    };

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

        // === Pre-execution cost limit check (Phase 59-PRE-2-A) ===
        var costCheck = await CheckCostBeforeExecutionAsync(session, nodeId, blockRefId);
        if (costCheck != null)
            return costCheck; // Cost limit stopped — return the stop message

        // Resolve the block definition
        var block = await _blockDiscovery.GetByIdAsync(SessionHelper.NormalizeBlockId(blockRefId), session.BlockSearchPaths);
        if (block == null)
            throw new InvalidOperationException(
                $"Block not found: '{blockRefId}'. " +
                $"Referenced by node '{nodeId}'. " +
                $"Run 'maestro block deps <parent-block>' to see all dependencies.");

        // === Phase 59-C: BlockPermission enforcement ===
        // Check if the block is allowed by the session's BlockPermissions.
        // This check is centralized here — BlockRefHandler is the single dispatch point for blockRef nodes.
        var blockPermission = CheckBlockPermission(session, blockRefId);
        if (blockPermission == Domain.ValueObjects.BlockPermissionLevel.Denied)
            throw new InvalidOperationException(
                $"Block '{blockRefId}' is denied by session permissions.");
        if (blockPermission == Domain.ValueObjects.BlockPermissionLevel.RequiresApproval)
            throw new InvalidOperationException(
                $"Block '{blockRefId}' requires approval. Approval workflow not yet implemented.");

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

        // === Phase 59-A: Child session for agent blocks ===
        // Agent blocks execute in an isolated child session to prevent variable pollution.
        // Non-agent blocks (inference, workflow, tool) continue using the parent session.
        ProjectSession? childSession = null;
        var executionSession = session; // The session the executor will use

        if (string.Equals(block.BlockType, "agent", StringComparison.OrdinalIgnoreCase))
        {
            childSession = ProjectSession.CreateAsChild(
                $"{session.Name} / {blockRefId}",
                session);

            // Set declared inputs from the blockRef node as variables on the child session.
            // Phase 59-B: Filter out any system variables that must never cross session boundaries.
            foreach (var kv in inputs)
            {
                if (SystemVariableBlacklist.Contains(kv.Key))
                {
                    _logger.LogWarning(
                        "Blocked system variable '{Key}' from crossing to child session '{ChildId}' (blockRef '{BlockRef}')",
                        kv.Key, childSession.Id, blockRefId);
                    continue;
                }
                childSession.SetVariable(kv.Key, kv.Value);
            }

            await _repository.SaveAsync(childSession);
            executionSession = childSession;

            _stateManager.AppendExecutionLog(session, "info",
                $"Created child session '{childSession.Id}' for agent blockRef '{blockRefId}'");
            _logger.LogInformation(
                "Created child session {ChildSessionId} (parent: {ParentSessionId}) for agent blockRef '{BlockRef}'",
                childSession.Id, session.Id, blockRefId);
        }

        // Standard executor dispatch (uses child session for agents, parent for others)
        var execContext = BuildExecutionContext(executionSession, workingDir, blockRefId);

        try
        {
            var result = await executor.ExecuteAsync(block, execContext, inputs);

            // Accumulate costs on the PARENT session (cost tracking is always at parent level)
            AccumulateCosts(session, result);

            // Sync _capturedToolCalls back to session (capture blocks write to context,
            // but we need it in session for the next iteration's BuildExecutionContext)
            if (execContext.Variables.TryGetValue("_capturedToolCalls", out var updatedCaptures))
                session.SetVariable("_capturedToolCalls", updatedCaptures);

            // Phase 59-PRE-A: Record cost entry and check limits (post-execution, for tracking)
            await RecordAndCheckCosts(session, result, blockRefId, block);

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

            // Phase 59-A: Store child session ID on parent for traceability
            if (childSession != null)
            {
                session.SetVariable($"_childSession_{nodeId}", childSession.Id);
                _stateManager.AppendExecutionLog(session, "info",
                    $"Agent blockRef '{blockRefId}' completed in child session '{childSession.Id}'");
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

    // ===== Pre-Execution Cost Limit Check (Phase 59-PRE-2-A) =====
    // ===== Auto-Resume Detection (Phase 59-PRE-2-B) =====

    /// <summary>
    /// Checks cost limits BEFORE executing a block.
    /// Phase 59-PRE-2-B: First checks if a previously stopped session can auto-resume
    /// (temporal limit reset: day/week/month boundary crossed since _costStoppedAt).
    /// If enforcement="block" and limit is exceeded:
    ///   - Sets _costStopped* variables on the session
    ///   - Returns a stop message (non-null = stopped)
    /// If enforcement="warn" and limit is exceeded:
    ///   - Sets _costLimitExceeded and _costLimitMessage variables
    ///   - Returns null (continue execution)
    /// If no limit exceeded: returns null (continue execution)
    /// </summary>
    internal async Task<string?> CheckCostBeforeExecutionAsync(ProjectSession session, string nodeId, string blockRefId)
    {
        if (_costTracking == null)
            return null;

        try
        {
            // Phase 59-PRE-2-B: Auto-resume detection
            // If session was previously stopped and the quota period has reset, clear stop flags
            await TryAutoResumeAsync(session);

            var sessionCost = decimal.TryParse(
                session.GetVariable("_accumulatedCost")?.ToString(),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var sc) ? sc : 0m;

            var check = await _costTracking.CheckLimitAsync(session.Id, sessionCost);
            if (!check.Exceeded)
            {
                // Not exceeded — if there were orphan stop flags from a previous period, clean them up
                ClearCostStopFlags(session);
                return null;
            }

            if (string.Equals(check.Enforcement, "block", StringComparison.OrdinalIgnoreCase))
            {
                // Hard stop: set variables and return stop signal
                session.SetVariable("_costLimitExceeded", "true");
                session.SetVariable("_costLimitType", check.LimitType);
                session.SetVariable("_costLimitMessage", check.Message ?? $"{check.LimitType} limit exceeded");
                session.SetVariable("_costStoppedAt", DateTime.UtcNow.ToString("o"));
                session.SetVariable("_costStoppedEntryPoint", session.GetVariable("_activeWorkflow")?.ToString() ?? "");
                session.SetVariable("_costStoppedNodeId", nodeId);
                session.SetVariable("_costAutoResume", check.AutoResume ? "true" : "false");

                _stateManager.AppendExecutionLog(session, "warning",
                    $"Cost limit BLOCK: {check.Message} — stopping before node '{nodeId}' (blockRef '{blockRefId}')");
                _logger.LogWarning(
                    "Cost limit enforcement=block for session {SessionId}: {LimitType} ${Max} exceeded (current: ${Current}). Stopping before node '{NodeId}'.",
                    session.Id, check.LimitType, check.MaxValue, check.CurrentValue, nodeId);

                await _repository.SaveAsync(session);

                // Return a non-null string as cost-stop signal (also used as the "output" for this node)
                return $"[COST-LIMIT-STOPPED] {check.Message}";
            }
            else
            {
                // Warn: set variables but continue
                session.SetVariable("_costLimitExceeded", "true");
                session.SetVariable("_costLimitMessage", check.Message ?? $"{check.LimitType} limit exceeded (warning)");

                _stateManager.AppendExecutionLog(session, "warning",
                    $"Cost limit WARN: {check.Message} — continuing execution of node '{nodeId}'");
                _logger.LogWarning(
                    "Cost limit enforcement=warn for session {SessionId}: {LimitType} ${Max} exceeded (current: ${Current}). Continuing.",
                    session.Id, check.LimitType, check.MaxValue, check.CurrentValue);

                await _repository.SaveAsync(session);
                return null; // Continue execution
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to check cost limits before execution of node '{NodeId}'", nodeId);
            return null; // On error, don't block execution
        }
    }

    // ===== Auto-Resume Detection (Phase 59-PRE-2-B) =====

    /// <summary>
    /// Checks if a previously cost-stopped session can auto-resume because
    /// the temporal limit period has reset (day/week/month boundary crossed).
    /// Does NOT auto-resume for session limits (no temporal reset).
    /// Does NOT auto-resume if _costAutoResume != "true".
    /// Clears stop flags if resume is appropriate — but CheckLimitAsync will still
    /// verify the new period isn't already exceeded (other sessions may have spent).
    /// </summary>
    internal async Task TryAutoResumeAsync(ProjectSession session)
    {
        var autoResume = session.GetVariable("_costAutoResume")?.ToString();
        if (!string.Equals(autoResume, "true", StringComparison.OrdinalIgnoreCase))
            return; // Not configured for auto-resume

        var limitType = session.GetVariable("_costLimitType")?.ToString();
        if (string.IsNullOrEmpty(limitType))
            return; // No limit type recorded

        // Session limits have no temporal reset — never auto-resume
        if (string.Equals(limitType, "session", StringComparison.OrdinalIgnoreCase))
            return;

        var stoppedAtStr = session.GetVariable("_costStoppedAt")?.ToString();
        if (string.IsNullOrEmpty(stoppedAtStr))
            return; // No stop timestamp

        if (!DateTime.TryParse(stoppedAtStr, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out var stoppedAt))
            return; // Invalid timestamp

        // Ensure UTC
        if (stoppedAt.Kind == DateTimeKind.Local)
            stoppedAt = stoppedAt.ToUniversalTime();
        else if (stoppedAt.Kind == DateTimeKind.Unspecified)
            stoppedAt = DateTime.SpecifyKind(stoppedAt, DateTimeKind.Utc);

        var now = DateTime.UtcNow;
        var periodReset = HasPeriodReset(limitType, stoppedAt, now);

        if (!periodReset)
            return; // Still in the same period — no auto-resume

        // Period has reset — clear all cost-stop flags
        // Note: CheckLimitAsync will still run after this and verify the new period isn't already exceeded
        ClearCostStopFlags(session);

        _stateManager.AppendExecutionLog(session, "info",
            $"Cost auto-resume: {limitType} period has reset since stop at {stoppedAtStr}. Flags cleared, re-checking limits.");
        _logger.LogInformation(
            "Cost auto-resume for session {SessionId}: {LimitType} period reset (stopped at {StoppedAt}). Clearing flags.",
            session.Id, limitType, stoppedAtStr);

        await _repository.SaveAsync(session);
    }

    /// <summary>
    /// Determines if the temporal period has reset between stoppedAt and now.
    /// Uses UTC for all comparisons.
    /// - day: stoppedAt is before today 00:00 UTC
    /// - weekly: stoppedAt is before this Monday 00:00 UTC (ISO 8601: Monday = start of week)
    /// - month/monthly: stoppedAt is before the 1st of current month 00:00 UTC
    /// </summary>
    internal static bool HasPeriodReset(string limitType, DateTime stoppedAt, DateTime now)
    {
        switch (limitType.ToLowerInvariant())
        {
            case "day":
            case "daily":
                var startOfToday = now.Date;
                return stoppedAt < startOfToday;

            case "week":
            case "weekly":
                // Monday = start of week (ISO 8601)
                var daysSinceMonday = ((int)now.DayOfWeek + 6) % 7; // Monday=0, Sunday=6
                var startOfWeek = now.Date.AddDays(-daysSinceMonday);
                return stoppedAt < startOfWeek;

            case "month":
            case "monthly":
                var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
                return stoppedAt < startOfMonth;

            default:
                return false; // Unknown limit type — don't auto-resume
        }
    }

    /// <summary>
    /// Clears all cost-stop related session variables.
    /// Called when auto-resuming after a period reset, or when execution succeeds
    /// (no limit exceeded) to clean up orphan flags from previous stops.
    /// Uses RemoveVariable to fully remove keys from the dictionary.
    /// </summary>
    internal static void ClearCostStopFlags(ProjectSession session)
    {
        // Only clear if there are actually flags to clear (avoid unnecessary writes)
        var hasFlags = session.GetVariable("_costLimitExceeded") != null
                    || session.GetVariable("_costStoppedAt") != null;
        if (!hasFlags)
            return;

        session.RemoveVariable("_costLimitExceeded");
        session.RemoveVariable("_costLimitMessage");
        session.RemoveVariable("_costStoppedAt");
        session.RemoveVariable("_costStoppedEntryPoint");
        session.RemoveVariable("_costStoppedNodeId");
        session.RemoveVariable("_costAutoResume");
        session.RemoveVariable("_costLimitType");
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

        // Phase 59-C: Pass FileAccessRules through execution context for enforcement
        // in file operation executors (file-read, file-write, file-edit).
        if (session.FileAccessRules.Count > 0)
        {
            execContext.Variables[FileAccessChecker.FileAccessRulesKey] =
                FileAccessChecker.SerializeRules(session.FileAccessRules);
        }

        // Phase 62-A: Propagate _toolMapping so ToolDispatcherBlockExecutor can redirect
        // tools to capture/mock blocks during contract tests or sandboxed execution.
        var toolMapping = session.GetVariable("_toolMapping");
        if (toolMapping != null)
            execContext.Variables["_toolMapping"] = toolMapping;

        // Propagate _capturedToolCalls so capture blocks can read previous captures
        var capturedCalls = session.GetVariable("_capturedToolCalls");
        if (capturedCalls != null)
            execContext.Variables["_capturedToolCalls"] = capturedCalls;

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

    /// <summary>
    /// Records cost entry to JSONL history and checks cost limits (post-execution tracking).
    /// If a limit is exceeded, sets _costLimitExceeded and _costLimitMessage on the session.
    /// Does NOT throw — the workflow can read the variable and decide what to do.
    /// Note: The actual enforcement (blocking before execution) is in CheckCostBeforeExecutionAsync.
    /// This method is for recording and post-execution awareness.
    /// </summary>
    private async Task RecordAndCheckCosts(ProjectSession session, BlockExecutionResult result, string blockRefId, BlockDefinition block)
    {
        if (_costTracking == null || result.EstimatedCostUsd == 0m)
            return;

        try
        {
            // Extract modelId from block config (best-effort)
            var modelId = block.Config != null && block.Config.TryGetValue("model", out var m) && m != null
                ? m.ToString() ?? "unknown"
                : "unknown";

            var entry = new CostEntryDto
            {
                SessionId = session.Id,
                BlockId = blockRefId,
                ModelId = modelId!,
                ProviderId = "", // Provider not available at this level
                PromptTokens = result.PromptTokens,
                CompletionTokens = result.CompletionTokens,
                CostUsd = result.EstimatedCostUsd,
                Timestamp = DateTime.UtcNow
            };

            await _costTracking.RecordCostAsync(entry);

            // Read current accumulated session cost
            var sessionCost = decimal.TryParse(
                session.GetVariable("_accumulatedCost")?.ToString(),
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var sc) ? sc : 0m;

            var check = await _costTracking.CheckLimitAsync(session.Id, sessionCost);
            if (check.Exceeded)
            {
                session.SetVariable("_costLimitExceeded", "true");
                session.SetVariable("_costLimitMessage", check.Message ?? $"{check.LimitType} limit exceeded");
                _logger.LogWarning("Cost limit exceeded for session {SessionId}: {LimitType} limit ${Max} (current: ${Current})",
                    session.Id, check.LimitType, check.MaxValue, check.CurrentValue);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to record/check costs for blockRef '{BlockRef}'", blockRefId);
        }
    }

    // ===== Phase 59-C: BlockPermission Check =====

    /// <summary>
    /// Checks if a block is allowed by the session's BlockPermissions.
    /// Walks the BlockPermissions list (first match wins).
    /// Returns Allowed if no rule matches (default permissive).
    /// </summary>
    internal static Domain.ValueObjects.BlockPermissionLevel CheckBlockPermission(
        ProjectSession session, string blockRefId)
    {
        var permissions = session.BlockPermissions;
        if (permissions == null || permissions.Count == 0)
            return Domain.ValueObjects.BlockPermissionLevel.Allowed;

        foreach (var rule in permissions)
        {
            if (rule.Matches(blockRefId))
                return rule.Permission;
        }

        return Domain.ValueObjects.BlockPermissionLevel.Allowed; // No rule matched — allow
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
