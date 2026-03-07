using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Domain.Entities;

/// <summary>
/// Represents metadata about an LLM model available through a provider.
/// </summary>
public sealed class ModelInfo
{
    /// <summary>
    /// Unique identifier for this model.
    /// </summary>
    public ModelId Id { get; }

    /// <summary>
    /// Display name of the model.
    /// </summary>
    public string Name { get; }

    /// <summary>
    /// The provider that offers this model.
    /// </summary>
    public ProviderType Provider { get; }

    /// <summary>
    /// Maximum context length (in tokens) supported by this model.
    /// </summary>
    public int ContextLength { get; }

    /// <summary>
    /// Maximum output tokens supported by this model.
    /// </summary>
    public int? MaxOutputTokens { get; }

    /// <summary>
    /// Cost per 1000 input tokens (if applicable).
    /// </summary>
    public decimal? InputTokenPrice { get; }

    /// <summary>
    /// Cost per 1000 output tokens (if applicable).
    /// </summary>
    public decimal? OutputTokenPrice { get; }

    /// <summary>
    /// Optional description of the model.
    /// </summary>
    public string? Description { get; }

    /// <summary>
    /// Model capabilities (e.g., "chat", "completion", "vision", "function_calling").
    /// </summary>
    public IReadOnlyList<string> Capabilities { get; }

    /// <summary>
    /// Estimated number of parameters in billions (e.g., 70 for a 70B model).
    /// Null when the parameter count is unknown.
    /// </summary>
    public double? ParametersBillions { get; }

    /// <summary>
    /// Whether this model is currently available.
    /// </summary>
    public bool IsAvailable { get; }

    /// <summary>
    /// When this model information was last updated.
    /// </summary>
    public DateTimeOffset LastUpdated { get; }

    /// <summary>
    /// Creates a new ModelInfo instance.
    /// </summary>
    /// <param name="id">The model ID.</param>
    /// <param name="name">The display name.</param>
    /// <param name="provider">The provider type.</param>
    /// <param name="contextLength">Maximum context length.</param>
    /// <param name="maxOutputTokens">Maximum output tokens.</param>
    /// <param name="inputTokenPrice">Cost per 1000 input tokens.</param>
    /// <param name="outputTokenPrice">Cost per 1000 output tokens.</param>
    /// <param name="description">Model description.</param>
    /// <param name="capabilities">List of capabilities.</param>
    /// <param name="isAvailable">Whether the model is available.</param>
    /// <exception cref="ArgumentException">Thrown when name is null or whitespace.</exception>
    /// <exception cref="ArgumentOutOfRangeException">Thrown when contextLength is not positive.</exception>
    public ModelInfo(
        ModelId id,
        string name,
        ProviderType provider,
        int contextLength,
        int? maxOutputTokens = null,
        decimal? inputTokenPrice = null,
        decimal? outputTokenPrice = null,
        string? description = null,
        IEnumerable<string>? capabilities = null,
        bool isAvailable = true,
        double? parametersBillions = null)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Model name cannot be null or whitespace.", nameof(name));
        }

        if (contextLength <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(contextLength), "Context length must be positive.");
        }

        Id = id;
        Name = name;
        Provider = provider;
        ContextLength = contextLength;
        MaxOutputTokens = maxOutputTokens;
        InputTokenPrice = inputTokenPrice;
        OutputTokenPrice = outputTokenPrice;
        Description = description;
        Capabilities = capabilities?.ToList().AsReadOnly() ?? (IReadOnlyList<string>)[];
        IsAvailable = isAvailable;
        ParametersBillions = parametersBillions;
        LastUpdated = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Checks if this model has a specific capability.
    /// </summary>
    /// <param name="capability">The capability to check for.</param>
    /// <returns>True if the model has the capability.</returns>
    public bool HasCapability(string capability) =>
        Capabilities.Contains(capability, StringComparer.OrdinalIgnoreCase);
}
