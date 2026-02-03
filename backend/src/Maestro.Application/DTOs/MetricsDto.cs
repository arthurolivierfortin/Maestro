using Maestro.Domain.ValueObjects;

namespace Maestro.Application.DTOs;

/// <summary>
/// DTO for block execution metrics.
/// </summary>
public class BlockMetricsDto
{
    public string BlockId { get; set; } = string.Empty;
    public string BlockType { get; set; } = string.Empty;
    public string ExecutionId { get; set; } = string.Empty;
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public long DurationMs { get; set; }
    public long QueueTimeMs { get; set; }
    public long InputSizeBytes { get; set; }
    public long OutputSizeBytes { get; set; }
    public int? InputTokens { get; set; }
    public int? OutputTokens { get; set; }
    public decimal ComputeCostUsd { get; set; }
    public bool Success { get; set; }
    public int RetryCount { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ModelId { get; set; }
    public string? ModelProvider { get; set; }

    public static BlockMetricsDto FromDomain(BlockMetrics metrics)
    {
        return new BlockMetricsDto
        {
            BlockId = metrics.BlockId,
            BlockType = metrics.BlockType,
            ExecutionId = metrics.ExecutionId,
            StartedAt = metrics.StartedAt,
            CompletedAt = metrics.CompletedAt,
            DurationMs = metrics.DurationMs,
            QueueTimeMs = metrics.QueueTimeMs,
            InputSizeBytes = metrics.InputSizeBytes,
            OutputSizeBytes = metrics.OutputSizeBytes,
            InputTokens = metrics.InputTokens,
            OutputTokens = metrics.OutputTokens,
            ComputeCostUsd = metrics.ComputeCostUsd,
            Success = metrics.Success,
            RetryCount = metrics.RetryCount,
            ErrorCode = metrics.ErrorCode,
            ErrorMessage = metrics.ErrorMessage,
            ModelId = metrics.ModelId,
            ModelProvider = metrics.ModelProvider
        };
    }
}

/// <summary>
/// DTO for model usage metrics.
/// </summary>
public class ModelUsageMetricsDto
{
    public string Id { get; set; } = string.Empty;
    public string ModelId { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public string ExecutionId { get; set; } = string.Empty;
    public string BlockId { get; set; } = string.Empty;
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public int TotalTokens { get; set; }
    public long LatencyMs { get; set; }
    public long? TimeToFirstTokenMs { get; set; }
    public double? TokensPerSecond { get; set; }
    public decimal InputCostUsd { get; set; }
    public decimal OutputCostUsd { get; set; }
    public decimal TotalCostUsd { get; set; }
    public int? QualityScore { get; set; }
    public string? EvaluationMethod { get; set; }
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTimeOffset Timestamp { get; set; }

    public static ModelUsageMetricsDto FromDomain(ModelUsageMetrics metrics)
    {
        return new ModelUsageMetricsDto
        {
            Id = metrics.Id,
            ModelId = metrics.ModelId,
            Provider = metrics.Provider,
            ExecutionId = metrics.ExecutionId,
            BlockId = metrics.BlockId,
            PromptTokens = metrics.PromptTokens,
            CompletionTokens = metrics.CompletionTokens,
            TotalTokens = metrics.TotalTokens,
            LatencyMs = metrics.LatencyMs,
            TimeToFirstTokenMs = metrics.TimeToFirstTokenMs,
            TokensPerSecond = metrics.TokensPerSecond,
            InputCostUsd = metrics.InputCostUsd,
            OutputCostUsd = metrics.OutputCostUsd,
            TotalCostUsd = metrics.TotalCostUsd,
            QualityScore = metrics.QualityScore,
            EvaluationMethod = metrics.EvaluationMethod,
            Success = metrics.Success,
            ErrorMessage = metrics.ErrorMessage,
            Timestamp = metrics.Timestamp
        };
    }
}

/// <summary>
/// DTO for workflow execution metrics.
/// </summary>
public class WorkflowExecutionMetricsDto
{
    public string ExecutionId { get; set; } = string.Empty;
    public string WorkflowId { get; set; } = string.Empty;
    public string? TrainingRunId { get; set; }
    public int? IterationNumber { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public long TotalDurationMs { get; set; }
    public long BlockExecutionTimeMs { get; set; }
    public long OverheadTimeMs { get; set; }
    public decimal TotalCostUsd { get; set; }
    public Dictionary<string, decimal> CostByModel { get; set; } = new();
    public Dictionary<string, decimal> CostByBlockType { get; set; } = new();
    public int TotalInputTokens { get; set; }
    public int TotalOutputTokens { get; set; }
    public Dictionary<string, TokenUsageDto> TokensByModel { get; set; } = new();
    public int BlocksTotal { get; set; }
    public int BlocksSucceeded { get; set; }
    public int BlocksFailed { get; set; }
    public int BlocksSkipped { get; set; }
    public int TotalRetries { get; set; }
    public QualityScoreDto? Quality { get; set; }
    public List<BlockMetricsDto> BlockMetrics { get; set; } = new();
    public List<ModelUsageMetricsDto> ModelMetrics { get; set; } = new();
    public string Status { get; set; } = string.Empty;
    public string? ErrorMessage { get; set; }

    public static WorkflowExecutionMetricsDto FromDomain(WorkflowExecutionMetrics metrics)
    {
        return new WorkflowExecutionMetricsDto
        {
            ExecutionId = metrics.ExecutionId,
            WorkflowId = metrics.WorkflowId,
            TrainingRunId = metrics.TrainingRunId,
            IterationNumber = metrics.IterationNumber,
            StartedAt = metrics.StartedAt,
            CompletedAt = metrics.CompletedAt,
            TotalDurationMs = metrics.TotalDurationMs,
            BlockExecutionTimeMs = metrics.BlockExecutionTimeMs,
            OverheadTimeMs = metrics.OverheadTimeMs,
            TotalCostUsd = metrics.TotalCostUsd,
            CostByModel = metrics.CostByModel.ToDictionary(k => k.Key, v => v.Value),
            CostByBlockType = metrics.CostByBlockType.ToDictionary(k => k.Key, v => v.Value),
            TotalInputTokens = metrics.TotalInputTokens,
            TotalOutputTokens = metrics.TotalOutputTokens,
            TokensByModel = metrics.TokensByModel.ToDictionary(
                k => k.Key,
                v => new TokenUsageDto { Input = v.Value.Input, Output = v.Value.Output }),
            BlocksTotal = metrics.BlocksTotal,
            BlocksSucceeded = metrics.BlocksSucceeded,
            BlocksFailed = metrics.BlocksFailed,
            BlocksSkipped = metrics.BlocksSkipped,
            TotalRetries = metrics.TotalRetries,
            Quality = metrics.Quality != null ? QualityScoreDto.FromDomain(metrics.Quality) : null,
            BlockMetrics = metrics.BlockMetrics.Select(BlockMetricsDto.FromDomain).ToList(),
            ModelMetrics = metrics.ModelMetrics.Select(ModelUsageMetricsDto.FromDomain).ToList(),
            Status = metrics.Status,
            ErrorMessage = metrics.ErrorMessage
        };
    }

    public WorkflowExecutionMetrics ToDomain()
    {
        return new WorkflowExecutionMetrics
        {
            ExecutionId = ExecutionId,
            WorkflowId = WorkflowId,
            TrainingRunId = TrainingRunId,
            IterationNumber = IterationNumber,
            StartedAt = StartedAt,
            CompletedAt = CompletedAt,
            TotalDurationMs = TotalDurationMs,
            BlockExecutionTimeMs = BlockExecutionTimeMs,
            TotalCostUsd = TotalCostUsd,
            CostByModel = CostByModel.ToDictionary(k => k.Key, v => v.Value),
            CostByBlockType = CostByBlockType.ToDictionary(k => k.Key, v => v.Value),
            TotalInputTokens = TotalInputTokens,
            TotalOutputTokens = TotalOutputTokens,
            TokensByModel = TokensByModel.ToDictionary(
                k => k.Key,
                v => new TokenUsage { Input = v.Value.Input, Output = v.Value.Output }),
            BlocksTotal = BlocksTotal,
            BlocksSucceeded = BlocksSucceeded,
            BlocksFailed = BlocksFailed,
            BlocksSkipped = BlocksSkipped,
            TotalRetries = TotalRetries,
            Quality = Quality?.ToDomain(),
            Status = Status,
            ErrorMessage = ErrorMessage
        };
    }
}

/// <summary>
/// DTO for token usage.
/// </summary>
public class TokenUsageDto
{
    public int Input { get; set; }
    public int Output { get; set; }
    public int Total => Input + Output;
}

/// <summary>
/// DTO for quality score.
/// </summary>
public class QualityScoreDto
{
    public int Score { get; set; }
    public string Method { get; set; } = string.Empty;
    public List<QualityCriterionDto> Criteria { get; set; } = new();
    public string? Explanation { get; set; }
    public DateTimeOffset EvaluatedAt { get; set; }
    public string? EvaluatorModelId { get; set; }
    public double Confidence { get; set; }

    public static QualityScoreDto FromDomain(QualityScore score)
    {
        return new QualityScoreDto
        {
            Score = score.Score,
            Method = score.Method.ToString(),
            Criteria = score.Criteria.Select(c => new QualityCriterionDto
            {
                Name = c.Name,
                Score = c.Score,
                Weight = c.Weight,
                Passed = c.Passed,
                Description = c.Description
            }).ToList(),
            Explanation = score.Explanation,
            EvaluatedAt = score.EvaluatedAt,
            EvaluatorModelId = score.EvaluatorModelId,
            Confidence = score.Confidence
        };
    }

    public QualityScore ToDomain()
    {
        var method = Enum.TryParse<QualityEvaluationMethod>(Method, true, out var m)
            ? m : QualityEvaluationMethod.None;

        return new QualityScore
        {
            Score = Score,
            Method = method,
            Criteria = Criteria.Select(c => new QualityCriterion
            {
                Name = c.Name,
                Score = c.Score,
                Weight = c.Weight,
                Passed = c.Passed,
                Description = c.Description
            }).ToList(),
            Explanation = Explanation,
            EvaluatedAt = EvaluatedAt,
            EvaluatorModelId = EvaluatorModelId,
            Confidence = Confidence
        };
    }
}

/// <summary>
/// DTO for quality criterion.
/// </summary>
public class QualityCriterionDto
{
    public string Name { get; set; } = string.Empty;
    public int Score { get; set; }
    public double Weight { get; set; }
    public bool? Passed { get; set; }
    public string? Description { get; set; }
}

/// <summary>
/// Request for aggregating metrics.
/// </summary>
public class MetricsAggregationRequest
{
    public string? WorkflowId { get; set; }
    public string? TrainingRunId { get; set; }
    public DateTimeOffset? StartDate { get; set; }
    public DateTimeOffset? EndDate { get; set; }
    public string? GroupBy { get; set; } // "model", "blockType", "day", "hour"
    public int? Limit { get; set; }
}

/// <summary>
/// Aggregated metrics result.
/// </summary>
public class AggregatedMetricsDto
{
    public int TotalExecutions { get; set; }
    public long AverageDurationMs { get; set; }
    public decimal TotalCostUsd { get; set; }
    public decimal AverageCostUsd { get; set; }
    public int TotalTokens { get; set; }
    public double AverageQualityScore { get; set; }
    public double SuccessRate { get; set; }
    public Dictionary<string, decimal> CostByModel { get; set; } = new();
    public Dictionary<string, int> ExecutionsByStatus { get; set; } = new();
    public List<MetricsTrendPoint> DurationTrend { get; set; } = new();
    public List<MetricsTrendPoint> CostTrend { get; set; } = new();
}

/// <summary>
/// A point in a metrics trend.
/// </summary>
public class MetricsTrendPoint
{
    public DateTimeOffset Timestamp { get; set; }
    public double Value { get; set; }
}
