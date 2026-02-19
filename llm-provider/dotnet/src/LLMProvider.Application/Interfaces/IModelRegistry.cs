using LLMProvider.Domain.Entities;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.Interfaces;

/// <summary>
/// Registry for discovering and querying available models across all providers.
/// </summary>
public interface IModelRegistry
{
    /// <summary>
    /// Gets all available models from all providers.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>All available models.</returns>
    Task<IReadOnlyList<ModelInfo>> GetAllModelsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets models from a specific provider.
    /// </summary>
    /// <param name="provider">The provider type.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Models from the specified provider.</returns>
    Task<IReadOnlyList<ModelInfo>> GetModelsByProviderAsync(
        ProviderType provider,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a specific model by ID.
    /// </summary>
    /// <param name="modelId">The model ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The model if found; otherwise, null.</returns>
    Task<ModelInfo?> GetModelAsync(ModelId modelId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Refreshes the model cache from all providers.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task RefreshAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets models with a specific capability.
    /// </summary>
    /// <param name="capability">The required capability (e.g., "chat", "vision").</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Models with the specified capability.</returns>
    Task<IReadOnlyList<ModelInfo>> GetModelsByCapabilityAsync(
        string capability,
        CancellationToken cancellationToken = default);
}
