using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Interface for collecting metrics during workflow execution.
/// </summary>
public interface IMetricsCollector
{
    /// <summary>
    /// Record metrics for a completed block execution.
    /// </summary>
    Task RecordBlockMetricsAsync(BlockMetrics metrics, CancellationToken ct = default);

    /// <summary>
    /// Record metrics for an LLM model invocation.
    /// </summary>
    Task RecordModelUsageAsync(ModelUsageMetrics metrics, CancellationToken ct = default);

    /// <summary>
    /// Begin tracking a new execution.
    /// </summary>
    Task BeginExecutionAsync(string executionId, string workflowId, CancellationToken ct = default);

    /// <summary>
    /// Complete execution tracking and return aggregated metrics.
    /// </summary>
    Task<WorkflowExecutionMetrics> CompleteExecutionAsync(
        string executionId,
        string status,
        string? errorMessage = null,
        QualityScore? quality = null,
        CancellationToken ct = default);

    /// <summary>
    /// Get metrics for a specific block during an execution.
    /// </summary>
    Task<BlockMetrics?> GetBlockMetricsAsync(string executionId, string blockId, CancellationToken ct = default);

    /// <summary>
    /// Get all block metrics for an execution.
    /// </summary>
    Task<IReadOnlyList<BlockMetrics>> GetAllBlockMetricsAsync(string executionId, CancellationToken ct = default);

    /// <summary>
    /// Get all model usage for an execution.
    /// </summary>
    Task<IReadOnlyList<ModelUsageMetrics>> GetAllModelMetricsAsync(string executionId, CancellationToken ct = default);
}
