namespace Maestro.Domain.Configuration;

/// <summary>
/// Configuration for a Foundry session.
/// </summary>
public class FoundrySessionConfig
{
    /// <summary>
    /// The draft ID to work on (optional - can load later).
    /// </summary>
    public string? DraftId { get; set; }

    /// <summary>
    /// Configuration for training runs.
    /// </summary>
    public TrainingRunConfig Training { get; set; } = TrainingRunConfig.Default;

    /// <summary>
    /// Configuration for evaluation.
    /// </summary>
    public EvaluationConfig Evaluation { get; set; } = EvaluationConfig.Default;

    /// <summary>
    /// Default configuration.
    /// </summary>
    public static FoundrySessionConfig Default => new();
}

/// <summary>
/// Configuration for a training run within a Foundry session.
/// </summary>
public class TrainingRunConfig
{
    /// <summary>
    /// Number of iterations to run.
    /// </summary>
    public int Iterations { get; set; } = 10;

    /// <summary>
    /// Number of parallel executions.
    /// </summary>
    public int Parallel { get; set; } = 1;

    /// <summary>
    /// Delay between iterations in milliseconds.
    /// </summary>
    public int DelayMs { get; set; } = 0;

    /// <summary>
    /// Timeout for each iteration in milliseconds.
    /// </summary>
    public int TimeoutMs { get; set; } = 60000;

    /// <summary>
    /// Test inputs for the training.
    /// </summary>
    public IList<IDictionary<string, object>> Inputs { get; set; } = new List<IDictionary<string, object>>();

    /// <summary>
    /// Tags for categorizing this training run.
    /// </summary>
    public IList<string> Tags { get; set; } = new List<string>();

    /// <summary>
    /// Default configuration.
    /// </summary>
    public static TrainingRunConfig Default => new();
}

/// <summary>
/// Configuration for evaluation of training iterations.
/// </summary>
public class EvaluationConfig
{
    /// <summary>
    /// Evaluation mode.
    /// </summary>
    public EvaluationMode Mode { get; set; } = EvaluationMode.Manual;

    /// <summary>
    /// Auto-evaluator configuration (for Auto or Hybrid mode).
    /// </summary>
    public AutoEvaluatorConfig? AutoEvaluator { get; set; }

    /// <summary>
    /// Evaluation criteria.
    /// </summary>
    public IList<string> Criteria { get; set; } = new List<string>
    {
        "Correctness",
        "Quality",
        "Efficiency"
    };

    /// <summary>
    /// Minimum score to pass (0.0 - 1.0).
    /// </summary>
    public double PassThreshold { get; set; } = 0.7;

    /// <summary>
    /// Score threshold that triggers human review in Hybrid mode.
    /// </summary>
    public double HumanReviewThreshold { get; set; } = 0.5;

    /// <summary>
    /// Default configuration.
    /// </summary>
    public static EvaluationConfig Default => new();
}

/// <summary>
/// Evaluation mode for training iterations.
/// </summary>
public enum EvaluationMode
{
    /// <summary>
    /// All iterations require manual evaluation.
    /// </summary>
    Manual,

    /// <summary>
    /// All iterations are evaluated automatically.
    /// </summary>
    Auto,

    /// <summary>
    /// Auto-evaluate first, flag low scores for human review.
    /// </summary>
    Hybrid
}

/// <summary>
/// Configuration for automatic evaluation.
/// </summary>
public class AutoEvaluatorConfig
{
    /// <summary>
    /// Type of evaluator.
    /// </summary>
    public EvaluatorType Type { get; set; } = EvaluatorType.LLM;

    /// <summary>
    /// Model ID for LLM evaluator.
    /// </summary>
    public string? ModelId { get; set; }

    /// <summary>
    /// Agent ID for agent evaluator.
    /// </summary>
    public string? AgentId { get; set; }

    /// <summary>
    /// Custom evaluation prompt.
    /// </summary>
    public string? EvaluationPrompt { get; set; }

    /// <summary>
    /// Heuristic rules for heuristic evaluator.
    /// </summary>
    public IList<HeuristicRule>? HeuristicRules { get; set; }
}

/// <summary>
/// Type of auto-evaluator.
/// </summary>
public enum EvaluatorType
{
    /// <summary>
    /// LLM-based evaluation.
    /// </summary>
    LLM,

    /// <summary>
    /// Agent-based evaluation.
    /// </summary>
    Agent,

    /// <summary>
    /// Rule-based heuristic evaluation.
    /// </summary>
    Heuristic
}

/// <summary>
/// A heuristic rule for evaluation.
/// </summary>
public class HeuristicRule
{
    /// <summary>
    /// Name of the rule.
    /// </summary>
    public required string Name { get; set; }

    /// <summary>
    /// Type of check: contains, matches, length, etc.
    /// </summary>
    public required string CheckType { get; set; }

    /// <summary>
    /// Value to check against.
    /// </summary>
    public required string Value { get; set; }

    /// <summary>
    /// Weight of this rule in the overall score (0.0 - 1.0).
    /// </summary>
    public double Weight { get; set; } = 1.0;
}
