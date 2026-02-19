using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Domain.Entities;

/// <summary>
/// Represents a conversation containing a sequence of messages.
/// This is the aggregate root for conversation management.
/// </summary>
public sealed class Conversation
{
    private readonly List<Message> _messages;

    /// <summary>
    /// Unique identifier for this conversation.
    /// </summary>
    public ConversationId Id { get; }

    /// <summary>
    /// Optional title/name for the conversation.
    /// </summary>
    public string? Title { get; private set; }

    /// <summary>
    /// When this conversation was created.
    /// </summary>
    public DateTimeOffset CreatedAt { get; }

    /// <summary>
    /// When this conversation was last updated.
    /// </summary>
    public DateTimeOffset UpdatedAt { get; private set; }

    /// <summary>
    /// The messages in this conversation, in chronological order.
    /// </summary>
    public IReadOnlyList<Message> Messages => _messages.AsReadOnly();

    /// <summary>
    /// Total token usage across all messages in this conversation.
    /// </summary>
    public TokenUsage TotalTokenUsage =>
        _messages
            .Where(m => m.TokenUsage is not null)
            .Aggregate(TokenUsage.Zero, (acc, m) => acc + m.TokenUsage!);

    /// <summary>
    /// Number of messages in this conversation.
    /// </summary>
    public int MessageCount => _messages.Count;

    /// <summary>
    /// Whether this conversation has any messages.
    /// </summary>
    public bool IsEmpty => _messages.Count == 0;

    /// <summary>
    /// Creates a new Conversation.
    /// </summary>
    /// <param name="id">The conversation ID.</param>
    /// <param name="title">Optional title.</param>
    /// <param name="createdAt">Optional creation timestamp.</param>
    public Conversation(ConversationId id, string? title = null, DateTimeOffset? createdAt = null)
    {
        Id = id;
        Title = title;
        CreatedAt = createdAt ?? DateTimeOffset.UtcNow;
        UpdatedAt = CreatedAt;
        _messages = [];
    }

    /// <summary>
    /// Creates a new Conversation with an optional system message.
    /// </summary>
    /// <param name="title">Optional title.</param>
    /// <param name="systemPrompt">Optional system prompt.</param>
    /// <returns>A new Conversation instance.</returns>
    public static Conversation Create(string? title = null, string? systemPrompt = null)
    {
        var conversation = new Conversation(ConversationId.New(), title);

        if (!string.IsNullOrWhiteSpace(systemPrompt))
        {
            conversation.AddMessage(Message.CreateSystemMessage(systemPrompt));
        }

        return conversation;
    }

    /// <summary>
    /// Adds a message to this conversation.
    /// </summary>
    /// <param name="message">The message to add.</param>
    /// <exception cref="ArgumentNullException">Thrown when message is null.</exception>
    public void AddMessage(Message message)
    {
        ArgumentNullException.ThrowIfNull(message);
        _messages.Add(message);
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Adds a user message to this conversation.
    /// </summary>
    /// <param name="content">The message content.</param>
    /// <returns>The created message.</returns>
    public Message AddUserMessage(string content)
    {
        var message = Message.CreateUserMessage(content);
        AddMessage(message);
        return message;
    }

    /// <summary>
    /// Adds an assistant message to this conversation.
    /// </summary>
    /// <param name="content">The response content.</param>
    /// <param name="tokenUsage">The token usage.</param>
    /// <param name="model">The model used.</param>
    /// <param name="provider">The provider used.</param>
    /// <returns>The created message.</returns>
    public Message AddAssistantMessage(
        string content,
        TokenUsage tokenUsage,
        ModelId model,
        ProviderType provider)
    {
        var message = Message.CreateAssistantMessage(content, tokenUsage, model, provider);
        AddMessage(message);
        return message;
    }

    /// <summary>
    /// Updates the conversation title.
    /// </summary>
    /// <param name="title">The new title.</param>
    public void SetTitle(string? title)
    {
        Title = title;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Gets the last N messages from this conversation.
    /// </summary>
    /// <param name="count">Number of messages to retrieve.</param>
    /// <returns>The last N messages.</returns>
    public IReadOnlyList<Message> GetLastMessages(int count)
    {
        if (count <= 0)
        {
            return [];
        }

        return _messages.TakeLast(count).ToList().AsReadOnly();
    }

    /// <summary>
    /// Gets messages of a specific role.
    /// </summary>
    /// <param name="role">The role to filter by.</param>
    /// <returns>Messages with the specified role.</returns>
    public IReadOnlyList<Message> GetMessagesByRole(MessageRole role) =>
        _messages.Where(m => m.Role == role).ToList().AsReadOnly();
}
