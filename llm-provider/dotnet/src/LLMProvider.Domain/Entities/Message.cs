using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Domain.Entities;

/// <summary>
/// Represents a single message in a conversation.
/// </summary>
public sealed class Message
{
    /// <summary>
    /// Unique identifier for this message.
    /// </summary>
    public MessageId Id { get; }

    /// <summary>
    /// The role of the message sender.
    /// </summary>
    public MessageRole Role { get; }

    /// <summary>
    /// The content of the message.
    /// </summary>
    public string Content { get; }

    /// <summary>
    /// Token usage for this message (if available).
    /// </summary>
    public TokenUsage? TokenUsage { get; }

    /// <summary>
    /// The model used to generate this message (for assistant messages).
    /// </summary>
    public ModelId? Model { get; }

    /// <summary>
    /// The provider that generated this message (for assistant messages).
    /// </summary>
    public ProviderType? Provider { get; }

    /// <summary>
    /// When this message was created.
    /// </summary>
    public DateTimeOffset CreatedAt { get; }

    /// <summary>
    /// Creates a new Message.
    /// </summary>
    /// <param name="id">The message ID.</param>
    /// <param name="role">The message role.</param>
    /// <param name="content">The message content.</param>
    /// <param name="tokenUsage">Optional token usage.</param>
    /// <param name="model">Optional model ID (for assistant messages).</param>
    /// <param name="provider">Optional provider type (for assistant messages).</param>
    /// <param name="createdAt">Optional creation timestamp.</param>
    /// <exception cref="ArgumentException">Thrown when content is null or whitespace.</exception>
    public Message(
        MessageId id,
        MessageRole role,
        string content,
        TokenUsage? tokenUsage = null,
        ModelId? model = null,
        ProviderType? provider = null,
        DateTimeOffset? createdAt = null)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            throw new ArgumentException("Message content cannot be null or whitespace.", nameof(content));
        }

        Id = id;
        Role = role;
        Content = content;
        TokenUsage = tokenUsage;
        Model = model;
        Provider = provider;
        CreatedAt = createdAt ?? DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Creates a user message.
    /// </summary>
    public static Message CreateUserMessage(string content, TokenUsage? tokenUsage = null) =>
        new(MessageId.New(), MessageRole.User, content, tokenUsage);

    /// <summary>
    /// Creates a system message.
    /// </summary>
    public static Message CreateSystemMessage(string content) =>
        new(MessageId.New(), MessageRole.System, content);

    /// <summary>
    /// Creates an assistant message.
    /// </summary>
    public static Message CreateAssistantMessage(
        string content,
        TokenUsage tokenUsage,
        ModelId model,
        ProviderType provider) =>
        new(MessageId.New(), MessageRole.Assistant, content, tokenUsage, model, provider);
}
