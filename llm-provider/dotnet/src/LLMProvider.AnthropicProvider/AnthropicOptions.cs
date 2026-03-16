namespace LLMProvider.AnthropicProvider;

/// <summary>
/// Configuration options for the Anthropic API provider.
/// </summary>
public sealed class AnthropicOptions
{
    /// <summary>
    /// Configuration section name in appsettings.json.
    /// </summary>
    public const string SectionName = "Providers:Anthropic";

    /// <summary>
    /// The Anthropic API key. If empty or null, the provider reports IsAvailable = false.
    /// </summary>
    public string ApiKey { get; set; } = "";

    /// <summary>
    /// Base URL for the Anthropic API.
    /// </summary>
    public string BaseUrl { get; set; } = "https://api.anthropic.com";

    /// <summary>
    /// Request timeout in seconds.
    /// </summary>
    public int TimeoutSeconds { get; set; } = 120;

    /// <summary>
    /// Maximum number of retries for transient failures.
    /// </summary>
    public int MaxRetries { get; set; } = 3;

    /// <summary>
    /// List of available model configurations.
    /// </summary>
    public List<AnthropicModelConfig> Models { get; set; } =
    [
        new()
        {
            ModelId = "claude-sonnet-4-6",
            ContextLength = 200000,
            MaxOutputTokens = 16384,
            InputTokenPrice = 3.0m,
            OutputTokenPrice = 15.0m,
            Capabilities = ["chat", "code", "reasoning"],
            ParametersBillions = 70
        },
        new()
        {
            ModelId = "claude-haiku-4-5-20251001",
            ContextLength = 200000,
            MaxOutputTokens = 16384,
            InputTokenPrice = 0.80m,
            OutputTokenPrice = 4.0m,
            Capabilities = ["chat", "code"],
            ParametersBillions = 20
        }
    ];
}

/// <summary>
/// Configuration for a specific Anthropic model.
/// </summary>
public sealed class AnthropicModelConfig
{
    /// <summary>
    /// The model ID as recognized by the Anthropic API (e.g., "claude-sonnet-4-6").
    /// </summary>
    public string ModelId { get; set; } = "";

    /// <summary>
    /// Maximum context length in tokens.
    /// </summary>
    public int ContextLength { get; set; } = 200000;

    /// <summary>
    /// Maximum output tokens for this model.
    /// </summary>
    public int MaxOutputTokens { get; set; } = 16384;

    /// <summary>
    /// Cost per 1,000,000 input tokens in USD (e.g., 3.0 for $3/MTok).
    /// Stored per-million and converted to per-1000 when reporting ModelInfo.
    /// </summary>
    public decimal InputTokenPrice { get; set; }

    /// <summary>
    /// Cost per 1,000,000 output tokens in USD (e.g., 15.0 for $15/MTok).
    /// Stored per-million and converted to per-1000 when reporting ModelInfo.
    /// </summary>
    public decimal OutputTokenPrice { get; set; }

    /// <summary>
    /// Model capabilities (e.g., "chat", "code", "reasoning").
    /// </summary>
    public List<string> Capabilities { get; set; } = ["chat"];

    /// <summary>
    /// Estimated parameter count in billions. Null when unknown.
    /// </summary>
    public double? ParametersBillions { get; set; }
}
