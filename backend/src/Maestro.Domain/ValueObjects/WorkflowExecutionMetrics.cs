namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Comprehensive metrics for a complete workflow execution.
/// </summary>
public record WorkflowExecutionMetrics
{
    /// <summary>
    /// The execution ID.
    /// </summary>
    public string ExecutionId { get; init; } = string.Empty;

    /// <summary>
    /// The workflow that was executed.
    /// </summary>
    public string WorkflowId { get; init; } = string.Empty;

    /// <summary>
    /// Training run ID if part of a training session.
    /// </summary>
    public string? TrainingRunId { get; init; }

    /// <summary>
    /// Iteration number within a training run.
    /// </summary>
    public int? IterationNumber { get; init; }

    /// <summary>
    /// When the execution started.
    /// </summary>
    public DateTimeOffset StartedAt { get; init; }

    /// <summary>
    /// When the execution completed.
    /// </summary>
    public DateTimeOffset? CompletedAt { get; init; }

    /// <summary>
    /// Total duration in milliseconds.
    /// </summary>
    public long TotalDurationMs { get; init; }

    /// <summary>
    /// Time spent executing blocks (excluding overhead).
    /// </summary>
    public long BlockExecutionTimeMs { get; init; }

    /// <summary>
    /// Overhead time (orchestration, data flow, etc.).
    /// </summary>
    public long OverheadTimeMs => TotalDurationMs - BlockExecutionTimeMs;

    /// <summary>
    /// Total cost in USD.
    /// </summary>
    public decimal TotalCostUsd { get; init; }

    /// <summary>
    /// Cost breakdown by model.
    /// </summary>
    public IReadOnlyDictionary<string, decimal> CostByModel { get; init; } = new Dictionary<string, decimal>();

    /// <summary>
    /// Cost breakdown by block type.
    /// </summary>
    public IReadOnlyDictionary<string, decimal> CostByBlockType { get; init; } = new Dictionary<string, decimal>();

    /// <summary>
    /// Total input tokens across all LLM calls.
    /// </summary>
    public int TotalInputTokens { get; init; }

    /// <summary>
    /// Total output tokens across all LLM calls.
    /// </summary>
    public int TotalOutputTokens { get; init; }

    /// <summary>
    /// Token usage breakdown by model.
    /// </summary>
    public IReadOnlyDictionary<string, TokenUsage> TokensByModel { get; init; } = new Dictionary<string, TokenUsage>();

    /// <summary>
    /// Total number of blocks in the workflow.
    /// </summary>
    public int BlocksTotal { get; init; }

    /// <summary>
    /// Number of blocks that succeeded.
    /// </summary>
    public int BlocksSucceeded { get; init; }

    /// <summary>
    /// Number of blocks that failed.
    /// </summary>
    public int BlocksFailed { get; init; }

    /// <summary>
    /// Number of blocks that were skipped.
    /// </summary>
    public int BlocksSkipped { get; init; }

    /// <summary>
    /// Total retry attempts across all blocks.
    /// </summary>
    public int TotalRetries { get; init; }

    /// <summary>
    /// Quality score if evaluated.
    /// </summary>
    public QualityScore? Quality { get; init; }

    /// <summary>
    /// Individual block metrics.
    /// </summary>
    public IReadOnlyList<BlockMetrics> BlockMetrics { get; init; } = Array.Empty<BlockMetrics>();

    /// <summary>
    /// Individual model usage metrics.
    /// </summary>
    public IReadOnlyList<ModelUsageMetrics> ModelMetrics { get; init; } = Array.Empty<ModelUsageMetrics>();

    /// <summary>
    /// Execution status (Running, Completed, Failed, Cancelled).
    /// </summary>
    public string Status { get; init; } = "Completed";

    /// <summary>
    /// Error message if failed.
    /// </summary>
    public string? ErrorMessage { get; init; }

    /// <summary>
    /// Create metrics from block and model metrics collections.
    /// </summary>
    public static WorkflowExecutionMetrics Aggregate(
        string executionId,
        string workflowId,
        DateTimeOffset startedAt,
        DateTimeOffset completedAt,
        IEnumerable<BlockMetrics> blockMetrics,
        IEnumerable<ModelUsageMetrics> modelMetrics,
        string status = "Completed",
        string? errorMessage = null,
        string? trainingRunId = null,
        int? iterationNumber = null,
        QualityScore? quality = null)
    {
        var blocks = blockMetrics.ToList();
        var models = modelMetrics.ToList();

        var costByModel = models
            .GroupBy(m => m.ModelId)
            .ToDictionary(g => g.Key, g => g.Sum(m => m.TotalCostUsd));

        var costByBlockType = blocks
            .GroupBy(b => b.BlockType)
            .ToDictionary(g => g.Key, g => g.Sum(b => b.ComputeCostUsd));

        var tokensByModel = models
            .GroupBy(m => m.ModelId)
            .ToDictionary(g => g.Key, g => new TokenUsage
            {
                Input = g.Sum(m => m.PromptTokens),
                Output = g.Sum(m => m.CompletionTokens)
            });

        return new WorkflowExecutionMetrics
        {
            ExecutionId = executionId,
            WorkflowId = workflowId,
            TrainingRunId = trainingRunId,
            IterationNumber = iterationNumber,
            StartedAt = startedAt,
            CompletedAt = completedAt,
            TotalDurationMs = (long)(completedAt - startedAt).TotalMilliseconds,
            BlockExecutionTimeMs = blocks.Sum(b => b.DurationMs),
            TotalCostUsd = blocks.Sum(b => b.ComputeCostUsd),
            CostByModel = costByModel,
            CostByBlockType = costByBlockType,
            TotalInputTokens = models.Sum(m => m.PromptTokens),
            TotalOutputTokens = models.Sum(m => m.CompletionTokens),
            TokensByModel = tokensByModel,
            BlocksTotal = blocks.Count,
            BlocksSucceeded = blocks.Count(b => b.Success),
            BlocksFailed = blocks.Count(b => !b.Success),
            BlocksSkipped = 0, // Will be computed by orchestrator
            TotalRetries = blocks.Sum(b => b.RetryCount),
            Quality = quality,
            BlockMetrics = blocks,
            ModelMetrics = models,
            Status = status,
            ErrorMessage = errorMessage
        };
    }
}

/// <summary>
/// Token usage for input and output.
/// </summary>
public record TokenUsage
{
    public int Input { get; init; }
    public int Output { get; init; }
    public int Total => Input + Output;
}
