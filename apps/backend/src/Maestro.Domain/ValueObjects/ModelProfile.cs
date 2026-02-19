namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Hardware and computational profile of a model.
/// Used for fitness cost calculations.
/// </summary>
public record ModelProfile
{
    /// <summary>
    /// Unique identifier for the model (e.g., "gpt-4", "llama3:8b").
    /// </summary>
    public string ModelId { get; init; } = string.Empty;

    /// <summary>
    /// Human-readable name of the model.
    /// </summary>
    public string DisplayName { get; init; } = string.Empty;

    /// <summary>
    /// Provider of the model (e.g., "openai", "anthropic", "ollama").
    /// </summary>
    public string Provider { get; init; } = string.Empty;

    /// <summary>
    /// Number of parameters in billions.
    /// </summary>
    public double ParametersBillions { get; init; }

    /// <summary>
    /// FLOPs per token (floating point operations).
    /// </summary>
    public double FlopsPerToken { get; init; }

    /// <summary>
    /// VRAM requirement in GB.
    /// </summary>
    public double VramGb { get; init; }

    /// <summary>
    /// RAM requirement in GB (for CPU inference).
    /// </summary>
    public double RamGb { get; init; }

    /// <summary>
    /// GPU requirement (0-1 scale, where 1 = dedicated high-end GPU).
    /// </summary>
    public double GpuRequirement { get; init; }

    /// <summary>
    /// Cost per million input tokens in USD.
    /// </summary>
    public decimal CostPerMillionInputTokens { get; init; }

    /// <summary>
    /// Cost per million output tokens in USD.
    /// </summary>
    public decimal CostPerMillionOutputTokens { get; init; }

    /// <summary>
    /// Context window size in tokens.
    /// </summary>
    public int ContextWindowSize { get; init; }

    /// <summary>
    /// Whether this is a local model (Ollama) or cloud-hosted.
    /// </summary>
    public bool IsLocal { get; init; }

    /// <summary>
    /// Average latency per token in milliseconds.
    /// </summary>
    public double AvgLatencyMsPerToken { get; init; }

    /// <summary>
    /// Task types this model excels at.
    /// </summary>
    public IReadOnlyList<string> Specializations { get; init; } = Array.Empty<string>();

    /// <summary>
    /// When the profile was last updated.
    /// </summary>
    public DateTimeOffset UpdatedAt { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Calculate compute cost component: log10(params) × (FLOPs/1e9)
    /// </summary>
    public double ComputeCost
    {
        get
        {
            if (ParametersBillions <= 0) return 1.0;
            return Math.Log10(ParametersBillions * 1e9) * (FlopsPerToken / 1e9);
        }
    }

    /// <summary>
    /// Calculate hardware cost component: α×VRAM + β×RAM + γ×GPU
    /// with default weights.
    /// </summary>
    public double HardwareCost => HardwareCostWithWeights(0.5, 0.3, 0.2);

    /// <summary>
    /// Calculate hardware cost with custom weights.
    /// </summary>
    public double HardwareCostWithWeights(double vramWeight, double ramWeight, double gpuWeight)
    {
        var cost = vramWeight * VramGb + ramWeight * RamGb + gpuWeight * GpuRequirement;
        return Math.Max(cost, 0.1); // Minimum cost to avoid division by zero
    }

    /// <summary>
    /// Calculate average cost per million tokens.
    /// </summary>
    public decimal AverageCostPerMillion => (CostPerMillionInputTokens + CostPerMillionOutputTokens) / 2;

    #region Factory Methods

    /// <summary>
    /// Create profile for GPT-4.
    /// </summary>
    public static ModelProfile Gpt4 => new()
    {
        ModelId = "gpt-4",
        DisplayName = "GPT-4",
        Provider = "openai",
        ParametersBillions = 1760, // Estimated
        FlopsPerToken = 1.76e12,
        VramGb = 0, // Cloud-hosted
        RamGb = 0,
        GpuRequirement = 0,
        CostPerMillionInputTokens = 30.0m,
        CostPerMillionOutputTokens = 60.0m,
        ContextWindowSize = 8192,
        IsLocal = false,
        AvgLatencyMsPerToken = 50,
        Specializations = new[] { "reasoning", "coding", "analysis", "creative" }
    };

    /// <summary>
    /// Create profile for GPT-3.5-Turbo.
    /// </summary>
    public static ModelProfile Gpt35Turbo => new()
    {
        ModelId = "gpt-3.5-turbo",
        DisplayName = "GPT-3.5 Turbo",
        Provider = "openai",
        ParametersBillions = 175, // Estimated
        FlopsPerToken = 1.75e11,
        VramGb = 0,
        RamGb = 0,
        GpuRequirement = 0,
        CostPerMillionInputTokens = 0.5m,
        CostPerMillionOutputTokens = 1.5m,
        ContextWindowSize = 16385,
        IsLocal = false,
        AvgLatencyMsPerToken = 20,
        Specializations = new[] { "general", "chat", "simple-tasks" }
    };

    /// <summary>
    /// Create profile for Claude 3 Opus.
    /// </summary>
    public static ModelProfile Claude3Opus => new()
    {
        ModelId = "claude-3-opus",
        DisplayName = "Claude 3 Opus",
        Provider = "anthropic",
        ParametersBillions = 200, // Estimated
        FlopsPerToken = 2.0e11,
        VramGb = 0,
        RamGb = 0,
        GpuRequirement = 0,
        CostPerMillionInputTokens = 15.0m,
        CostPerMillionOutputTokens = 75.0m,
        ContextWindowSize = 200000,
        IsLocal = false,
        AvgLatencyMsPerToken = 60,
        Specializations = new[] { "reasoning", "analysis", "coding", "creative", "long-context" }
    };

    /// <summary>
    /// Create profile for Claude 3 Sonnet.
    /// </summary>
    public static ModelProfile Claude3Sonnet => new()
    {
        ModelId = "claude-3-sonnet",
        DisplayName = "Claude 3 Sonnet",
        Provider = "anthropic",
        ParametersBillions = 70, // Estimated
        FlopsPerToken = 7.0e10,
        VramGb = 0,
        RamGb = 0,
        GpuRequirement = 0,
        CostPerMillionInputTokens = 3.0m,
        CostPerMillionOutputTokens = 15.0m,
        ContextWindowSize = 200000,
        IsLocal = false,
        AvgLatencyMsPerToken = 30,
        Specializations = new[] { "general", "coding", "analysis" }
    };

    /// <summary>
    /// Create profile for Llama 3 8B (Ollama).
    /// </summary>
    public static ModelProfile Llama3_8B => new()
    {
        ModelId = "llama3:8b",
        DisplayName = "Llama 3 8B",
        Provider = "ollama",
        ParametersBillions = 8,
        FlopsPerToken = 8.0e9,
        VramGb = 6,
        RamGb = 16,
        GpuRequirement = 0.5,
        CostPerMillionInputTokens = 0.0m, // Local
        CostPerMillionOutputTokens = 0.0m,
        ContextWindowSize = 8192,
        IsLocal = true,
        AvgLatencyMsPerToken = 15,
        Specializations = new[] { "general", "chat" }
    };

    /// <summary>
    /// Create profile for Llama 3 70B (Ollama).
    /// </summary>
    public static ModelProfile Llama3_70B => new()
    {
        ModelId = "llama3:70b",
        DisplayName = "Llama 3 70B",
        Provider = "ollama",
        ParametersBillions = 70,
        FlopsPerToken = 7.0e10,
        VramGb = 48,
        RamGb = 64,
        GpuRequirement = 1.0,
        CostPerMillionInputTokens = 0.0m,
        CostPerMillionOutputTokens = 0.0m,
        ContextWindowSize = 8192,
        IsLocal = true,
        AvgLatencyMsPerToken = 80,
        Specializations = new[] { "reasoning", "coding", "analysis" }
    };

    /// <summary>
    /// Create profile for SmolLM2 135M (Ollama).
    /// </summary>
    public static ModelProfile SmolLM2_135M => new()
    {
        ModelId = "smollm2:135m",
        DisplayName = "SmolLM2 135M",
        Provider = "ollama",
        ParametersBillions = 0.135,
        FlopsPerToken = 1.35e8,
        VramGb = 0.5,
        RamGb = 2,
        GpuRequirement = 0.1,
        CostPerMillionInputTokens = 0.0m,
        CostPerMillionOutputTokens = 0.0m,
        ContextWindowSize = 2048,
        IsLocal = true,
        AvgLatencyMsPerToken = 2,
        Specializations = new[] { "simple-tasks", "classification", "extraction" }
    };

    /// <summary>
    /// Create profile for SmolLM2 360M (Ollama).
    /// </summary>
    public static ModelProfile SmolLM2_360M => new()
    {
        ModelId = "smollm2:360m",
        DisplayName = "SmolLM2 360M",
        Provider = "ollama",
        ParametersBillions = 0.36,
        FlopsPerToken = 3.6e8,
        VramGb = 1,
        RamGb = 4,
        GpuRequirement = 0.2,
        CostPerMillionInputTokens = 0.0m,
        CostPerMillionOutputTokens = 0.0m,
        ContextWindowSize = 2048,
        IsLocal = true,
        AvgLatencyMsPerToken = 3,
        Specializations = new[] { "simple-tasks", "classification", "extraction", "chat" }
    };

    /// <summary>
    /// Create profile for Mistral 7B (Ollama).
    /// </summary>
    public static ModelProfile Mistral_7B => new()
    {
        ModelId = "mistral:7b",
        DisplayName = "Mistral 7B",
        Provider = "ollama",
        ParametersBillions = 7,
        FlopsPerToken = 7.0e9,
        VramGb = 5,
        RamGb = 14,
        GpuRequirement = 0.4,
        CostPerMillionInputTokens = 0.0m,
        CostPerMillionOutputTokens = 0.0m,
        ContextWindowSize = 32768,
        IsLocal = true,
        AvgLatencyMsPerToken = 12,
        Specializations = new[] { "general", "coding", "instruction-following" }
    };

    /// <summary>
    /// Create profile for Mixtral 8x7B (Ollama).
    /// </summary>
    public static ModelProfile Mixtral_8x7B => new()
    {
        ModelId = "mixtral:8x7b",
        DisplayName = "Mixtral 8x7B",
        Provider = "ollama",
        ParametersBillions = 46.7, // 8 experts × 7B, ~12.9B active
        FlopsPerToken = 1.3e10,
        VramGb = 32,
        RamGb = 48,
        GpuRequirement = 0.8,
        CostPerMillionInputTokens = 0.0m,
        CostPerMillionOutputTokens = 0.0m,
        ContextWindowSize = 32768,
        IsLocal = true,
        AvgLatencyMsPerToken = 25,
        Specializations = new[] { "reasoning", "coding", "multilingual" }
    };

    /// <summary>
    /// Get all default profiles.
    /// </summary>
    public static IReadOnlyList<ModelProfile> DefaultProfiles => new[]
    {
        Gpt4,
        Gpt35Turbo,
        Claude3Opus,
        Claude3Sonnet,
        Llama3_8B,
        Llama3_70B,
        SmolLM2_135M,
        SmolLM2_360M,
        Mistral_7B,
        Mixtral_8x7B
    };

    /// <summary>
    /// Create a generic profile for an unknown model.
    /// </summary>
    public static ModelProfile CreateGeneric(string modelId, string provider, bool isLocal = false)
    {
        return new ModelProfile
        {
            ModelId = modelId,
            DisplayName = modelId,
            Provider = provider,
            ParametersBillions = isLocal ? 7 : 100,
            FlopsPerToken = isLocal ? 7.0e9 : 1.0e11,
            VramGb = isLocal ? 6 : 0,
            RamGb = isLocal ? 16 : 0,
            GpuRequirement = isLocal ? 0.5 : 0,
            CostPerMillionInputTokens = isLocal ? 0.0m : 5.0m,
            CostPerMillionOutputTokens = isLocal ? 0.0m : 15.0m,
            ContextWindowSize = 8192,
            IsLocal = isLocal,
            AvgLatencyMsPerToken = isLocal ? 20 : 40,
            Specializations = new[] { "general" }
        };
    }

    #endregion
}
