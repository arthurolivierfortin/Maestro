using System.Text.Json;
using Newtonsoft.Json.Linq;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.Sessions;
using Microsoft.Extensions.DependencyInjection;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Abstract base class for all block executors that support config.nodes (agent, workflow, tool).
/// Template method pattern:
///   1. PrepareExecutionAsync — subclass sets up context (conversation, input mapping)
///   2. ExecuteConfigNodesAsync — delegates to NodeExecutionEngine
///   3. ExtractResultAsync — subclass reads outputs from execution state
///
/// All blocks MUST have config.nodes. Blocks without config.nodes will fail with an error.
///
/// ARCHITECTURE (Phase 53-B/E): Dependencies are lazy-resolved from IServiceProvider
/// to avoid circular DI (this executor → BlockExecutorRegistry → this executor).
/// </summary>
public abstract class MultiNodeBlockExecutor : IBlockExecutor
{
    public abstract string SupportedType { get; }

    protected readonly IServiceProvider? _serviceProvider;

    // Lazy-resolved to avoid circular DI
    private NodeExecutionEngine? _engine;
    private ISessionStateManager? _stateManager;
    private IProjectSessionRepository? _repository;

    protected NodeExecutionEngine Engine =>
        _engine ??= _serviceProvider!.GetRequiredService<NodeExecutionEngine>();
    protected ISessionStateManager StateManager =>
        _stateManager ??= _serviceProvider!.GetRequiredService<ISessionStateManager>();
    protected IProjectSessionRepository Repository =>
        _repository ??= _serviceProvider!.GetRequiredService<IProjectSessionRepository>();

    protected MultiNodeBlockExecutor(IServiceProvider? serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        if (!HasConfigNodes(block))
        {
            throw new InvalidOperationException(
                $"Block '{block.Id}' (type: {SupportedType}) has no config.nodes. " +
                $"All {SupportedType} blocks must define config.nodes. " +
                "See docs/phases/PHASE-53/ADR-AGENT-AS-WORKFLOW.md.");
        }

        var execInputs = await PrepareExecutionAsync(block, context, inputs, ct);
        await ExecuteConfigNodesAsync(block, context, execInputs, ct);
        return await ExtractResultAsync(block, context, ct);
    }

    /// <summary>
    /// Subclass prepares execution: conversation setup (agent), input mapping (tool), pass-through (workflow).
    /// </summary>
    protected abstract Task<Dictionary<string, object>> PrepareExecutionAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct);

    /// <summary>
    /// Subclass extracts result after nodes have executed.
    /// </summary>
    protected abstract Task<BlockExecutionResult> ExtractResultAsync(
        BlockDefinition block, ExecutionContext context, CancellationToken ct);

    /// <summary>
    /// Reads accumulated costs from execution context variables.
    /// These are populated by BlockRefHandler during config.nodes execution.
    /// </summary>
    protected (decimal cost, int promptTokens, int completionTokens) GetAccumulatedCosts(ExecutionContext context)
    {
        var cost = decimal.TryParse(
            context.Variables.GetValueOrDefault("_accumulatedCost")?.ToString(),
            System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture,
            out var c) ? c : 0m;
        var prompt = int.TryParse(
            context.Variables.GetValueOrDefault("_accumulatedPromptTokens")?.ToString(),
            out var p) ? p : 0;
        var completion = int.TryParse(
            context.Variables.GetValueOrDefault("_accumulatedCompletionTokens")?.ToString(),
            out var cp) ? cp : 0;
        return (cost, prompt, completion);
    }

    protected bool HasConfigNodes(BlockDefinition block)
    {
        if (block.Config == null) return false;
        if (!block.Config.TryGetValue("nodes", out var nodesObj) || nodesObj == null) return false;

        if (nodesObj is JsonElement je)
            return je.ValueKind == JsonValueKind.Array && je.GetArrayLength() > 0;

        if (nodesObj is JArray ja)
            return ja.Count > 0;

        try
        {
            var serialized = JsonSerializer.Serialize(nodesObj);
            using var doc = JsonDocument.Parse(serialized);
            return doc.RootElement.ValueKind == JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Pre-flight check before executing config.nodes (Phase 61-B).
    /// Logs block configuration (model, maxIterations) for transparency.
    /// BLOCKS execution if maxIterations cannot be resolved to a valid number
    /// (and it's not a template variable pattern or "not set").
    /// Logs warnings for high iteration counts and cost estimates.
    /// </summary>
    internal static void PreFlightCheck(BlockDefinition block, Domain.Entities.ProjectSession session, ISessionStateManager stateManager)
    {
        // Extract config values for logging
        var model = block.Config?.TryGetValue("model", out var modelObj) == true
            ? modelObj?.ToString() ?? "default"
            : "default";
        var maxIterStr = block.Config?.TryGetValue("maxIterations", out var maxIterObj) == true
            ? maxIterObj?.ToString() ?? "not set"
            : "not set";
        var keepLastN = "default";
        if (block.Config?.TryGetValue("context", out var ctxObj) == true && ctxObj is JsonElement ctxEl
            && ctxEl.ValueKind == JsonValueKind.Object
            && ctxEl.TryGetProperty("keepLastN", out var klnProp))
        {
            keepLastN = klnProp.ToString();
        }

        stateManager.AppendExecutionLog(session, "info",
            $"Pre-flight: block '{block.Id}' (type: {block.BlockType}), model={model}, maxIterations={maxIterStr}, keepLastN={keepLastN}");

        // Validate maxIterations — BLOCKING if not resolvable to a number
        if (int.TryParse(maxIterStr, out var maxIter))
        {
            if (maxIter <= 0)
            {
                stateManager.AppendExecutionLog(session, "warning",
                    $"Pre-flight: maxIterations={maxIter} is invalid (must be > 0). Engine will use default (50).");
            }
            else if (maxIter > 50)
            {
                stateManager.AppendExecutionLog(session, "warning",
                    $"Pre-flight: maxIterations={maxIter} exceeds recommended max (50). High iteration counts increase cost and risk of loops.");
            }

            // Cost estimation (informational)
            var estimatedCostPerIter = 0.14m; // ~$0.14/iter for Sonnet with 30K system prompt
            var estimatedMaxCost = maxIter * estimatedCostPerIter;
            stateManager.AppendExecutionLog(session, "info",
                $"Pre-flight: estimated max cost: ${estimatedMaxCost:F2} ({maxIter} x ${estimatedCostPerIter:F3}/iter)");
            if (estimatedMaxCost > 5.0m)
            {
                stateManager.AppendExecutionLog(session, "warning",
                    $"Pre-flight: estimated cost ${estimatedMaxCost:F2} exceeds $5. Consider reducing maxIterations.");
            }
        }
        else if (maxIterStr == "not set")
        {
            // No maxIterations configured — engine will use default (50). Informational only.
            stateManager.AppendExecutionLog(session, "info",
                "Pre-flight: maxIterations not set. Engine will use default (50).");
        }
        else if (maxIterStr.Contains("{{"))
        {
            // Template variable — check if session variable resolves it
            var resolved = session.GetVariable("maxIterations")?.ToString();
            if (!string.IsNullOrEmpty(resolved) && int.TryParse(resolved, out _))
            {
                // Template variable will be resolved at runtime — OK
                stateManager.AppendExecutionLog(session, "info",
                    $"Pre-flight: maxIterations='{maxIterStr}' will resolve from session variable ({resolved}).");
            }
            else
            {
                // Template variable but no valid session variable to resolve it — BLOCK
                throw new InvalidOperationException(
                    $"Pre-flight FAILED for block '{block.Id}': maxIterations='{maxIterStr}' is a template variable " +
                    $"but session variable 'maxIterations' is not set or not a number (value='{resolved ?? "null"}'). " +
                    "This would default to 50 iterations. Fix the config or set the variable.");
            }
        }
        else
        {
            // Not a number, not "not set", not a template variable — misconfigured. BLOCK.
            throw new InvalidOperationException(
                $"Pre-flight FAILED for block '{block.Id}': maxIterations='{maxIterStr}' is not a valid number " +
                "and not a template variable. Fix the block config.");
        }
    }

    /// <summary>
    /// Executes config.nodes by loading the session and delegating to NodeExecutionEngine.
    /// </summary>
    protected async Task ExecuteConfigNodesAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct)
    {
        var sessionId = context.Variables.ContainsKey("sessionId")
            ? context.Variables["sessionId"]?.ToString()
            : null;
        if (string.IsNullOrEmpty(sessionId))
            throw new InvalidOperationException($"sessionId required for config.nodes execution in block '{block.Id}'");

        var session = await Repository.GetByIdAsync(SessionId.From(sessionId));
        if (session == null)
            throw new InvalidOperationException($"Session not found: {sessionId}");

        // Phase 59-C: Reconstitute parent reference for permission inheritance.
        // After loading from repository, _parentSession is null (not persisted).
        // If this is a child session, load the parent and set the transient reference
        // so that GetEffectivePermissions() can walk the inheritance chain.
        if (!string.IsNullOrEmpty(session.ParentSessionId) && session.GetParentContext() == null)
        {
            var parentSession = await Repository.GetByIdAsync(SessionId.From(session.ParentSessionId));
            if (parentSession != null)
            {
                session.SetParentSession(parentSession);
            }
        }

        // Convert config.nodes to JsonElement
        var nodesObj = block.Config!["nodes"];
        JsonElement configNodes;

        if (nodesObj is JsonElement je && je.ValueKind == JsonValueKind.Array)
        {
            configNodes = je;
        }
        else if (nodesObj is JArray jArr)
        {
            using var doc = JsonDocument.Parse(jArr.ToString());
            configNodes = doc.RootElement.Clone();
        }
        else
        {
            var serialized = JsonSerializer.Serialize(nodesObj);
            using var doc = JsonDocument.Parse(serialized);
            configNodes = doc.RootElement.Clone();
        }

        // Phase 59-B: Clear workflow checkpoint state before executing config.nodes.
        // Each config.nodes execution must start fresh — without this, a second agent
        // in the same session would skip nodes because the checkpoint from the first agent
        // contains the same nodeIds (agent templates share nodeIds like "inference", "parse-response", etc.).
        // With child sessions (59-A) this is naturally solved for agents, but non-agent blocks
        // sharing the parent session still need this cleanup.
        session.RemoveVariable("_workflowCheckpoint");
        session.RemoveVariable("_workflowCheckpoint_whileState");
        session.RemoveVariable("_workflowCheckpoint_foreachIndex");

        // Phase 61-A: Inject config values as session variables for template resolution in nodes.
        // Block JSON config values like maxIterations, wallClockTimeoutSeconds, model are referenced
        // as {{maxIterations}} in while nodes. Without this injection, template resolution returns ""
        // and the while loop defaults to 50 (safety max) instead of the intended value.
        if (block.Config != null)
        {
            var configKeysToInject = new[] { "maxIterations", "wallClockTimeoutSeconds", "model" };
            foreach (var key in configKeysToInject)
            {
                if (block.Config.TryGetValue(key, out var val) && val != null
                    && session.GetVariable(key) == null)
                {
                    session.SetVariable(key, val.ToString()!);
                }
            }
        }

        // Set input variables on session for template resolution in nodes
        foreach (var kv in inputs)
            session.SetVariable(kv.Key, kv.Value);

        // Propagate _toolMapping from execution context to session so that
        // ToolDispatcherBlockExecutor can find it when called from within config.nodes.
        // Without this, tool mapping set by ContractTestRunner is lost.
        if (context.Variables.TryGetValue("_toolMapping", out var toolMapping) && toolMapping != null)
            session.SetVariable("_toolMapping", toolMapping);

        var workingDir = context.Variables.ContainsKey("workingDir")
            ? context.Variables["workingDir"]?.ToString() ?? Directory.GetCurrentDirectory()
            : Directory.GetCurrentDirectory();

        // === Pre-flight check (Phase 61-B) ===
        // Log block configuration and BLOCK if maxIterations is misconfigured.
        PreFlightCheck(block, session, StateManager);

        var displayTree = StateManager.BuildExecutionTree(block);

        await Engine.ExecuteConfigNodesAsync(
            session, configNodes, null, workingDir, block.Id, null, displayTree);

        // Sync session variables back to execution context so ExtractResultAsync can read them
        foreach (var kv in session.Variables)
            context.Variables[kv.Key] = kv.Value;
    }
}
