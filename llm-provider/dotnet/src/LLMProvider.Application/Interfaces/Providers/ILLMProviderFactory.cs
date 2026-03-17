using LLMProvider.Domain.Entities;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.Interfaces.Providers;

/// <summary>
/// Factory for creating and managing LLM provider instances.
/// </summary>
public interface ILLMProviderFactory
{
    /// <summary>
    /// Gets a provider by type.
    /// </summary>
    /// <param name="type">The provider type.</param>
    /// <returns>The provider instance.</returns>
    /// <exception cref="InvalidOperationException">Thrown when provider type is not registered.</exception>
    ILLMProvider GetProvider(ProviderType type);

    /// <summary>
    /// Tries to get a provider by type.
    /// </summary>
    /// <param name="type">The provider type.</param>
    /// <param name="provider">The provider instance if found.</param>
    /// <returns>True if provider was found; otherwise, false.</returns>
    bool TryGetProvider(ProviderType type, out ILLMProvider? provider);

    /// <summary>
    /// Gets the appropriate provider for a specific model.
    /// Uses configured priority when multiple providers support the same model.
    /// </summary>
    /// <param name="modelId">The model ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The provider that supports the model.</returns>
    /// <exception cref="InvalidOperationException">Thrown when no provider supports the model.</exception>
    Task<ILLMProvider> GetProviderForModelAsync(ModelId modelId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets all registered provider types.
    /// </summary>
    /// <returns>Collection of registered provider types.</returns>
    IEnumerable<ProviderType> GetRegisteredProviders();

    /// <summary>
    /// Gets all available (healthy) providers.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Collection of available providers.</returns>
    Task<IReadOnlyList<ILLMProvider>> GetAvailableProvidersAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Detects models supported by multiple providers.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>List of model conflicts with current preference info.</returns>
    Task<IReadOnlyList<ModelConflict>> DetectModelConflictsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Sets the preferred provider for a model. Persists to provider-priority.json.
    /// </summary>
    /// <param name="modelId">The model ID.</param>
    /// <param name="preferredProvider">The preferred provider type.</param>
    void SetModelPreference(string modelId, ProviderType preferredProvider);
}
