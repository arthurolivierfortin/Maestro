namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Represents a model's fitness score using the formula:
///
///                P × S × W
/// ModelFitness = ─────────────────────────
///                (C_norm × C_compute × C_hw)^λ
///
/// Where:
/// - P = Performance (quality score normalized to 0-1)
/// - S = Specialization (performance / task entropy)
/// - W = Composability (success rate × retry penalty)
/// - C_norm = Normalized economic cost
/// - C_compute = Computational cost (log10(params) × FLOPs)
/// - C_hw = Hardware cost (α×VRAM + β×RAM + γ×GPU)
/// - λ = Cost sensitivity exponent
/// </summary>
public record FitnessScore
{
    /// <summary>
    /// Performance component (P) - Quality score normalized to 0-1.
    /// </summary>
    public double Performance { get; init; }

    /// <summary>
    /// Specialization component (S) - P / TaskEntropy.
    /// Rewards models that perform well on specific task types.
    /// </summary>
    public double Specialization { get; init; }

    /// <summary>
    /// Composability component (W) - SuccessRate × RetryPenalty.
    /// Measures how well the model works in workflows.
    /// </summary>
    public double Composability { get; init; }

    /// <summary>
    /// Normalized economic cost (C_norm) - log scale of actual cost.
    /// </summary>
    public double EconomicCost { get; init; }

    /// <summary>
    /// Computational cost (C_compute) - log10(params) × (FLOPs/1e9).
    /// </summary>
    public double ComputeCost { get; init; }

    /// <summary>
    /// Hardware cost (C_hw) - α×VRAM + β×RAM + γ×GPU.
    /// </summary>
    public double HardwareCost { get; init; }

    /// <summary>
    /// Lambda (λ) - Cost sensitivity exponent used in calculation.
    /// </summary>
    public double Lambda { get; init; }

    /// <summary>
    /// The model ID this fitness was calculated for.
    /// </summary>
    public string ModelId { get; init; } = string.Empty;

    /// <summary>
    /// The task type this fitness was calculated for.
    /// </summary>
    public string TaskType { get; init; } = string.Empty;

    /// <summary>
    /// When the fitness was calculated.
    /// </summary>
    public DateTimeOffset CalculatedAt { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// The total fitness score calculated using the formula.
    /// </summary>
    public double TotalFitness
    {
        get
        {
            var numerator = Performance * Specialization * Composability;
            var denominator = Math.Pow(EconomicCost * ComputeCost * HardwareCost, Lambda);

            // Prevent division by zero and handle edge cases
            if (denominator <= 0 || double.IsNaN(denominator) || double.IsInfinity(denominator))
                return 0;

            var fitness = numerator / denominator;

            // Cap at reasonable bounds
            return Math.Clamp(fitness, 0, 100);
        }
    }

    /// <summary>
    /// Weighted composite score for leaderboard ranking.
    /// </summary>
    public double WeightedScore(FitnessConfig config)
    {
        return (config.PerformanceWeight * Performance +
                config.SpecializationWeight * Specialization +
                config.ComposabilityWeight * Composability) / TotalCostFactor;
    }

    /// <summary>
    /// Combined cost factor (denominator of the fitness formula).
    /// </summary>
    public double TotalCostFactor => Math.Pow(EconomicCost * ComputeCost * HardwareCost, Lambda);

    /// <summary>
    /// Get a breakdown of individual component contributions.
    /// </summary>
    public FitnessBreakdown GetBreakdown()
    {
        return new FitnessBreakdown
        {
            Performance = Performance,
            Specialization = Specialization,
            Composability = Composability,
            EconomicCost = EconomicCost,
            ComputeCost = ComputeCost,
            HardwareCost = HardwareCost,
            TotalFitness = TotalFitness
        };
    }

    #region Factory Methods

    /// <summary>
    /// Calculate fitness from execution metrics and model profile.
    /// </summary>
    public static FitnessScore Calculate(
        WorkflowExecutionMetrics metrics,
        ModelProfile profile,
        TaskEntropy entropy,
        FitnessConfig config)
    {
        // Performance (P): Quality score normalized to 0-1
        var qualityScore = metrics.Quality?.Score ?? 70; // Default to 70 if no quality score
        var performance = qualityScore / 100.0;

        // Specialization (S): P / entropy (capped at reasonable bounds)
        var entropyValue = Math.Max(entropy.EntropyValue, 0.1); // Minimum entropy to avoid infinity
        var specialization = Math.Min(performance / entropyValue, 10.0);

        // Composability (W): Success rate × retry penalty
        var successRate = metrics.BlocksTotal > 0
            ? (double)metrics.BlocksSucceeded / metrics.BlocksTotal
            : 0;
        var retryPenalty = Math.Pow(config.RetryPenaltyFactor, metrics.TotalRetries);
        var composability = successRate * retryPenalty;

        // Economic cost (C_norm): Logarithmic normalization
        var actualCost = metrics.TotalCostUsd > 0 ? metrics.TotalCostUsd : 0.001m; // Minimum for local models
        var baselineCost = config.BaselineCostPerMillion;
        var economicCost = Math.Log10((double)(actualCost / baselineCost) + 1) + 1; // +1 to avoid log(0)

        // Compute cost: log10(params) × (FLOPs/1e9)
        var computeCost = Math.Max(profile.ComputeCost, 0.1);

        // Hardware cost: α×VRAM + β×RAM + γ×GPU
        var hardwareCost = profile.HardwareCostWithWeights(
            config.VramWeight,
            config.RamWeight,
            config.GpuWeight);

        // For cloud models, use a baseline hardware cost
        if (!profile.IsLocal && hardwareCost < 0.1)
        {
            hardwareCost = 1.0; // Baseline for cloud models
        }

        return new FitnessScore
        {
            Performance = performance,
            Specialization = specialization,
            Composability = composability,
            EconomicCost = economicCost,
            ComputeCost = computeCost,
            HardwareCost = hardwareCost,
            Lambda = config.Lambda,
            ModelId = profile.ModelId,
            TaskType = entropy.DominantTaskType ?? "general"
        };
    }

    /// <summary>
    /// Create a fitness score with explicit component values.
    /// </summary>
    public static FitnessScore Create(
        double performance,
        double specialization,
        double composability,
        double economicCost,
        double computeCost,
        double hardwareCost,
        double lambda,
        string modelId,
        string taskType)
    {
        return new FitnessScore
        {
            Performance = Math.Clamp(performance, 0, 1),
            Specialization = Math.Max(specialization, 0),
            Composability = Math.Clamp(composability, 0, 1),
            EconomicCost = Math.Max(economicCost, 0.1),
            ComputeCost = Math.Max(computeCost, 0.1),
            HardwareCost = Math.Max(hardwareCost, 0.1),
            Lambda = lambda,
            ModelId = modelId,
            TaskType = taskType
        };
    }

    /// <summary>
    /// Create a default/placeholder fitness score.
    /// </summary>
    public static FitnessScore Default(string modelId = "unknown") => new()
    {
        Performance = 0.5,
        Specialization = 1.0,
        Composability = 0.8,
        EconomicCost = 1.0,
        ComputeCost = 1.0,
        HardwareCost = 1.0,
        Lambda = 0.3,
        ModelId = modelId,
        TaskType = "general"
    };

    #endregion
}

/// <summary>
/// Detailed breakdown of fitness score components.
/// </summary>
public record FitnessBreakdown
{
    public double Performance { get; init; }
    public double Specialization { get; init; }
    public double Composability { get; init; }
    public double EconomicCost { get; init; }
    public double ComputeCost { get; init; }
    public double HardwareCost { get; init; }
    public double TotalFitness { get; init; }

    /// <summary>
    /// Get the numerator (P × S × W).
    /// </summary>
    public double Numerator => Performance * Specialization * Composability;

    /// <summary>
    /// Get the combined cost (product of all costs).
    /// </summary>
    public double CombinedCost => EconomicCost * ComputeCost * HardwareCost;
}

/// <summary>
/// Aggregate fitness statistics across multiple executions.
/// </summary>
public record AggregateFitnessStats
{
    public double AverageFitness { get; init; }
    public double MinFitness { get; init; }
    public double MaxFitness { get; init; }
    public double FitnessVariance { get; init; }
    public double FitnessStdDev => Math.Sqrt(FitnessVariance);
    public int SampleCount { get; init; }
    public FitnessBreakdown AverageBreakdown { get; init; } = new();

    /// <summary>
    /// Calculate aggregate statistics from a collection of fitness scores.
    /// </summary>
    public static AggregateFitnessStats Calculate(IEnumerable<FitnessScore> scores)
    {
        var list = scores.ToList();
        if (list.Count == 0)
        {
            return new AggregateFitnessStats { SampleCount = 0 };
        }

        var fitnessValues = list.Select(s => s.TotalFitness).ToList();
        var mean = fitnessValues.Average();
        var variance = fitnessValues.Count > 1
            ? fitnessValues.Sum(v => Math.Pow(v - mean, 2)) / (fitnessValues.Count - 1)
            : 0;

        return new AggregateFitnessStats
        {
            AverageFitness = mean,
            MinFitness = fitnessValues.Min(),
            MaxFitness = fitnessValues.Max(),
            FitnessVariance = variance,
            SampleCount = list.Count,
            AverageBreakdown = new FitnessBreakdown
            {
                Performance = list.Average(s => s.Performance),
                Specialization = list.Average(s => s.Specialization),
                Composability = list.Average(s => s.Composability),
                EconomicCost = list.Average(s => s.EconomicCost),
                ComputeCost = list.Average(s => s.ComputeCost),
                HardwareCost = list.Average(s => s.HardwareCost),
                TotalFitness = mean
            }
        };
    }
}
