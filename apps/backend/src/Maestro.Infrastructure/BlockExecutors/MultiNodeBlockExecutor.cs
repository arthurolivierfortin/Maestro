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

        // Set input variables on session for template resolution in nodes
        foreach (var kv in inputs)
            session.SetVariable(kv.Key, kv.Value);

        var workingDir = context.Variables.ContainsKey("workingDir")
            ? context.Variables["workingDir"]?.ToString() ?? Directory.GetCurrentDirectory()
            : Directory.GetCurrentDirectory();

        var displayTree = StateManager.BuildExecutionTree(block);

        await Engine.ExecuteConfigNodesAsync(
            session, configNodes, null, workingDir, block.Id, null, displayTree);

        // Sync session variables back to execution context so ExtractResultAsync can read them
        foreach (var kv in session.Variables)
            context.Variables[kv.Key] = kv.Value;
    }
}
