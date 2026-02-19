namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Represents a quality assessment of an execution output.
/// </summary>
public record QualityScore
{
    /// <summary>
    /// The overall quality score (0-100).
    /// </summary>
    public int Score { get; init; }

    /// <summary>
    /// How the quality was evaluated.
    /// </summary>
    public QualityEvaluationMethod Method { get; init; }

    /// <summary>
    /// Detailed breakdown of quality criteria.
    /// </summary>
    public IReadOnlyList<QualityCriterion> Criteria { get; init; } = Array.Empty<QualityCriterion>();

    /// <summary>
    /// Human-readable explanation of the score.
    /// </summary>
    public string? Explanation { get; init; }

    /// <summary>
    /// When the evaluation was performed.
    /// </summary>
    public DateTimeOffset EvaluatedAt { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Model used for LLM-based evaluation (if applicable).
    /// </summary>
    public string? EvaluatorModelId { get; init; }

    /// <summary>
    /// Confidence in the score (0-1).
    /// </summary>
    public double Confidence { get; init; } = 1.0;

    /// <summary>
    /// Create a quality score from heuristic evaluation.
    /// </summary>
    public static QualityScore FromHeuristic(int score, IEnumerable<QualityCriterion> criteria, string? explanation = null)
    {
        return new QualityScore
        {
            Score = Math.Clamp(score, 0, 100),
            Method = QualityEvaluationMethod.Heuristic,
            Criteria = criteria.ToList(),
            Explanation = explanation,
            Confidence = 0.7 // Heuristics have moderate confidence
        };
    }

    /// <summary>
    /// Create a quality score from LLM evaluation.
    /// </summary>
    public static QualityScore FromLLM(int score, string modelId, string explanation, double confidence = 0.8)
    {
        return new QualityScore
        {
            Score = Math.Clamp(score, 0, 100),
            Method = QualityEvaluationMethod.LLM,
            EvaluatorModelId = modelId,
            Explanation = explanation,
            Confidence = confidence
        };
    }

    /// <summary>
    /// Create a quality score from human evaluation.
    /// </summary>
    public static QualityScore FromHuman(int score, string? explanation = null)
    {
        return new QualityScore
        {
            Score = Math.Clamp(score, 0, 100),
            Method = QualityEvaluationMethod.Human,
            Explanation = explanation,
            Confidence = 1.0 // Human evaluation has highest confidence
        };
    }

    /// <summary>
    /// Create a quality score from automated tests.
    /// </summary>
    public static QualityScore FromAutomated(int score, IEnumerable<QualityCriterion> criteria)
    {
        return new QualityScore
        {
            Score = Math.Clamp(score, 0, 100),
            Method = QualityEvaluationMethod.Automated,
            Criteria = criteria.ToList(),
            Confidence = 0.9 // Automated tests have high confidence
        };
    }
}

/// <summary>
/// Method used to evaluate quality.
/// </summary>
public enum QualityEvaluationMethod
{
    /// <summary>
    /// No evaluation performed.
    /// </summary>
    None,

    /// <summary>
    /// Rule-based heuristic evaluation.
    /// </summary>
    Heuristic,

    /// <summary>
    /// LLM-based evaluation.
    /// </summary>
    LLM,

    /// <summary>
    /// Human evaluation.
    /// </summary>
    Human,

    /// <summary>
    /// Automated test-based evaluation.
    /// </summary>
    Automated,

    /// <summary>
    /// Custom script-based evaluation.
    /// </summary>
    Custom
}

/// <summary>
/// A single quality criterion and its score.
/// </summary>
public record QualityCriterion
{
    /// <summary>
    /// Name of the criterion.
    /// </summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>
    /// Score for this criterion (0-100).
    /// </summary>
    public int Score { get; init; }

    /// <summary>
    /// Weight of this criterion in the overall score (0-1).
    /// </summary>
    public double Weight { get; init; } = 1.0;

    /// <summary>
    /// Whether this criterion passed (for boolean criteria).
    /// </summary>
    public bool? Passed { get; init; }

    /// <summary>
    /// Description or explanation for this criterion.
    /// </summary>
    public string? Description { get; init; }
}
