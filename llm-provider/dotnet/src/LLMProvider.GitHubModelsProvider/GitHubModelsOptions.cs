namespace LLMProvider.GitHubModelsProvider;

/// <summary>
/// Configuration options for the GitHub Models provider.
/// </summary>
public sealed class GitHubModelsOptions
{
    /// <summary>
    /// Configuration section name in appsettings.json.
    /// </summary>
    public const string SectionName = "Providers:GitHubModels";

    /// <summary>
    /// GitHub personal access token. If empty or null, the provider reports IsAvailable = false.
    /// </summary>
    public string Token { get; set; } = "";

    /// <summary>
    /// Base endpoint for GitHub Models inference API.
    /// </summary>
    public string Endpoint { get; set; } = "https://models.inference.ai.azure.com";

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
    public List<GitHubModelsModelConfig> Models { get; set; } =
    [
        new()
        {
            ModelId = "DeepSeek-V3",
            ContextLength = 65536,
            MaxOutputTokens = 8192,
            InputTokenPrice = 0.27m,
            OutputTokenPrice = 1.1m,
            Capabilities = ["chat"],
            ModelFamily = "deepseek",
            ParametersBillions = 685
        },
        new()
        {
            ModelId = "Meta-Llama-3.3-70B-Instruct",
            ContextLength = 131072,
            MaxOutputTokens = 4096,
            InputTokenPrice = 0.71m,
            OutputTokenPrice = 0.71m,
            Capabilities = ["chat"],
            ModelFamily = "llama",
            ParametersBillions = 70
        }
    ];
}

/// <summary>
/// Configuration for a specific GitHub Models model.
/// </summary>
public sealed class GitHubModelsModelConfig
{
    /// <summary>
    /// The model ID as recognized by the GitHub Models API (e.g., "DeepSeek-V3").
    /// </summary>
    public string ModelId { get; set; } = "";

    /// <summary>
    /// Maximum context length in tokens.
    /// </summary>
    public int ContextLength { get; set; } = 65536;

    /// <summary>
    /// Maximum output tokens for this model.
    /// </summary>
    public int MaxOutputTokens { get; set; } = 8192;

    /// <summary>
    /// Cost per 1,000,000 input tokens in USD.
    /// Stored per-million and converted to per-1000 when reporting ModelInfo.
    /// </summary>
    public decimal InputTokenPrice { get; set; }

    /// <summary>
    /// Cost per 1,000,000 output tokens in USD.
    /// Stored per-million and converted to per-1000 when reporting ModelInfo.
    /// </summary>
    public decimal OutputTokenPrice { get; set; }

    /// <summary>
    /// Model capabilities (e.g., "chat").
    /// </summary>
    public List<string> Capabilities { get; set; } = ["chat"];

    /// <summary>
    /// Model family identifier (e.g., "deepseek", "llama").
    /// </summary>
    public string? ModelFamily { get; set; }

    /// <summary>
    /// Estimated parameter count in billions. Null when unknown.
    /// </summary>
    public double? ParametersBillions { get; set; }
}
