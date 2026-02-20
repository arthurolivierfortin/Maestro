using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.DTOs;

/// <summary>
/// Data transfer object for LLM completion requests.
/// </summary>
public sealed record LLMRequest
{
    /// <summary>
    /// The prompt/user message to send to the LLM.
    /// </summary>
    public required string Prompt { get; init; }

    /// <summary>
    /// The model to use for this request.
    /// </summary>
    public required ModelId ModelId { get; init; }

    /// <summary>
    /// Optional preferred provider. If not specified, provider is auto-selected based on model.
    /// </summary>
    public ProviderType? PreferredProvider { get; init; }

    /// <summary>
    /// Optional conversation ID to include history from.
    /// </summary>
    public ConversationId? ConversationId { get; init; }

    /// <summary>
    /// How to handle conversation memory. Defaults to Full.
    /// </summary>
    public MemoryStrategy MemoryStrategy { get; init; } = MemoryStrategy.Full;

    /// <summary>
    /// Maximum number of messages to include when using Windowed memory strategy.
    /// </summary>
    public int? WindowSize { get; init; }

    /// <summary>
    /// Maximum tokens to generate. If null, uses model default.
    /// </summary>
    public int? MaxTokens { get; init; }

    /// <summary>
    /// Sampling temperature (0.0 - 2.0). Higher = more creative, lower = more deterministic.
    /// </summary>
    public float? Temperature { get; init; }

    /// <summary>
    /// Optional system prompt to override conversation's system message.
    /// </summary>
    public string? SystemPrompt { get; init; }

    /// <summary>
    /// Provider-specific options (passed through to provider).
    /// </summary>
    public IReadOnlyDictionary<string, object>? ProviderOptions { get; init; }

    /// <summary>
    /// Inline conversation messages with roles (system/user/assistant).
    /// When provided, these are passed to the provider for multi-turn conversations
    /// without requiring a persistent ConversationId.
    /// </summary>
    public IReadOnlyList<InlineMessage>? Messages { get; init; }
}

/// <summary>
/// A lightweight message DTO for inline conversation messages.
/// Used when the caller wants to pass a full conversation without
/// creating a persistent Conversation in the repository.
/// </summary>
public sealed record InlineMessage
{
    public required string Role { get; init; }
    public required string Content { get; init; }
}
