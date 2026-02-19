using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a test run for any block type (tool, agent, workflow, task) with detailed
/// output tracking and evaluation support. Supports iterative improvement workflows.
/// </summary>
public class BlockTestRun
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// The block being tested (tool, agent, workflow, or task).
    /// </summary>
    public string BlockId { get; set; } = string.Empty;

    /// <summary>
    /// Type of block: "tool", "agent", "workflow", or "task".
    /// </summary>
    public string BlockType { get; set; } = string.Empty;

    /// <summary>
    /// Version/variant identifier for A/B testing different approaches.
    /// </summary>
    public string VariantId { get; set; } = "default";

    /// <summary>
    /// Description of the approach/variant being tested.
    /// </summary>
    public string? VariantDescription { get; set; }

    public BlockTestRunStatus Status { get; set; } = BlockTestRunStatus.Pending;

    public int TotalIterations { get; set; }
    public int CompletedIterations { get; set; }
    public int EvaluatedIterations { get; set; }

    /// <summary>
    /// Who/what is evaluating: "claude-code", "llm-provider", "manual", "custom-agent".
    /// </summary>
    public string EvaluatorType { get; set; } = "manual";

    /// <summary>
    /// Model ID if using LLM evaluator.
    /// </summary>
    public string? EvaluatorModelId { get; set; }

    /// <summary>
    /// Evaluation criteria from the block's testConfig.
    /// </summary>
    public List<EvaluationCriterion> Criteria { get; set; } = new();

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>
    /// Individual test iterations with outputs and evaluations.
    /// </summary>
    public List<BlockTestIteration> Iterations { get; set; } = new();

    /// <summary>
    /// Aggregated scores after evaluation.
    /// </summary>
    public BlockTestRunMetrics? Metrics { get; set; }

    /// <summary>
    /// Improvement suggestions from evaluator.
    /// </summary>
    public List<string> ImprovementSuggestions { get; set; } = new();

    public List<string> Tags { get; set; } = new();

    public void Start()
    {
        Status = BlockTestRunStatus.Running;
        StartedAt = DateTimeOffset.UtcNow;
    }

    public void RecordIteration(BlockTestIteration iteration)
    {
        Iterations.Add(iteration);
        CompletedIterations++;

        if (iteration.Evaluation != null)
            EvaluatedIterations++;
    }

    public void SubmitEvaluation(string iterationId, QualityScore evaluation)
    {
        var iteration = Iterations.FirstOrDefault(i => i.Id == iterationId);
        if (iteration != null)
        {
            iteration.Evaluation = evaluation;
            iteration.EvaluatedAt = DateTimeOffset.UtcNow;
            EvaluatedIterations = Iterations.Count(i => i.Evaluation != null);
        }
    }

    public void Complete()
    {
        Status = BlockTestRunStatus.Completed;
        CompletedAt = DateTimeOffset.UtcNow;
        Metrics = ComputeMetrics();
    }

    public void AwaitEvaluation()
    {
        Status = BlockTestRunStatus.AwaitingEvaluation;
    }

    private BlockTestRunMetrics ComputeMetrics()
    {
        var evaluatedIterations = Iterations.Where(i => i.Evaluation != null).ToList();

        if (!evaluatedIterations.Any())
        {
            return new BlockTestRunMetrics { OverallScore = 0 };
        }

        var scores = evaluatedIterations.Select(i => i.Evaluation!.Score).ToList();

        // Compute per-criterion averages
        var criterionScores = new Dictionary<string, double>();
        foreach (var criterion in Criteria)
        {
            var criterionEvals = evaluatedIterations
                .Where(i => i.Evaluation?.Criteria != null)
                .SelectMany(i => i.Evaluation!.Criteria)
                .Where(c => c.Name == criterion.Name)
                .Select(c => c.Score)
                .ToList();

            if (criterionEvals.Any())
                criterionScores[criterion.Name] = criterionEvals.Average();
        }

        return new BlockTestRunMetrics
        {
            OverallScore = (int)scores.Average(),
            MinScore = scores.Min(),
            MaxScore = scores.Max(),
            ScoreVariance = scores.Count > 1 ? ComputeVariance(scores) : 0,
            CriterionAverages = criterionScores,
            EvaluatedCount = evaluatedIterations.Count,
            TotalCount = Iterations.Count
        };
    }

    private static double ComputeVariance(List<int> values)
    {
        if (values.Count < 2) return 0;
        var avg = values.Average();
        return values.Sum(v => Math.Pow(v - avg, 2)) / (values.Count - 1);
    }
}

public enum BlockTestRunStatus
{
    Pending,
    Running,
    AwaitingEvaluation,
    Completed,
    Failed,
    Cancelled
}

/// <summary>
/// A single test iteration with full output capture.
/// </summary>
public class BlockTestIteration
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public int IterationNumber { get; set; }

    /// <summary>
    /// Input parameters used for this iteration.
    /// </summary>
    public Dictionary<string, object> Inputs { get; set; } = new();

    /// <summary>
    /// Full output from the block execution.
    /// </summary>
    public Dictionary<string, object?> Outputs { get; set; } = new();

    /// <summary>
    /// The main output content (for easy access).
    /// </summary>
    public string? OutputContent { get; set; }

    /// <summary>
    /// Execution logs.
    /// </summary>
    public List<string> Logs { get; set; } = new();

    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }

    public long DurationMs { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>
    /// Quality evaluation for this iteration (submitted by evaluator).
    /// </summary>
    public QualityScore? Evaluation { get; set; }

    public DateTimeOffset? EvaluatedAt { get; set; }
}

/// <summary>
/// Aggregated metrics for a test run.
/// </summary>
public record BlockTestRunMetrics
{
    public int OverallScore { get; init; }
    public int MinScore { get; init; }
    public int MaxScore { get; init; }
    public double ScoreVariance { get; init; }
    public Dictionary<string, double> CriterionAverages { get; init; } = new();
    public int EvaluatedCount { get; init; }
    public int TotalCount { get; init; }
}

/// <summary>
/// Evaluation criterion definition for block tests.
/// </summary>
public record EvaluationCriterion
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public double Weight { get; init; } = 1.0;
}
