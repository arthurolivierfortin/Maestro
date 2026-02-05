using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository for persisting and retrieving execution metrics.
/// </summary>
public interface IMetricsRepository
{
    /// <summary>
    /// Save workflow execution metrics.
    /// </summary>
    Task SaveAsync(WorkflowExecutionMetrics metrics, CancellationToken ct = default);

    /// <summary>
    /// Get metrics for a specific execution.
    /// </summary>
    Task<WorkflowExecutionMetrics?> GetByExecutionIdAsync(string executionId, CancellationToken ct = default);

    /// <summary>
    /// Get metrics for a workflow (all executions).
    /// </summary>
    Task<IReadOnlyList<WorkflowExecutionMetrics>> GetByWorkflowIdAsync(
        string workflowId,
        int? limit = null,
        int? offset = null,
        CancellationToken ct = default);

    /// <summary>
    /// Get metrics for a training run (all iterations).
    /// </summary>
    Task<IReadOnlyList<WorkflowExecutionMetrics>> GetByTrainingRunIdAsync(
        string trainingRunId,
        CancellationToken ct = default);

    /// <summary>
    /// Query metrics with filters.
    /// </summary>
    Task<IReadOnlyList<WorkflowExecutionMetrics>> QueryAsync(
        MetricsQuery query,
        CancellationToken ct = default);

    /// <summary>
    /// Get aggregated metrics.
    /// </summary>
    Task<AggregatedMetrics> GetAggregatedAsync(
        string? workflowId = null,
        DateTimeOffset? startDate = null,
        DateTimeOffset? endDate = null,
        CancellationToken ct = default);

    /// <summary>
    /// Delete metrics older than a certain date.
    /// </summary>
    Task<int> DeleteOlderThanAsync(DateTimeOffset cutoff, CancellationToken ct = default);
}

/// <summary>
/// Query parameters for metrics retrieval.
/// </summary>
public class MetricsQuery
{
    public string? WorkflowId { get; set; }
    public string? TrainingRunId { get; set; }
    public DateTimeOffset? StartDate { get; set; }
    public DateTimeOffset? EndDate { get; set; }
    public string? Status { get; set; }
    public int? MinQualityScore { get; set; }
    public decimal? MaxCost { get; set; }
    public int Limit { get; set; } = 100;
    public int Offset { get; set; } = 0;
    public string OrderBy { get; set; } = "StartedAt";
    public bool Descending { get; set; } = true;
}

/// <summary>
/// Aggregated metrics result.
/// </summary>
public class AggregatedMetrics
{
    public int TotalExecutions { get; set; }
    public int SuccessfulExecutions { get; set; }
    public int FailedExecutions { get; set; }
    public double SuccessRate => TotalExecutions > 0 ? (double)SuccessfulExecutions / TotalExecutions : 0;
    public long AverageDurationMs { get; set; }
    public long MinDurationMs { get; set; }
    public long MaxDurationMs { get; set; }
    public decimal TotalCostUsd { get; set; }
    public decimal AverageCostUsd { get; set; }
    public int TotalTokens { get; set; }
    public int AverageInputTokens { get; set; }
    public int AverageOutputTokens { get; set; }
    public double? AverageQualityScore { get; set; }
    public Dictionary<string, decimal> CostByModel { get; set; } = new();
    public Dictionary<string, int> ExecutionsByStatus { get; set; } = new();
}
