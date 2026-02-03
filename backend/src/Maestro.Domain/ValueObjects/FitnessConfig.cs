namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Configuration parameters for fitness calculations.
/// </summary>
public record FitnessConfig
{
    /// <summary>
    /// Lambda (λ) - Cost sensitivity exponent.
    /// Higher values penalize costs more heavily.
    /// Default: 0.3 (mild cost sensitivity)
    /// </summary>
    public double Lambda { get; init; } = 0.3;

    /// <summary>
    /// Weight for VRAM in hardware cost calculation (α).
    /// </summary>
    public double VramWeight { get; init; } = 0.5;

    /// <summary>
    /// Weight for RAM in hardware cost calculation (β).
    /// </summary>
    public double RamWeight { get; init; } = 0.3;

    /// <summary>
    /// Weight for GPU in hardware cost calculation (γ).
    /// </summary>
    public double GpuWeight { get; init; } = 0.2;

    /// <summary>
    /// Baseline cost for normalization (USD per 1M tokens).
    /// </summary>
    public decimal BaselineCostPerMillion { get; init; } = 1.0m;

    /// <summary>
    /// Penalty factor per retry attempt (multiplier).
    /// </summary>
    public double RetryPenaltyFactor { get; init; } = 0.9;

    /// <summary>
    /// Minimum fitness threshold for selection.
    /// </summary>
    public double MinimumFitnessThreshold { get; init; } = 0.1;

    /// <summary>
    /// Maximum fitness score cap.
    /// </summary>
    public double MaximumFitnessScore { get; init; } = 100.0;

    /// <summary>
    /// Weight for performance component in composite score.
    /// </summary>
    public double PerformanceWeight { get; init; } = 0.4;

    /// <summary>
    /// Weight for specialization component in composite score.
    /// </summary>
    public double SpecializationWeight { get; init; } = 0.3;

    /// <summary>
    /// Weight for composability component in composite score.
    /// </summary>
    public double ComposabilityWeight { get; init; } = 0.3;

    /// <summary>
    /// When the configuration was last updated.
    /// </summary>
    public DateTimeOffset UpdatedAt { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Default configuration instance.
    /// </summary>
    public static FitnessConfig Default => new();

    /// <summary>
    /// Create configuration optimized for quality over cost.
    /// </summary>
    public static FitnessConfig QualityFocused => new()
    {
        Lambda = 0.1,
        PerformanceWeight = 0.6,
        SpecializationWeight = 0.25,
        ComposabilityWeight = 0.15
    };

    /// <summary>
    /// Create configuration optimized for cost efficiency.
    /// </summary>
    public static FitnessConfig CostFocused => new()
    {
        Lambda = 0.5,
        PerformanceWeight = 0.3,
        SpecializationWeight = 0.2,
        ComposabilityWeight = 0.5
    };

    /// <summary>
    /// Create configuration balanced for general use.
    /// </summary>
    public static FitnessConfig Balanced => new()
    {
        Lambda = 0.3,
        PerformanceWeight = 0.4,
        SpecializationWeight = 0.3,
        ComposabilityWeight = 0.3
    };

    /// <summary>
    /// Validate that weights sum to 1.0.
    /// </summary>
    public bool AreWeightsValid()
    {
        const double tolerance = 0.001;
        var sum = PerformanceWeight + SpecializationWeight + ComposabilityWeight;
        return Math.Abs(sum - 1.0) < tolerance;
    }

    /// <summary>
    /// Normalize weights to sum to 1.0.
    /// </summary>
    public FitnessConfig NormalizeWeights()
    {
        var sum = PerformanceWeight + SpecializationWeight + ComposabilityWeight;
        if (sum == 0) return this with { PerformanceWeight = 1.0 / 3, SpecializationWeight = 1.0 / 3, ComposabilityWeight = 1.0 / 3 };

        return this with
        {
            PerformanceWeight = PerformanceWeight / sum,
            SpecializationWeight = SpecializationWeight / sum,
            ComposabilityWeight = ComposabilityWeight / sum
        };
    }
}
