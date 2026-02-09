namespace Maestro.Application.Interfaces;

/// <summary>
/// Critical abstraction for model-agnostic LLM interactions.
/// All agents communicate through this gateway.
/// </summary>
public interface ILLMGateway
{
    Task<LLMResponse> SendAsync(LLMRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Optional streaming API that yields partial content chunks as they arrive.
    /// Implementations may throw NotSupportedException if streaming isn't available.
    /// </summary>
    IAsyncEnumerable<string> StreamAsync(LLMRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Switches the active model on the LLM provider.
    /// Ensures the model is loaded and ready before returning.
    /// No-op if the provider doesn't support model switching.
    /// </summary>
    Task SwitchModelAsync(string modelId, CancellationToken cancellationToken = default) => Task.CompletedTask;
}

/// <summary>
/// A single message in a conversation.
/// </summary>
public class ChatMessage
{
    public required string Role { get; init; }
    public required string Content { get; init; }

    public static ChatMessage System(string content) => new() { Role = "system", Content = content };
    public static ChatMessage User(string content) => new() { Role = "user", Content = content };
    public static ChatMessage Assistant(string content) => new() { Role = "assistant", Content = content };
}

/// <summary>
/// Model-agnostic LLM request.
/// </summary>
public class LLMRequest
{
    /// <summary>
    /// Raw prompt (for legacy/simple requests).
    /// </summary>
    public string? Prompt { get; init; }

    /// <summary>
    /// Conversation messages (preferred for chat models).
    /// When provided, the gateway will format these with the appropriate chat template.
    /// </summary>
    public List<ChatMessage>? Messages { get; init; }

    /// <summary>
    /// Optional system prompt (used when Messages is provided).
    /// </summary>
    public string? SystemPrompt { get; init; }

    /// <summary>
    /// Optional model ID to use for this request.
    /// </summary>
    public string? ModelId { get; init; }

    /// <summary>
    /// Maximum tokens to generate.
    /// </summary>
    public int? MaxNewTokens { get; init; }

    /// <summary>
    /// Sampling temperature (0.0 = deterministic).
    /// </summary>
    public float? Temperature { get; init; }
}

/// <summary>
/// Model-agnostic LLM response.
/// </summary>
public class LLMResponse
{
    public required string Content { get; init; }
    public int PromptTokens { get; init; }
    public int CompletionTokens { get; init; }
    public int TotalTokens { get; init; }
    public string? Model { get; init; }
}
