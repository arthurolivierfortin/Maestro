using System.Collections.Concurrent;
using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Metrics;

/// <summary>
/// In-memory metrics collector for workflow execution.
/// Collects metrics during execution and aggregates them at the end.
/// </summary>
public class MetricsCollector : IMetricsCollector
{
    private readonly ILogger<MetricsCollector>? _logger;
    private readonly IMetricsRepository _repository;

    // In-flight executions
    private readonly ConcurrentDictionary<string, ExecutionTracker> _executions = new();

    public MetricsCollector(IMetricsRepository repository, ILogger<MetricsCollector>? logger = null)
    {
        _repository = repository;
        _logger = logger;
    }

    public Task BeginExecutionAsync(string executionId, string workflowId, CancellationToken ct = default)
    {
        var tracker = new ExecutionTracker
        {
            ExecutionId = executionId,
            WorkflowId = workflowId,
            StartedAt = DateTimeOffset.UtcNow
        };

        if (!_executions.TryAdd(executionId, tracker))
        {
            _logger?.LogWarning("Execution {ExecutionId} already being tracked", executionId);
        }

        _logger?.LogDebug("Started tracking execution {ExecutionId} for workflow {WorkflowId}",
            executionId, workflowId);

        return Task.CompletedTask;
    }

    public Task RecordBlockMetricsAsync(BlockMetrics metrics, CancellationToken ct = default)
    {
        if (_executions.TryGetValue(metrics.ExecutionId, out var tracker))
        {
            tracker.BlockMetrics.Add(metrics);
            _logger?.LogDebug("Recorded block metrics for {BlockId} in execution {ExecutionId}",
                metrics.BlockId, metrics.ExecutionId);
        }
        else
        {
            _logger?.LogWarning("Cannot record block metrics - execution {ExecutionId} not being tracked",
                metrics.ExecutionId);
        }

        return Task.CompletedTask;
    }

    public Task RecordModelUsageAsync(ModelUsageMetrics metrics, CancellationToken ct = default)
    {
        if (_executions.TryGetValue(metrics.ExecutionId, out var tracker))
        {
            tracker.ModelMetrics.Add(metrics);
            _logger?.LogDebug("Recorded model usage for {ModelId} in execution {ExecutionId}",
                metrics.ModelId, metrics.ExecutionId);
        }
        else
        {
            _logger?.LogWarning("Cannot record model usage - execution {ExecutionId} not being tracked",
                metrics.ExecutionId);
        }

        return Task.CompletedTask;
    }

    public async Task<WorkflowExecutionMetrics> CompleteExecutionAsync(
        string executionId,
        string status,
        string? errorMessage = null,
        QualityScore? quality = null,
        CancellationToken ct = default)
    {
        if (!_executions.TryRemove(executionId, out var tracker))
        {
            _logger?.LogWarning("Cannot complete - execution {ExecutionId} not being tracked", executionId);

            // Return empty metrics
            return new WorkflowExecutionMetrics
            {
                ExecutionId = executionId,
                Status = status,
                ErrorMessage = errorMessage
            };
        }

        var completedAt = DateTimeOffset.UtcNow;

        var metrics = WorkflowExecutionMetrics.Aggregate(
            executionId: executionId,
            workflowId: tracker.WorkflowId,
            startedAt: tracker.StartedAt,
            completedAt: completedAt,
            blockMetrics: tracker.BlockMetrics,
            modelMetrics: tracker.ModelMetrics,
            status: status,
            errorMessage: errorMessage,
            trainingRunId: tracker.TrainingRunId,
            iterationNumber: tracker.IterationNumber,
            quality: quality);

        // Persist metrics
        await _repository.SaveAsync(metrics, ct);

        _logger?.LogInformation(
            "Completed execution {ExecutionId}: Duration={Duration}ms, Cost=${Cost}, Blocks={BlocksSucceeded}/{BlocksTotal}",
            executionId, metrics.TotalDurationMs, metrics.TotalCostUsd, metrics.BlocksSucceeded, metrics.BlocksTotal);

        return metrics;
    }

    public Task<BlockMetrics?> GetBlockMetricsAsync(string executionId, string blockId, CancellationToken ct = default)
    {
        if (_executions.TryGetValue(executionId, out var tracker))
        {
            var metrics = tracker.BlockMetrics.FirstOrDefault(m => m.BlockId == blockId);
            return Task.FromResult(metrics);
        }

        return Task.FromResult<BlockMetrics?>(null);
    }

    public Task<IReadOnlyList<BlockMetrics>> GetAllBlockMetricsAsync(string executionId, CancellationToken ct = default)
    {
        if (_executions.TryGetValue(executionId, out var tracker))
        {
            return Task.FromResult<IReadOnlyList<BlockMetrics>>(tracker.BlockMetrics.ToList());
        }

        return Task.FromResult<IReadOnlyList<BlockMetrics>>(Array.Empty<BlockMetrics>());
    }

    public Task<IReadOnlyList<ModelUsageMetrics>> GetAllModelMetricsAsync(string executionId, CancellationToken ct = default)
    {
        if (_executions.TryGetValue(executionId, out var tracker))
        {
            return Task.FromResult<IReadOnlyList<ModelUsageMetrics>>(tracker.ModelMetrics.ToList());
        }

        return Task.FromResult<IReadOnlyList<ModelUsageMetrics>>(Array.Empty<ModelUsageMetrics>());
    }

    /// <summary>
    /// Set training run context for an execution.
    /// </summary>
    public void SetTrainingContext(string executionId, string trainingRunId, int iterationNumber)
    {
        if (_executions.TryGetValue(executionId, out var tracker))
        {
            tracker.TrainingRunId = trainingRunId;
            tracker.IterationNumber = iterationNumber;
        }
    }

    /// <summary>
    /// Internal tracker for in-flight execution.
    /// </summary>
    private class ExecutionTracker
    {
        public string ExecutionId { get; set; } = string.Empty;
        public string WorkflowId { get; set; } = string.Empty;
        public DateTimeOffset StartedAt { get; set; }
        public string? TrainingRunId { get; set; }
        public int? IterationNumber { get; set; }
        public ConcurrentBag<BlockMetrics> BlockMetrics { get; } = new();
        public ConcurrentBag<ModelUsageMetrics> ModelMetrics { get; } = new();
    }
}
