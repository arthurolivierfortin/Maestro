using Maestro.Domain.Entities;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Manages session state during workflow execution: execution tree, logs,
/// metrics, artifacts, and active block tracking.
///
/// ARCHITECTURE (Phase 53-A): Extracted from EntryPointExecutor to separate
/// state management from control flow orchestration. This is a pure refactoring
/// — all behavior is identical to the original monolith.
///
/// WARNING: Do NOT add execution logic or control flow here.
/// This class manages STATE, not EXECUTION.
/// </summary>
public interface ISessionStateManager
{
    /// <summary>
    /// Initializes runtime-only session variables (_executionLog, _artifacts, etc.)
    /// and normalizes template-derived variables like _phases.
    /// </summary>
    void InitializeRuntime(ProjectSession session);

    /// <summary>
    /// Builds a hierarchical execution tree from a workflow block's config.nodes.
    /// </summary>
    List<object> BuildExecutionTree(BlockDefinition? workflowBlock);

    // ===== Active Block =====

    void SetActiveBlock(ProjectSession session, string id, string name, string type, string status, string? output = null);
    void UpdateActiveBlockOutput(ProjectSession session, string output);
    void UpdateActiveBlockStatus(ProjectSession session, string status);
    void ClearActiveBlock(ProjectSession session);

    // ===== Block Outputs =====

    void StoreBlockOutput(ProjectSession session, string nodeId, string blockType, string? rawOutput, Dictionary<string, object>? detailOverride = null);

    // ===== Phase Management =====

    bool UpdatePhaseStatus(ProjectSession session, string phaseId, string status, int? progress = null);
    void StorePhaseSummary(ProjectSession session, string phaseId, int iterations, double fitness);

    // ===== Metrics & Logging =====

    void StoreIterationMetrics(ProjectSession session, string? phaseId, int iteration, double fitness);
    void AppendToLLMActivity(ProjectSession session, Dictionary<string, object> activity);
    void AppendExecutionLog(ProjectSession session, string level, string message);
    void AddArtifact(ProjectSession session, string name, string type, string? size = null, string status = "new");

    // ===== Tree Manipulation =====

    void UpdateNodeById(List<object> tree, string nodeId, string status, string? output = null);
    void ResetNodeTree(List<object> nodes);
    Dictionary<string, object>? FindNodeById(List<object> tree, string nodeId);
}
