using Maestro.Application.Interfaces;

namespace Maestro.Infrastructure.Context;

/// <summary>
/// Factory for creating context processors based on strategy.
/// </summary>
public class ContextProcessorFactory
{
    private readonly IServiceProvider? _serviceProvider;

    public ContextProcessorFactory(IServiceProvider? serviceProvider = null)
    {
        _serviceProvider = serviceProvider;
    }

    /// <summary>
    /// Create a context processor for the given strategy.
    /// </summary>
    public IContextProcessor Create(string strategy)
    {
        return strategy.ToLowerInvariant() switch
        {
            "sliding-window" or "sliding" or "window" => new SlidingWindowContextProcessor(),
            "none" or "passthrough" => new PassthroughContextProcessor(),
            // Future strategies:
            // "summarize" => new SummarizingContextProcessor(_serviceProvider),
            // "rag" => new RagContextProcessor(_serviceProvider),
            _ => new SlidingWindowContextProcessor() // Default to sliding window
        };
    }
}

/// <summary>
/// Passthrough processor that doesn't modify context.
/// Used when context management is disabled.
/// </summary>
public class PassthroughContextProcessor : IContextProcessor
{
    public Task<ContextResult> ProcessAsync(ContextInput input, CancellationToken ct = default)
    {
        var messages = new List<ChatMessage>(input.Messages);

        // Add system prompt if provided and not already present
        if (!string.IsNullOrEmpty(input.SystemPrompt) &&
            !messages.Any(m => m.Role == "system"))
        {
            messages.Insert(0, ChatMessage.System(input.SystemPrompt));
        }

        // Add new message if provided
        if (input.NewMessage != null)
        {
            messages.Add(input.NewMessage);
        }

        // Estimate tokens
        var totalChars = messages.Sum(m => m.Content?.Length ?? 0);
        var estimatedTokens = (totalChars + 3) / 4;

        return Task.FromResult(new ContextResult
        {
            Messages = messages,
            EstimatedTokens = estimatedTokens,
            WasTruncated = false,
            MessagesRemoved = 0,
            OriginalMessageCount = input.Messages.Count
        });
    }
}
