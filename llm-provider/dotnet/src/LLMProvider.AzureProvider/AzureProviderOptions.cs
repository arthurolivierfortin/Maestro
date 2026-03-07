namespace LLMProvider.AzureProvider;

/// <summary>
/// Configuration options for the Azure OpenAI provider.
/// </summary>
public sealed class AzureProviderOptions
{
    /// <summary>
    /// Configuration section name.
    /// </summary>
    public const string SectionName = "Providers:Azure";

    /// <summary>
    /// The Azure OpenAI endpoint URL.
    /// </summary>
    public required string Endpoint { get; init; }

    /// <summary>
    /// The API key for authentication. Optional if using DefaultAzureCredential.
    /// When provided, takes priority over DefaultAzureCredential.
    /// </summary>
    public string? ApiKey { get; init; }

    /// <summary>
    /// Whether to use DefaultAzureCredential for authentication when ApiKey is not provided.
    /// Default is true. Uses az login, Managed Identity, or other Azure credential sources.
    /// </summary>
    public bool UseDefaultCredential { get; init; } = true;

    /// <summary>
    /// The default deployment name to use.
    /// </summary>
    public string? DefaultDeployment { get; init; }

    /// <summary>
    /// Request timeout in seconds.
    /// </summary>
    public int TimeoutSeconds { get; init; } = 120;

    /// <summary>
    /// Maximum number of retries for failed requests.
    /// </summary>
    public int MaxRetries { get; init; } = 3;

    /// <summary>
    /// List of available deployments with their model mappings.
    /// </summary>
    public List<DeploymentConfig> Deployments { get; init; } = [];
}

/// <summary>
/// Configuration for a specific Azure OpenAI deployment.
/// </summary>
public sealed class DeploymentConfig
{
    /// <summary>
    /// The deployment name in Azure.
    /// </summary>
    public required string DeploymentName { get; init; }

    /// <summary>
    /// The model ID (e.g., "gpt-4", "gpt-4o").
    /// </summary>
    public required string ModelId { get; init; }

    /// <summary>
    /// Maximum context length for this deployment.
    /// </summary>
    public int ContextLength { get; init; } = 8192;

    /// <summary>
    /// Maximum output tokens for this deployment.
    /// </summary>
    public int? MaxOutputTokens { get; init; }

    /// <summary>
    /// Cost per 1000 input tokens (optional).
    /// </summary>
    public decimal? InputTokenPrice { get; init; }

    /// <summary>
    /// Cost per 1000 output tokens (optional).
    /// </summary>
    public decimal? OutputTokenPrice { get; init; }

    /// <summary>
    /// Model capabilities.
    /// </summary>
    public List<string> Capabilities { get; init; } = ["chat"];

    /// <summary>
    /// Estimated number of parameters in billions (e.g., 70 for a 70B model). Null when unknown.
    /// </summary>
    public double? ParametersBillions { get; init; }
}
