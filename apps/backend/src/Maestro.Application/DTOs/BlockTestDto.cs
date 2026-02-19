using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.DTOs;

/// <summary>
/// DTO for creating a new block test run.
/// </summary>
public class CreateBlockTestRunRequest
{
    public string BlockId { get; set; } = string.Empty;
    public string? Name { get; set; }
    public int Iterations { get; set; } = 5;
    public string? VariantId { get; set; }
    public string? VariantDescription { get; set; }
    public string EvaluatorType { get; set; } = "manual";
    public string? EvaluatorModelId { get; set; }
    public Dictionary<string, object>? InputOverrides { get; set; }
    public List<string>? Tags { get; set; }
}

/// <summary>
/// DTO for submitting an evaluation.
/// </summary>
public class SubmitBlockEvaluationRequest
{
    public string IterationId { get; set; } = string.Empty;
    public int OverallScore { get; set; }
    public string? Explanation { get; set; }
    public List<BlockCriterionEvaluationDto>? CriteriaScores { get; set; }
    public string EvaluatorType { get; set; } = "manual";
    public string? EvaluatorModelId { get; set; }
    public double Confidence { get; set; } = 1.0;
}

public class BlockCriterionEvaluationDto
{
    public string Name { get; set; } = string.Empty;
    public int Score { get; set; }
    public string? Comment { get; set; }
}

/// <summary>
/// DTO for bulk evaluation submission.
/// </summary>
public class SubmitBulkBlockEvaluationRequest
{
    public List<SubmitBlockEvaluationRequest> Evaluations { get; set; } = new();
}

/// <summary>
/// DTO for block test run response.
/// </summary>
public class BlockTestRunDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string BlockId { get; set; } = string.Empty;
    public string BlockType { get; set; } = string.Empty;
    public string VariantId { get; set; } = string.Empty;
    public string? VariantDescription { get; set; }
    public string Status { get; set; } = string.Empty;
    public int TotalIterations { get; set; }
    public int CompletedIterations { get; set; }
    public int EvaluatedIterations { get; set; }
    public string EvaluatorType { get; set; } = string.Empty;
    public string? EvaluatorModelId { get; set; }
    public List<BlockEvaluationCriterionDto> Criteria { get; set; } = new();
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public List<BlockTestIterationDto> Iterations { get; set; } = new();
    public BlockTestRunMetricsDto? Metrics { get; set; }
    public List<string> ImprovementSuggestions { get; set; } = new();
    public List<string> Tags { get; set; } = new();

    public static BlockTestRunDto FromDomain(BlockTestRun run, bool includeIterations = true)
    {
        return new BlockTestRunDto
        {
            Id = run.Id,
            Name = run.Name,
            BlockId = run.BlockId,
            BlockType = run.BlockType,
            VariantId = run.VariantId,
            VariantDescription = run.VariantDescription,
            Status = run.Status.ToString(),
            TotalIterations = run.TotalIterations,
            CompletedIterations = run.CompletedIterations,
            EvaluatedIterations = run.EvaluatedIterations,
            EvaluatorType = run.EvaluatorType,
            EvaluatorModelId = run.EvaluatorModelId,
            Criteria = run.Criteria.Select(c => new BlockEvaluationCriterionDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                Weight = c.Weight
            }).ToList(),
            CreatedAt = run.CreatedAt,
            StartedAt = run.StartedAt,
            CompletedAt = run.CompletedAt,
            Iterations = includeIterations
                ? run.Iterations.Select(BlockTestIterationDto.FromDomain).ToList()
                : new List<BlockTestIterationDto>(),
            Metrics = run.Metrics != null ? BlockTestRunMetricsDto.FromDomain(run.Metrics) : null,
            ImprovementSuggestions = run.ImprovementSuggestions,
            Tags = run.Tags
        };
    }
}

public class BlockEvaluationCriterionDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public double Weight { get; set; }
}

public class BlockTestIterationDto
{
    public string Id { get; set; } = string.Empty;
    public int IterationNumber { get; set; }
    public Dictionary<string, object> Inputs { get; set; } = new();
    public Dictionary<string, object?> Outputs { get; set; } = new();
    public string? OutputContent { get; set; }
    public List<string> Logs { get; set; } = new();
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public long DurationMs { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public QualityScoreDto? Evaluation { get; set; }
    public DateTimeOffset? EvaluatedAt { get; set; }

    public static BlockTestIterationDto FromDomain(BlockTestIteration iteration)
    {
        return new BlockTestIterationDto
        {
            Id = iteration.Id,
            IterationNumber = iteration.IterationNumber,
            Inputs = iteration.Inputs,
            Outputs = iteration.Outputs,
            OutputContent = iteration.OutputContent,
            Logs = iteration.Logs,
            Success = iteration.Success,
            ErrorMessage = iteration.ErrorMessage,
            DurationMs = iteration.DurationMs,
            StartedAt = iteration.StartedAt,
            CompletedAt = iteration.CompletedAt,
            Evaluation = iteration.Evaluation != null ? QualityScoreDto.FromDomain(iteration.Evaluation) : null,
            EvaluatedAt = iteration.EvaluatedAt
        };
    }
}

public class BlockTestRunMetricsDto
{
    public int OverallScore { get; set; }
    public int MinScore { get; set; }
    public int MaxScore { get; set; }
    public double ScoreVariance { get; set; }
    public Dictionary<string, double> CriterionAverages { get; set; } = new();
    public int EvaluatedCount { get; set; }
    public int TotalCount { get; set; }

    public static BlockTestRunMetricsDto FromDomain(BlockTestRunMetrics metrics)
    {
        return new BlockTestRunMetricsDto
        {
            OverallScore = metrics.OverallScore,
            MinScore = metrics.MinScore,
            MaxScore = metrics.MaxScore,
            ScoreVariance = metrics.ScoreVariance,
            CriterionAverages = metrics.CriterionAverages,
            EvaluatedCount = metrics.EvaluatedCount,
            TotalCount = metrics.TotalCount
        };
    }
}

/// <summary>
/// DTO for improvement submission.
/// </summary>
public class SubmitBlockImprovementRequest
{
    public string TestRunId { get; set; } = string.Empty;
    public List<string> Suggestions { get; set; } = new();
    public Dictionary<string, object>? ProposedChanges { get; set; }
    public bool ApplyChanges { get; set; } = false;
}

/// <summary>
/// DTO for comparing test runs.
/// </summary>
public class BlockTestRunComparisonDto
{
    public List<BlockTestRunDto> Runs { get; set; } = new();
    public string? BestRunId { get; set; }
    public int BestScore { get; set; }
    public Dictionary<string, double> ScoresByVariant { get; set; } = new();
}
