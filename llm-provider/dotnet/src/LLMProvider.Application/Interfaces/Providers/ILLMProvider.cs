using LLMProvider.Application.DTOs;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.Enums;

namespace LLMProvider.Application.Interfaces.Providers;

/// <summary>
/// Core interface that all LLM providers must implement.
/// Providers are responsible for communicating with specific LLM services.
/// </summary>
/// <remarks>
/// Providers must be:
/// - Stateless regarding conversation memory (memory is managed by the Application layer)
/// - Self-contained with their own configuration
/// - Thread-safe for concurrent requests
/// - Accurate in reporting token usage
/// </remarks>
public interface ILLMProvider
{
    /// <summary>
    /// The type of this provider.
    /// </summary>
    ProviderType ProviderType { get; }

    /// <summary>
    /// Human-readable name of this provider.
    /// </summary>
    string Name { get; }

    /// <summary>
    /// Checks if the provider is currently available and healthy.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>True if the provider is available; otherwise, false.</returns>
    Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Discovers all models available through this provider.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>List of available models with their metadata.</returns>
    Task<IReadOnlyList<ModelInfo>> GetAvailableModelsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a completion request to the provider and returns the full response.
    /// </summary>
    /// <param name="request">The completion request.</param>
    /// <param name="conversationHistory">Optional conversation history to include.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The completion response.</returns>
    Task<LLMResponse> CompleteAsync(
        LLMRequest request,
        IReadOnlyList<Message>? conversationHistory = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a completion request and streams the response.
    /// </summary>
    /// <param name="request">The completion request.</param>
    /// <param name="conversationHistory">Optional conversation history to include.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>An async enumerable of response chunks.</returns>
    IAsyncEnumerable<LLMStreamChunk> StreamCompleteAsync(
        LLMRequest request,
        IReadOnlyList<Message>? conversationHistory = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the current authentication status of this provider.
    /// This is a sync method — auth status is known at construction time.
    /// </summary>
    AuthStatus GetAuthStatus();
}
