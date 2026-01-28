using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a training run - a session of multiple workflow executions for optimization.
/// </summary>
public class TrainingRun
{
    /// <summary>
    /// Unique identifier for this training run.
    /// </summary>
    public string Id { get; set; } = Guid.NewGuid().ToString();

    /// <summary>
    /// Human-readable name for this run.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// The workflow being trained.
    /// </summary>
    public string WorkflowId { get; set; } = string.Empty;

    /// <summary>
    /// Reference to the training configuration.
    /// </summary>
    public string ConfigurationId { get; set; } = string.Empty;

    /// <summary>
    /// Current status of the training run.
    /// </summary>
    public TrainingRunStatus Status { get; set; } = TrainingRunStatus.Pending;

    /// <summary>
    /// Total number of iterations configured.
    /// </summary>
    public int TotalIterations { get; set; }

    /// <summary>
    /// Number of iterations completed.
    /// </summary>
    public int CompletedIterations { get; set; }

    /// <summary>
    /// Number of iterations that failed.
    /// </summary>
    public int FailedIterations { get; set; }

    /// <summary>
    /// Maximum parallel iterations.
    /// </summary>
    public int ParallelIterations { get; set; } = 1;

    /// <summary>
    /// When the training run started.
    /// </summary>
    public DateTimeOffset? StartedAt { get; set; }

    /// <summary>
    /// When the training run completed.
    /// </summary>
    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>
    /// Aggregated metrics for all iterations.
    /// </summary>
    public TrainingRunMetrics? Metrics { get; set; }

    /// <summary>
    /// Individual iteration results.
    /// </summary>
    public List<TrainingIteration> Iterations { get; set; } = new();

    /// <summary>
    /// Error message if the run failed.
    /// </summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// Who initiated this training run.
    /// </summary>
    public string? InitiatedBy { get; set; }

    /// <summary>
    /// When this record was created.
    /// </summary>
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Tags for organization.
    /// </summary>
    public List<string> Tags { get; set; } = new();

    /// <summary>
    /// Start the training run.
    /// </summary>
    public void Start()
    {
        if (Status != TrainingRunStatus.Pending)
            throw new InvalidOperationException($"Cannot start training run in status {Status}");

        Status = TrainingRunStatus.Running;
        StartedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Pause the training run.
    /// </summary>
    public void Pause()
    {
        if (Status != TrainingRunStatus.Running)
            throw new InvalidOperationException($"Cannot pause training run in status {Status}");

        Status = TrainingRunStatus.Paused;
    }

    /// <summary>
    /// Resume a paused training run.
    /// </summary>
    public void Resume()
    {
        if (Status != TrainingRunStatus.Paused)
            throw new InvalidOperationException($"Cannot resume training run in status {Status}");

        Status = TrainingRunStatus.Running;
    }

    /// <summary>
    /// Cancel the training run.
    /// </summary>
    public void Cancel()
    {
        if (Status == TrainingRunStatus.Completed || Status == TrainingRunStatus.Cancelled)
            throw new InvalidOperationException($"Cannot cancel training run in status {Status}");

        Status = TrainingRunStatus.Cancelled;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Record a completed iteration.
    /// </summary>
    public void RecordIteration(TrainingIteration iteration)
    {
        Iterations.Add(iteration);

        if (iteration.Success)
            CompletedIterations++;
        else
            FailedIterations++;

        // Check if training is complete
        if (CompletedIterations + FailedIterations >= TotalIterations)
        {
            Complete();
        }
    }

    /// <summary>
    /// Mark the training run as complete and compute final metrics.
    /// </summary>
    public void Complete()
    {
        Status = TrainingRunStatus.Completed;
        CompletedAt = DateTimeOffset.UtcNow;
        Metrics = ComputeMetrics();
    }

    /// <summary>
    /// Mark the training run as failed.
    /// </summary>
    public void Fail(string errorMessage)
    {
        Status = TrainingRunStatus.Failed;
        CompletedAt = DateTimeOffset.UtcNow;
        ErrorMessage = errorMessage;
        Metrics = ComputeMetrics();
    }

    /// <summary>
    /// Compute aggregated metrics from all iterations.
    /// </summary>
    private TrainingRunMetrics ComputeMetrics()
    {
        var successfulIterations = Iterations.Where(i => i.Success && i.Metrics != null).ToList();

        if (!successfulIterations.Any())
        {
            return new TrainingRunMetrics
            {
                TrainingRunId = Id,
                WorkflowId = WorkflowId,
                TotalIterations = TotalIterations,
                CompletedIterations = CompletedIterations,
                FailedIterations = FailedIterations,
                StartedAt = StartedAt ?? CreatedAt,
                CompletedAt = CompletedAt,
                Status = Status.ToString()
            };
        }

        var durations = successfulIterations.Select(i => i.Metrics!.TotalDurationMs).ToList();
        var costs = successfulIterations.Select(i => i.Metrics!.TotalCostUsd).ToList();
        var qualities = successfulIterations
            .Where(i => i.Metrics?.Quality != null)
            .Select(i => i.Metrics!.Quality!.Score)
            .ToList();

        return new TrainingRunMetrics
        {
            TrainingRunId = Id,
            WorkflowId = WorkflowId,
            TotalIterations = TotalIterations,
            CompletedIterations = CompletedIterations,
            FailedIterations = FailedIterations,
            AverageDurationMs = durations.Any() ? (long)durations.Average() : 0,
            DurationVarianceMs = durations.Count > 1 ? ComputeVariance(durations) : 0,
            MinDurationMs = durations.Any() ? durations.Min() : 0,
            MaxDurationMs = durations.Any() ? durations.Max() : 0,
            AverageCostUsd = costs.Any() ? costs.Average() : 0,
            TotalCostUsd = costs.Sum(),
            CostVarianceUsd = costs.Count > 1 ? (decimal)ComputeVariance(costs.Select(c => (double)c).ToList()) : 0,
            AverageQualityScore = qualities.Any() ? (int)qualities.Average() : null,
            QualityVariance = qualities.Count > 1 ? ComputeVariance(qualities.Select(q => (double)q).ToList()) : null,
            ConsistencyScore = ComputeConsistencyScore(durations, costs, qualities),
            StartedAt = StartedAt ?? CreatedAt,
            CompletedAt = CompletedAt,
            Status = Status.ToString()
        };
    }

    private static double ComputeVariance(List<double> values)
    {
        if (values.Count < 2) return 0;
        var avg = values.Average();
        return values.Sum(v => Math.Pow(v - avg, 2)) / (values.Count - 1);
    }

    private static double ComputeVariance(List<long> values)
    {
        return ComputeVariance(values.Select(v => (double)v).ToList());
    }

    private static int ComputeConsistencyScore(List<long> durations, List<decimal> costs, List<int> qualities)
    {
        // Consistency is inversely proportional to variance
        // Higher score = more consistent results
        if (!durations.Any()) return 0;

        var durationCv = durations.Count > 1
            ? Math.Sqrt(ComputeVariance(durations)) / durations.Average()
            : 0;
        var costCv = costs.Count > 1
            ? Math.Sqrt((double)ComputeVariance(costs.Select(c => (double)c).ToList())) / (double)costs.Average()
            : 0;
        var qualityCv = qualities.Count > 1
            ? Math.Sqrt(ComputeVariance(qualities.Select(q => (double)q).ToList())) / qualities.Average()
            : 0;

        // Average coefficient of variation, inverted and scaled to 0-100
        var avgCv = (durationCv + costCv + (qualities.Any() ? qualityCv : 0)) / (qualities.Any() ? 3 : 2);
        return Math.Max(0, Math.Min(100, (int)((1 - avgCv) * 100)));
    }
}

/// <summary>
/// Status of a training run.
/// </summary>
public enum TrainingRunStatus
{
    Pending,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled
}

/// <summary>
/// Represents a single iteration within a training run.
/// </summary>
public class TrainingIteration
{
    /// <summary>
    /// Iteration number (1-based).
    /// </summary>
    public int IterationNumber { get; set; }

    /// <summary>
    /// The execution ID for this iteration.
    /// </summary>
    public string ExecutionId { get; set; } = string.Empty;

    /// <summary>
    /// Whether the iteration succeeded.
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Error message if failed.
    /// </summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// Metrics for this iteration.
    /// </summary>
    public WorkflowExecutionMetrics? Metrics { get; set; }

    /// <summary>
    /// When the iteration started.
    /// </summary>
    public DateTimeOffset StartedAt { get; set; }

    /// <summary>
    /// When the iteration completed.
    /// </summary>
    public DateTimeOffset? CompletedAt { get; set; }
}

/// <summary>
/// Aggregated metrics for a training run.
/// </summary>
public record TrainingRunMetrics
{
    public string TrainingRunId { get; init; } = string.Empty;
    public string WorkflowId { get; init; } = string.Empty;
    public int TotalIterations { get; init; }
    public int CompletedIterations { get; init; }
    public int FailedIterations { get; init; }
    public long AverageDurationMs { get; init; }
    public double DurationVarianceMs { get; init; }
    public long MinDurationMs { get; init; }
    public long MaxDurationMs { get; init; }
    public decimal AverageCostUsd { get; init; }
    public decimal TotalCostUsd { get; init; }
    public decimal CostVarianceUsd { get; init; }
    public int? AverageQualityScore { get; init; }
    public double? QualityVariance { get; init; }
    public int ConsistencyScore { get; init; }
    public DateTimeOffset StartedAt { get; init; }
    public DateTimeOffset? CompletedAt { get; init; }
    public string Status { get; init; } = string.Empty;
}
