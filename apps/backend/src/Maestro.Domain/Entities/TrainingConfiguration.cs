namespace Maestro.Domain.Entities;

/// <summary>
/// Configuration for a training run.
/// </summary>
public class TrainingConfiguration
{
    /// <summary>
    /// Unique identifier.
    /// </summary>
    public string Id { get; set; } = Guid.NewGuid().ToString();

    /// <summary>
    /// Human-readable name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Description of the training configuration.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// The workflow to train.
    /// </summary>
    public string WorkflowId { get; set; } = string.Empty;

    /// <summary>
    /// Number of iterations to run.
    /// </summary>
    public int Iterations { get; set; } = 10;

    /// <summary>
    /// Maximum concurrent iterations.
    /// </summary>
    public int ParallelIterations { get; set; } = 1;

    /// <summary>
    /// Delay between iterations in milliseconds.
    /// </summary>
    public int DelayBetweenIterationsMs { get; set; } = 0;

    /// <summary>
    /// Optimization goal.
    /// </summary>
    public OptimizationGoal OptimizationGoal { get; set; } = OptimizationGoal.Balanced;

    /// <summary>
    /// Weights for multi-objective optimization.
    /// </summary>
    public OptimizationWeights? GoalWeights { get; set; }

    /// <summary>
    /// Input variation configuration.
    /// </summary>
    public InputVariationConfig InputVariation { get; set; } = new();

    /// <summary>
    /// Quality evaluation configuration.
    /// </summary>
    public QualityEvaluationConfig QualityEvaluation { get; set; } = new();

    /// <summary>
    /// Training constraints.
    /// </summary>
    public TrainingConstraints? Constraints { get; set; }

    /// <summary>
    /// Model overrides for A/B testing (blockId -> modelId).
    /// </summary>
    public Dictionary<string, string> ModelOverrides { get; set; } = new();

    /// <summary>
    /// Environment variables to set during training.
    /// </summary>
    public Dictionary<string, string> EnvironmentVariables { get; set; } = new();

    /// <summary>
    /// Container runtime type for execution.
    /// </summary>
    public string? ContainerRuntimeType { get; set; }

    /// <summary>
    /// When this configuration was created.
    /// </summary>
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// When this configuration was last updated.
    /// </summary>
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Who created this configuration.
    /// </summary>
    public string? CreatedBy { get; set; }

    /// <summary>
    /// Tags for organization.
    /// </summary>
    public List<string> Tags { get; set; } = new();

    /// <summary>
    /// Whether this configuration is active.
    /// </summary>
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// Optimization goal for training.
/// </summary>
public enum OptimizationGoal
{
    /// <summary>
    /// Minimize cost.
    /// </summary>
    Cost,

    /// <summary>
    /// Maximize quality.
    /// </summary>
    Quality,

    /// <summary>
    /// Minimize execution time.
    /// </summary>
    Speed,

    /// <summary>
    /// Balance all objectives.
    /// </summary>
    Balanced
}

/// <summary>
/// Weights for multi-objective optimization.
/// </summary>
public class OptimizationWeights
{
    /// <summary>
    /// Weight for cost (0-1).
    /// </summary>
    public double Cost { get; set; } = 0.33;

    /// <summary>
    /// Weight for quality (0-1).
    /// </summary>
    public double Quality { get; set; } = 0.34;

    /// <summary>
    /// Weight for speed (0-1).
    /// </summary>
    public double Speed { get; set; } = 0.33;
}

/// <summary>
/// Configuration for input variation during training.
/// </summary>
public class InputVariationConfig
{
    /// <summary>
    /// Type of input variation.
    /// </summary>
    public InputVariationType Type { get; set; } = InputVariationType.Fixed;

    /// <summary>
    /// Fixed inputs to use for all iterations.
    /// </summary>
    public Dictionary<string, object>? FixedInputs { get; set; }

    /// <summary>
    /// Path to dataset file for dataset-based variation.
    /// </summary>
    public string? DatasetPath { get; set; }

    /// <summary>
    /// Generator configuration for generated inputs.
    /// </summary>
    public InputGeneratorConfig? Generator { get; set; }
}

/// <summary>
/// Type of input variation.
/// </summary>
public enum InputVariationType
{
    /// <summary>
    /// Use fixed inputs for all iterations.
    /// </summary>
    Fixed,

    /// <summary>
    /// Use inputs from a dataset file.
    /// </summary>
    Dataset,

    /// <summary>
    /// Generate inputs dynamically.
    /// </summary>
    Generated
}

/// <summary>
/// Configuration for input generation.
/// </summary>
public class InputGeneratorConfig
{
    /// <summary>
    /// Type of generator.
    /// </summary>
    public string GeneratorType { get; set; } = "random";

    /// <summary>
    /// Random seed for reproducibility.
    /// </summary>
    public int? Seed { get; set; }

    /// <summary>
    /// Generator-specific parameters.
    /// </summary>
    public Dictionary<string, object>? Parameters { get; set; }
}

/// <summary>
/// Configuration for quality evaluation.
/// </summary>
public class QualityEvaluationConfig
{
    /// <summary>
    /// Whether quality evaluation is enabled.
    /// </summary>
    public bool Enabled { get; set; } = false;

    /// <summary>
    /// Evaluation method.
    /// </summary>
    public string Method { get; set; } = "none";

    /// <summary>
    /// Heuristic evaluation settings.
    /// </summary>
    public HeuristicEvaluationConfig? Heuristics { get; set; }

    /// <summary>
    /// LLM evaluation settings.
    /// </summary>
    public LLMEvaluationConfig? LLMEvaluation { get; set; }

    /// <summary>
    /// Custom evaluation settings.
    /// </summary>
    public CustomEvaluationConfig? CustomEvaluator { get; set; }
}

/// <summary>
/// Heuristic evaluation configuration.
/// </summary>
public class HeuristicEvaluationConfig
{
    public bool CheckOutputNotEmpty { get; set; } = true;
    public bool CheckJsonValid { get; set; } = false;
    public string? CheckSchemaCompliance { get; set; }
    public List<string>? CustomChecks { get; set; }
}

/// <summary>
/// LLM-based evaluation configuration.
/// </summary>
public class LLMEvaluationConfig
{
    public string ModelId { get; set; } = string.Empty;
    public string EvaluationPrompt { get; set; } = string.Empty;
    public int ScoreMin { get; set; } = 0;
    public int ScoreMax { get; set; } = 100;
    public List<string>? Criteria { get; set; }
}

/// <summary>
/// Custom script-based evaluation configuration.
/// </summary>
public class CustomEvaluationConfig
{
    public string ScriptPath { get; set; } = string.Empty;
    public string Language { get; set; } = "javascript";
}

/// <summary>
/// Constraints for training runs.
/// </summary>
public class TrainingConstraints
{
    /// <summary>
    /// Maximum cost per iteration in USD.
    /// </summary>
    public decimal? MaxCostPerIteration { get; set; }

    /// <summary>
    /// Maximum duration per iteration in milliseconds.
    /// </summary>
    public long? MaxDurationPerIteration { get; set; }

    /// <summary>
    /// Stop training on first failure.
    /// </summary>
    public bool StopOnFailure { get; set; } = false;

    /// <summary>
    /// Minimum quality score required.
    /// </summary>
    public int? MinQualityScore { get; set; }

    /// <summary>
    /// Maximum total cost for the training run.
    /// </summary>
    public decimal? MaxTotalCost { get; set; }
}
