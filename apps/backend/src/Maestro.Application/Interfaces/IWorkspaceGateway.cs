using System.Threading;
using System.Threading.Tasks;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Gateway for cross-workspace operations with permission enforcement.
/// </summary>
public interface IWorkspaceGateway
{
    /// <summary>
    /// Promote an agent from one workspace to another.
    /// </summary>
    /// <param name="sourceWorkspaceId">Source workspace ID</param>
    /// <param name="targetWorkspaceId">Target workspace ID</param>
    /// <param name="agentBlockId">Agent block ID to promote</param>
    /// <param name="version">Optional specific version</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Result of the promotion operation</returns>
    Task<PromotionResult> PromoteAgentAsync(
        string sourceWorkspaceId,
        string targetWorkspaceId,
        string agentBlockId,
        string? version = null,
        CancellationToken ct = default);

    /// <summary>
    /// Read metrics from another workspace.
    /// </summary>
    /// <param name="sourceWorkspaceId">Workspace requesting read</param>
    /// <param name="targetWorkspaceId">Workspace to read from</param>
    /// <param name="query">Metrics query</param>
    /// <param name="ct">Cancellation token</param>
    Task<WorkspaceMetricsSnapshot> ReadMetricsAsync(
        string sourceWorkspaceId,
        string targetWorkspaceId,
        WorkspaceMetricsQuery query,
        CancellationToken ct = default);

    /// <summary>
    /// Trigger an action in another workspace.
    /// </summary>
    /// <param name="sourceWorkspaceId">Workspace requesting action</param>
    /// <param name="targetWorkspaceId">Target workspace</param>
    /// <param name="action">Action to trigger</param>
    /// <param name="ct">Cancellation token</param>
    Task<WorkspaceActionResult> TriggerActionAsync(
        string sourceWorkspaceId,
        string targetWorkspaceId,
        WorkspaceAction action,
        CancellationToken ct = default);

    /// <summary>
    /// Check if a cross-workspace operation is permitted.
    /// </summary>
    Task<bool> IsOperationPermittedAsync(
        string sourceWorkspaceId,
        string targetWorkspaceId,
        CrossWorkspaceOperation operation,
        CancellationToken ct = default);
}

/// <summary>
/// Types of cross-workspace operations.
/// </summary>
public enum CrossWorkspaceOperation
{
    Read,
    Write,
    Promote,
    Trigger
}

/// <summary>
/// Result of a promotion operation.
/// </summary>
public class PromotionResult
{
    public bool Success { get; set; }
    public string? PromotedBlockId { get; set; }
    public string? TargetVersion { get; set; }
    public string? ErrorMessage { get; set; }
    public string? AuditLogId { get; set; }
}

/// <summary>
/// Metrics query for cross-workspace reads.
/// </summary>
public class WorkspaceMetricsQuery
{
    public string? AgentId { get; set; }
    public string? WorkflowId { get; set; }
    public System.DateTimeOffset? From { get; set; }
    public System.DateTimeOffset? To { get; set; }
    public string? MetricType { get; set; } // "fitness", "execution", "cost"
    public int? Limit { get; set; }
}

/// <summary>
/// Snapshot of workspace metrics.
/// </summary>
public class WorkspaceMetricsSnapshot
{
    public string WorkspaceId { get; set; } = string.Empty;
    public System.DateTimeOffset Timestamp { get; set; }
    public double? AverageFitness { get; set; }
    public int TotalExecutions { get; set; }
    public int SuccessfulExecutions { get; set; }
    public decimal TotalCost { get; set; }
    public System.Collections.Generic.Dictionary<string, double> AgentFitness { get; set; } = new();
}

/// <summary>
/// Action to trigger in another workspace.
/// </summary>
public class WorkspaceAction
{
    public string ActionType { get; set; } = string.Empty; // "start-training", "stop-session", "trigger-workflow"
    public string? TargetId { get; set; } // Session/Training/Workflow ID
    public System.Collections.Generic.Dictionary<string, object>? Parameters { get; set; }
}

/// <summary>
/// Result of a triggered action.
/// </summary>
public class WorkspaceActionResult
{
    public bool Success { get; set; }
    public string? ResultId { get; set; }
    public string? ErrorMessage { get; set; }
    public string? AuditLogId { get; set; }
}
