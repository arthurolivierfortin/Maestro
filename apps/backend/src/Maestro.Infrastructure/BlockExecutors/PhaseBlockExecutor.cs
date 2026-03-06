using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.Sessions;
using Microsoft.Extensions.DependencyInjection;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Executes a "phase" scope node: named grouping of child nodes with config section
/// and phase status tracking. Executes children exactly once.
/// Extracted from NodeExecutionEngine.ExecutePhaseNodeAsync — same logic.
///
/// Phase 53-C: Atomic block executor.
/// Note: This executor manages phase-level orchestration. It delegates to
/// NodeExecutionEngine for child node execution via the session system.
/// </summary>
public class PhaseBlockExecutor : IBlockExecutor
{
    private readonly IServiceProvider _serviceProvider;

    public string SupportedType => "phase";

    public PhaseBlockExecutor(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        var sessionId = context.Variables.TryGetValue("sessionId", out var sidObj) ? sidObj?.ToString() : null;
        if (string.IsNullOrEmpty(sessionId))
        {
            result.Success = false;
            result.Outputs["error"] = "Missing sessionId in context";
            return result;
        }

        var repository = _serviceProvider.GetRequiredService<IProjectSessionRepository>();
        var stateManager = _serviceProvider.GetRequiredService<ISessionStateManager>();
        var engine = _serviceProvider.GetRequiredService<NodeExecutionEngine>();

        var session = await repository.GetByIdAsync(SessionId.From(sessionId));
        if (session == null)
        {
            result.Success = false;
            result.Outputs["error"] = $"Session not found: {sessionId}";
            return result;
        }

        var configSection = block.Config?.TryGetValue("configSection", out var csObj) == true
            ? csObj?.ToString() ?? block.Id
            : block.Id;

        var workingDir = context.Variables.TryGetValue("workingDir", out var wdObj)
            ? wdObj?.ToString() ?? Directory.GetCurrentDirectory()
            : Directory.GetCurrentDirectory();

        // Update phase status
        stateManager.UpdatePhaseStatus(session, configSection, "running", 0);
        stateManager.AppendExecutionLog(session, "info", $"Starting phase '{configSection}'");
        await repository.SaveAsync(session);

        // Execute child nodes if block has config.nodes
        string? lastOutput = null;
        if (block.Config != null && block.Config.TryGetValue("nodes", out var nodesObj))
        {
            JsonElement configNodes;
            if (nodesObj is JsonElement je && je.ValueKind == JsonValueKind.Array)
            {
                configNodes = je;
            }
            else
            {
                var serialized = System.Text.Json.JsonSerializer.Serialize(nodesObj);
                using var doc = JsonDocument.Parse(serialized);
                configNodes = doc.RootElement.Clone();
            }

            var displayTree = stateManager.BuildExecutionTree(block);
            lastOutput = await engine.ExecuteConfigNodesAsync(
                session, configNodes, null, workingDir, block.Id, configSection, displayTree);
        }

        // Finalize phase
        var fitness = SessionStateManager.ReadDoubleVariable(session, "currentFitness", 0);
        stateManager.UpdatePhaseStatus(session, configSection, "done");
        stateManager.AppendExecutionLog(session, "success", $"Phase '{configSection}' completed (fitness: {fitness:F2})");
        await repository.SaveAsync(session);

        result.Outputs["result"] = lastOutput ?? "";
        result.Outputs["fitness"] = fitness;
        result.Logs.Add($"Phase '{configSection}' completed (fitness: {fitness:F2})");

        return result;
    }
}
