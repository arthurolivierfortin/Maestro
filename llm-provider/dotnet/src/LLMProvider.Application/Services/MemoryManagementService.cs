using LLMProvider.Domain.Entities;
using LLMProvider.Domain.Enums;

namespace LLMProvider.Application.Services;

/// <summary>
/// Service for managing conversation memory strategies.
/// </summary>
public sealed class MemoryManagementService
{
    /// <summary>
    /// Default window size for windowed memory strategy.
    /// </summary>
    public const int DefaultWindowSize = 10;

    /// <summary>
    /// Gets messages from a conversation based on the specified memory strategy.
    /// </summary>
    /// <param name="conversation">The conversation to get messages from.</param>
    /// <param name="strategy">The memory strategy to apply.</param>
    /// <param name="windowSize">Optional window size for Windowed strategy.</param>
    /// <returns>The messages according to the strategy.</returns>
    public IReadOnlyList<Message> GetMessagesForStrategy(
        Conversation conversation,
        MemoryStrategy strategy,
        int? windowSize = null)
    {
        return strategy switch
        {
            MemoryStrategy.Full => GetFullHistory(conversation),
            MemoryStrategy.None => [],
            MemoryStrategy.Windowed => GetWindowedHistory(conversation, windowSize ?? DefaultWindowSize),
            MemoryStrategy.Summarized => GetSummarizedHistory(conversation),
            _ => throw new ArgumentOutOfRangeException(nameof(strategy))
        };
    }

    /// <summary>
    /// Gets the full conversation history.
    /// </summary>
    private static IReadOnlyList<Message> GetFullHistory(Conversation conversation)
    {
        return conversation.Messages;
    }

    /// <summary>
    /// Gets the last N messages from the conversation.
    /// System messages are always included regardless of window size.
    /// </summary>
    private static IReadOnlyList<Message> GetWindowedHistory(Conversation conversation, int windowSize)
    {
        if (conversation.IsEmpty)
        {
            return [];
        }

        // Always include system messages
        var systemMessages = conversation.GetMessagesByRole(MessageRole.System);

        // Get the last N non-system messages
        var recentMessages = conversation.Messages
            .Where(m => m.Role != MessageRole.System)
            .TakeLast(windowSize)
            .ToList();

        // Combine: system messages first, then recent messages
        var result = new List<Message>(systemMessages.Count + recentMessages.Count);
        result.AddRange(systemMessages);
        result.AddRange(recentMessages);

        return result.AsReadOnly();
    }

    /// <summary>
    /// Gets a summarized version of the conversation history.
    /// Currently returns the system message plus the last few messages.
    /// Future implementation could use LLM to generate actual summary.
    /// </summary>
    private static IReadOnlyList<Message> GetSummarizedHistory(Conversation conversation)
    {
        // For now, just return system + last 2 messages
        // A full implementation would use an LLM to summarize the conversation
        return GetWindowedHistory(conversation, 2);
    }

    /// <summary>
    /// Calculates the approximate token count for a set of messages.
    /// Uses a simple heuristic: ~4 characters per token.
    /// </summary>
    /// <param name="messages">The messages to estimate tokens for.</param>
    /// <returns>Estimated token count.</returns>
    public static int EstimateTokenCount(IEnumerable<Message> messages)
    {
        const int CharsPerToken = 4; // Rough approximation

        return messages.Sum(m => m.Content.Length / CharsPerToken + 1);
    }

    /// <summary>
    /// Trims messages to fit within a token budget.
    /// Keeps system messages and most recent messages.
    /// </summary>
    /// <param name="messages">The messages to trim.</param>
    /// <param name="maxTokens">Maximum token budget.</param>
    /// <returns>Trimmed messages.</returns>
    public IReadOnlyList<Message> TrimToTokenBudget(IReadOnlyList<Message> messages, int maxTokens)
    {
        var systemMessages = messages.Where(m => m.Role == MessageRole.System).ToList();
        var otherMessages = messages.Where(m => m.Role != MessageRole.System).ToList();

        var result = new List<Message>(systemMessages);
        var currentTokens = EstimateTokenCount(systemMessages);

        // Add messages from the end (most recent) while within budget
        for (var i = otherMessages.Count - 1; i >= 0; i--)
        {
            var msgTokens = EstimateTokenCount([otherMessages[i]]);
            if (currentTokens + msgTokens > maxTokens)
            {
                break;
            }

            result.Insert(systemMessages.Count, otherMessages[i]);
            currentTokens += msgTokens;
        }

        return result.AsReadOnly();
    }
}
