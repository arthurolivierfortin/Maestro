using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Sessions;

/// <summary>
/// Entry point for background workflow execution. Launches workflows,
/// initializes session state, and delegates execution to NodeExecutionEngine.
///
/// ARCHITECTURE (Phase 53-A): Simplified from 4272 lines to ~200 lines.
/// Control flow logic is in NodeExecutionEngine.
/// State management is in SessionStateManager (via ISessionStateManager).
/// This class handles ONLY the entry point lifecycle:
///   1. StartExecution() — background Task.Run with NEW DI scope, returns invocationId
///   2. ExecuteWorkflowAsync() — load session, init runtime, dispatch to engine, cleanup
///
/// ARCHITECTURE (Phase 54): Uses IServiceScopeFactory to create a fresh DI scope
/// for each background execution. This prevents "Cannot access a disposed object"
/// errors when the HTTP request scope is disposed before the background task completes.
/// </summary>
public class EntryPointExecutor
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EntryPointExecutor> _logger;

    public EntryPointExecutor(
        IServiceScopeFactory scopeFactory,
        ILogger<EntryPointExecutor> logger)
    {
        _scopeFactory = scopeFactory;
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
            // Create a new DI scope so all scoped services (engine, executors, repositories)
            // live for the entire background execution, not just the HTTP request.
            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<IProjectSessionRepository>();
            var blockDiscovery = scope.ServiceProvider.GetRequiredService<IBlockDiscoveryService>();
            var engine = scope.ServiceProvider.GetRequiredService<NodeExecutionEngine>();
            var stateManager = scope.ServiceProvider.GetRequiredService<ISessionStateManager>();
            var executorRegistry = scope.ServiceProvider.GetService<BlockExecutors.BlockExecutorRegistry>();

            try
            {
                await ExecuteWorkflowAsync(sessionId, entryPoint, workflowId, invocationId, inputs,
                    repository, blockDiscovery, engine, stateManager, executorRegistry);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Entry point execution failed: {EntryPoint} on session {SessionId}", entryPoint, sessionId.Value);
                try
                {
                    var failedSession = await repository.GetByIdAsync(sessionId);
                    if (failedSession != null)
                    {
                        stateManager.AppendExecutionLog(failedSession, "error", $"Workflow crashed: {ex.Message}");
                        await repository.SaveAsync(failedSession);
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
    /// for configuration, builds the execution tree dynamically, and dispatches
    /// to NodeExecutionEngine for control flow execution.
    /// </summary>
    private async Task ExecuteWorkflowAsync(
        SessionId sessionId,
        string entryPoint,
        string workflowId,
        string invocationId,
        Dictionary<string, object>? inputs,
        IProjectSessionRepository repository,
        IBlockDiscoveryService blockDiscovery,
        NodeExecutionEngine engine,
        ISessionStateManager stateManager,
        BlockExecutors.BlockExecutorRegistry? executorRegistry)
    {
        _logger.LogInformation("Starting workflow execution: {WorkflowId} for entry point {EntryPoint} on session {SessionId}",
            workflowId, entryPoint, sessionId.Value);

        var session = await repository.GetByIdAsync(sessionId);
        if (session == null) return;

        var workingDir = SessionHelper.GetProjectPath(session);

        // 1. Load workflow block (optional — execution still works without it)
        var blockId = SessionHelper.NormalizeBlockId(workflowId);
        var workflowBlock = await blockDiscovery.GetByIdAsync(blockId, session.BlockSearchPaths);
        if (workflowBlock == null)
        {
            _logger.LogWarning("Workflow block not found: {BlockId}. Using minimal execution.", blockId);
        }

        // 2. Initialize runtime state via SessionStateManager
        stateManager.InitializeRuntime(session);

        // 3. Build execution tree from workflow block config.nodes
        var tree = stateManager.BuildExecutionTree(workflowBlock);

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
        if (!string.IsNullOrEmpty(session.RepositoryPath) && session.GetVariable("repoPath") == null)
        {
            session.SetVariable("repoPath", session.RepositoryPath);
        }

        stateManager.AppendExecutionLog(session, "info", $"Starting workflow: {workflowId}");
        await repository.SaveAsync(session);

        // 5. Dispatch to appropriate execution path
        var workflowConfig = SessionHelper.GetWorkflowConfig(session, workflowId, null);

        var isWorkflowWithNodes = workflowBlock?.Config != null
            && workflowBlock.Config.ContainsKey("nodes")
            && string.Equals(workflowBlock.BlockType, "workflow", StringComparison.OrdinalIgnoreCase);

        if (isWorkflowWithNodes)
        {
            // Workflow block: walk config.nodes via NodeExecutionEngine
            var configNodesObj = workflowBlock!.Config["nodes"];
            if (configNodesObj is JsonElement nodesEl && nodesEl.ValueKind == JsonValueKind.Array)
            {
                await engine.ExecuteConfigNodesAsync(session, nodesEl, workflowConfig, workingDir, workflowId, null, tree);
            }
        }
        else if (workflowBlock != null && executorRegistry?.Get(workflowBlock.BlockType) != null)
        {
            // Non-workflow block (agent, tool, etc.): dispatch via BlockExecutorRegistry
            tree = new List<object> { SessionStateManager.CreateNode("execute", workflowBlock.Name ?? workflowId, "pending") };
            stateManager.AppendExecutionLog(session, "info", $"Executing block '{workflowId}' directly (type: {workflowBlock.BlockType})");
            stateManager.UpdateNodeById(tree, "execute", "running", $"Running {workflowBlock.BlockType}...");
            session.SetVariable("_executionTree", tree);
            await repository.SaveAsync(session);

            var dummyPhaseNode = JsonSerializer.SerializeToElement(new
            {
                id = "execute",
                blockRef = workflowId,
                inputs = inputs ?? new Dictionary<string, object>()
            });
            var output = await engine.ExecuteBlockRefAsync(session, workflowId, dummyPhaseNode, workingDir, tree, "execute", null);

            var truncated = output != null && output.Length > 500 ? output[..500] + "..." : output;
            stateManager.UpdateNodeById(tree, "execute", "done", truncated);
            session.SetVariable("_executionTree", tree);

            stateManager.StoreBlockOutput(session, "execute", workflowBlock.BlockType, output ?? "");
            session.SetVariable($"_nodeResult_execute", output ?? "");
            stateManager.AppendExecutionLog(session, "success", $"blockRef '{workflowId}' completed ({output?.Length ?? 0} chars)");
            await repository.SaveAsync(session);
        }
        else
        {
            // Phase 53: All blocks must have either config.nodes (workflow) or a registered executor.
            // If we reach here, the block definition is invalid.
            throw new InvalidOperationException(
                $"Block '{workflowId}' has no config.nodes and no registered executor (type: {workflowBlock?.BlockType ?? "null"}). " +
                "All blocks must be dispatched via BlockExecutorRegistry since Phase 53.");
        }

        // Clean up checkpoint variables on normal workflow completion
        session.SetVariable("_workflowCheckpoint", null);
        session.SetVariable("_workflowCheckpoint_whileState", null);
        session.SetVariable("_workflowCheckpoint_foreachIndex", null);

        stateManager.ClearActiveBlock(session);
        session.SetVariable("_activeWorkflow", "");
        await repository.SaveAsync(session);

        _logger.LogInformation("Workflow execution completed: {WorkflowId} on session {SessionId}",
            workflowId, sessionId.Value);
    }
}
