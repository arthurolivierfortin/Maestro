using System.Collections.Concurrent;

namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a conversation as a first-class domain entity.
/// Organizes messages into sections (system, history) with observable state.
/// Lives in memory for the duration of an agentic loop execution.
/// </summary>
public class Conversation
{
    private readonly List<ConversationMessage> _systemMessages = new();
    private readonly List<ConversationMessage> _historyMessages = new();
    private readonly object _lock = new();

    /// <summary>
    /// Unique identifier for this conversation.
    /// </summary>
    public string ConversationId { get; }

    /// <summary>
    /// When this conversation was created.
    /// </summary>
    public DateTimeOffset CreatedAt { get; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// When the last message was added.
    /// </summary>
    public DateTimeOffset LastUpdatedAt { get; private set; } = DateTimeOffset.UtcNow;

    public Conversation(string conversationId, string? systemPrompt = null)
    {
        ConversationId = conversationId ?? throw new ArgumentNullException(nameof(conversationId));

        if (!string.IsNullOrEmpty(systemPrompt))
        {
            _systemMessages.Add(new ConversationMessage("system", systemPrompt));
        }
    }

    /// <summary>
    /// Adds a message to the conversation history.
    /// </summary>
    public void AddMessage(string role, string content)
    {
        if (string.IsNullOrEmpty(role))
            throw new ArgumentException("Role cannot be empty", nameof(role));

        lock (_lock)
        {
            if (role == "system")
            {
                _systemMessages.Add(new ConversationMessage(role, content));
            }
            else
            {
                _historyMessages.Add(new ConversationMessage(role, content));
            }
            LastUpdatedAt = DateTimeOffset.UtcNow;
        }
    }

    /// <summary>
    /// Gets messages from a specific section, or all messages if section is null.
    /// </summary>
    public List<ConversationMessage> GetMessages(string? section = null)
    {
        lock (_lock)
        {
            return section switch
            {
                "system" => new List<ConversationMessage>(_systemMessages),
                "history" => new List<ConversationMessage>(_historyMessages),
                _ => new List<ConversationMessage>(_systemMessages.Concat(_historyMessages))
            };
        }
    }

    /// <summary>
    /// Gets all messages in order: system first, then history.
    /// </summary>
    public List<ConversationMessage> GetAllMessages()
    {
        lock (_lock)
        {
            var all = new List<ConversationMessage>(_systemMessages.Count + _historyMessages.Count);
            all.AddRange(_systemMessages);
            all.AddRange(_historyMessages);
            return all;
        }
    }

    /// <summary>
    /// Gets an observable snapshot of the conversation state.
    /// </summary>
    public ConversationState GetState()
    {
        lock (_lock)
        {
            var systemTokens = EstimateTokens(_systemMessages);
            var historyTokens = EstimateTokens(_historyMessages);

            return new ConversationState
            {
                ConversationId = ConversationId,
                SystemMessageCount = _systemMessages.Count,
                HistoryMessageCount = _historyMessages.Count,
                TotalMessageCount = _systemMessages.Count + _historyMessages.Count,
                EstimatedSystemTokens = systemTokens,
                EstimatedHistoryTokens = historyTokens,
                EstimatedTotalTokens = systemTokens + historyTokens,
                CreatedAt = CreatedAt,
                LastUpdatedAt = LastUpdatedAt
            };
        }
    }

    /// <summary>
    /// Simple token estimation: ~4 chars per token.
    /// </summary>
    private static int EstimateTokens(List<ConversationMessage> messages)
    {
        var totalChars = messages.Sum(m => m.Content?.Length ?? 0);
        return (totalChars + 3) / 4;
    }
}

/// <summary>
/// A single message in a conversation.
/// </summary>
public class ConversationMessage
{
    public string Role { get; }
    public string Content { get; }
    public DateTimeOffset Timestamp { get; }

    public ConversationMessage(string role, string content)
    {
        Role = role;
        Content = content;
        Timestamp = DateTimeOffset.UtcNow;
    }
}

/// <summary>
/// Observable snapshot of conversation state.
/// </summary>
public class ConversationState
{
    public string ConversationId { get; init; } = "";
    public int SystemMessageCount { get; init; }
    public int HistoryMessageCount { get; init; }
    public int TotalMessageCount { get; init; }
    public int EstimatedSystemTokens { get; init; }
    public int EstimatedHistoryTokens { get; init; }
    public int EstimatedTotalTokens { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset LastUpdatedAt { get; init; }
}
