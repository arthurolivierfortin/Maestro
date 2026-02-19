using Maestro.Application.Interfaces;

namespace Maestro.Infrastructure.Context;

/// <summary>
/// Implements sliding window context strategy.
/// Keeps the most recent N messages within token limit.
/// </summary>
public class SlidingWindowContextProcessor : IContextProcessor
{
    /// <summary>
    /// Approximate characters per token (conservative estimate for English).
    /// </summary>
    private const int CharsPerToken = 4;

    public Task<ContextResult> ProcessAsync(ContextInput input, CancellationToken ct = default)
    {
        var config = input.Config;
        var messages = new List<ChatMessage>(input.Messages);

        // Add new message if provided
        if (input.NewMessage != null)
        {
            messages.Add(input.NewMessage);
        }

        var originalCount = messages.Count;

        // Separate system message if present
        ChatMessage? systemMessage = null;
        if (config.KeepSystemPrompt)
        {
            systemMessage = messages.FirstOrDefault(m => m.Role == "system");
            if (systemMessage != null)
            {
                messages = messages.Where(m => m.Role != "system").ToList();
            }
            else if (!string.IsNullOrEmpty(input.SystemPrompt))
            {
                systemMessage = ChatMessage.System(input.SystemPrompt);
            }
        }

        // Calculate available tokens (minus system prompt and response reserve)
        var availableTokens = config.MaxTokens - config.ReserveForResponse;
        if (systemMessage != null)
        {
            availableTokens -= EstimateTokens(systemMessage.Content);
        }

        // Apply sliding window: keep last N messages within token budget
        var optimizedMessages = new List<ChatMessage>();
        var currentTokens = 0;
        var keepCount = Math.Min(config.KeepLastN, messages.Count);

        // Start from most recent and work backwards
        for (int i = messages.Count - 1; i >= 0 && optimizedMessages.Count < keepCount; i--)
        {
            var msg = messages[i];
            var msgTokens = EstimateTokens(msg.Content);

            if (currentTokens + msgTokens <= availableTokens)
            {
                optimizedMessages.Insert(0, msg);
                currentTokens += msgTokens;
            }
            else if (optimizedMessages.Count == 0)
            {
                // Always include at least the last message, even if over limit
                optimizedMessages.Insert(0, msg);
                currentTokens += msgTokens;
                break;
            }
            else
            {
                break;
            }
        }

        // Add system message at the beginning
        if (systemMessage != null)
        {
            optimizedMessages.Insert(0, systemMessage);
            currentTokens += EstimateTokens(systemMessage.Content);
        }

        var result = new ContextResult
        {
            Messages = optimizedMessages,
            EstimatedTokens = currentTokens,
            WasTruncated = optimizedMessages.Count < originalCount,
            MessagesRemoved = originalCount - optimizedMessages.Count + (systemMessage != null ? 1 : 0),
            OriginalMessageCount = originalCount
        };

        return Task.FromResult(result);
    }

    /// <summary>
    /// Estimate token count from text length.
    /// </summary>
    private static int EstimateTokens(string text)
    {
        if (string.IsNullOrEmpty(text)) return 0;
        return (text.Length + CharsPerToken - 1) / CharsPerToken;
    }
}
