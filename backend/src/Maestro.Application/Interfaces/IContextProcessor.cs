namespace Maestro.Application.Interfaces;

/// <summary>
/// Processes and optimizes conversation context for LLM calls.
/// Handles token limits, context truncation, and memory strategies.
/// </summary>
public interface IContextProcessor
{
    /// <summary>
    /// Process messages and return optimized context for LLM.
    /// </summary>
    Task<ContextResult> ProcessAsync(
        ContextInput input,
        CancellationToken ct = default);
}

/// <summary>
/// Input for context processing.
/// </summary>
public class ContextInput
{
    /// <summary>
    /// Full message history.
    /// </summary>
    public List<ChatMessage> Messages { get; init; } = new();

    /// <summary>
    /// New message to add (optional).
    /// </summary>
    public ChatMessage? NewMessage { get; init; }

    /// <summary>
    /// System prompt (always kept if specified).
    /// </summary>
    public string? SystemPrompt { get; init; }

    /// <summary>
    /// Configuration for the context strategy.
    /// </summary>
    public ContextConfig Config { get; init; } = new();
}

/// <summary>
/// Configuration for context processing strategies.
/// </summary>
public class ContextConfig
{
    /// <summary>
    /// Strategy type: "sliding-window", "summarize", "rag", "none"
    /// </summary>
    public string Strategy { get; init; } = "sliding-window";

    /// <summary>
    /// Maximum tokens for the context (before response).
    /// </summary>
    public int MaxTokens { get; init; } = 4096;

    /// <summary>
    /// Tokens to reserve for the LLM response.
    /// </summary>
    public int ReserveForResponse { get; init; } = 512;

    /// <summary>
    /// Always keep the system prompt.
    /// </summary>
    public bool KeepSystemPrompt { get; init; } = true;

    /// <summary>
    /// Number of recent messages to always keep (for sliding-window).
    /// </summary>
    public int KeepLastN { get; init; } = 10;

    /// <summary>
    /// Model to use for summarization (for summarize strategy).
    /// </summary>
    public string? SummaryModel { get; init; }

    /// <summary>
    /// Reference to a context block for custom strategies.
    /// </summary>
    public string? ContextBlockRef { get; init; }
}

/// <summary>
/// Result of context processing.
/// </summary>
public class ContextResult
{
    /// <summary>
    /// Optimized messages ready for LLM.
    /// </summary>
    public List<ChatMessage> Messages { get; init; } = new();

    /// <summary>
    /// Estimated token count of the optimized context.
    /// </summary>
    public int EstimatedTokens { get; init; }

    /// <summary>
    /// Whether any messages were truncated/removed.
    /// </summary>
    public bool WasTruncated { get; init; }

    /// <summary>
    /// Number of messages removed.
    /// </summary>
    public int MessagesRemoved { get; init; }

    /// <summary>
    /// Summary of removed content (if summarize strategy used).
    /// </summary>
    public string? Summary { get; init; }

    /// <summary>
    /// Original message count before processing.
    /// </summary>
    public int OriginalMessageCount { get; init; }
}
