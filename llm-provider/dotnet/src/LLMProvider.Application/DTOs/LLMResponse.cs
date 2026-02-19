using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.DTOs;

/// <summary>
/// Data transfer object for LLM completion responses.
/// </summary>
public sealed record LLMResponse
{
    /// <summary>
    /// The generated content from the LLM.
    /// </summary>
    public required string Content { get; init; }

    /// <summary>
    /// The model that was used for generation.
    /// </summary>
    public required ModelId ModelUsed { get; init; }

    /// <summary>
    /// The provider that handled the request.
    /// </summary>
    public required ProviderType Provider { get; init; }

    /// <summary>
    /// Token usage statistics for this request/response.
    /// </summary>
    public required TokenUsage TokenUsage { get; init; }

    /// <summary>
    /// The conversation ID (if the request was part of a conversation).
    /// </summary>
    public ConversationId? ConversationId { get; init; }

    /// <summary>
    /// The ID of the user's message (if saved to conversation).
    /// </summary>
    public MessageId? UserMessageId { get; init; }

    /// <summary>
    /// The ID of the assistant's message (if saved to conversation).
    /// </summary>
    public MessageId? AssistantMessageId { get; init; }

    /// <summary>
    /// How long the request took to complete.
    /// </summary>
    public TimeSpan Duration { get; init; }

    /// <summary>
    /// When the response was generated.
    /// </summary>
    public DateTimeOffset Timestamp { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Optional finish reason from the model (e.g., "stop", "length", "content_filter").
    /// </summary>
    public string? FinishReason { get; init; }
}
