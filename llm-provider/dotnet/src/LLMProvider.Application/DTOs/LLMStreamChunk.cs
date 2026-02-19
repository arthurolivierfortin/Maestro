using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.DTOs;

/// <summary>
/// Represents a single chunk in a streaming LLM response.
/// </summary>
public sealed record LLMStreamChunk
{
    /// <summary>
    /// The content delta for this chunk.
    /// </summary>
    public required string Content { get; init; }

    /// <summary>
    /// Whether this is the final chunk in the stream.
    /// </summary>
    public bool IsComplete { get; init; }

    /// <summary>
    /// Token usage (only populated on the final chunk).
    /// </summary>
    public TokenUsage? TokenUsage { get; init; }

    /// <summary>
    /// Finish reason (only populated on the final chunk).
    /// </summary>
    public string? FinishReason { get; init; }

    /// <summary>
    /// The model being used.
    /// </summary>
    public ModelId? ModelUsed { get; init; }

    /// <summary>
    /// The provider handling the request.
    /// </summary>
    public ProviderType? Provider { get; init; }
}
