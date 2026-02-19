namespace LLMProvider.AzureInferenceProvider;

/// <summary>
/// Configuration options for the Azure AI Inference provider.
/// Supports Llama, Mistral, Phi, Cohere, and other Azure AI Model Catalog models.
/// </summary>
public sealed class AzureInferenceProviderOptions
{
    /// <summary>
    /// Configuration section name.
    /// </summary>
    public const string SectionName = "Providers:AzureInference";

    /// <summary>
    /// The Azure AI Inference endpoint URL (e.g., https://your-resource.services.ai.azure.com).
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
    /// The default model to use when not specified in the request.
    /// </summary>
    public string? DefaultModel { get; init; }

    /// <summary>
    /// Request timeout in seconds.
    /// </summary>
    public int TimeoutSeconds { get; init; } = 120;

    /// <summary>
    /// Maximum number of retries for failed requests.
    /// </summary>
    public int MaxRetries { get; init; } = 3;

    /// <summary>
    /// List of available models with their deployment configurations.
    /// </summary>
    public List<AzureInferenceModelConfig> Models { get; init; } = [];
}

/// <summary>
/// Configuration for a specific Azure AI Inference model deployment.
/// </summary>
public sealed class AzureInferenceModelConfig
{
    /// <summary>
    /// The model ID used to reference this model in API requests (e.g., "llama-3-70b").
    /// </summary>
    public required string ModelId { get; init; }

    /// <summary>
    /// The deployment name in Azure AI Model Catalog (e.g., "llama-3-70b-chat").
    /// </summary>
    public required string DeploymentName { get; init; }

    /// <summary>
    /// Maximum context length for this model.
    /// </summary>
    public int ContextLength { get; init; } = 8192;

    /// <summary>
    /// Maximum output tokens for this model.
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
    /// Model capabilities (e.g., "chat", "function_calling").
    /// </summary>
    public List<string> Capabilities { get; init; } = ["chat"];

    /// <summary>
    /// The model family (e.g., "llama", "mistral", "phi", "cohere").
    /// </summary>
    public string? ModelFamily { get; init; }
}
