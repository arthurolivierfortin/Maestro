using System.Collections.Concurrent;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.Context;

/// <summary>
/// In-memory implementation of IConversationManager.
/// Thread-safe via ConcurrentDictionary. No disk persistence — conversations
/// live only for the duration of an agentic loop execution.
/// </summary>
public class InMemoryConversationManager : IConversationManager
{
    private readonly ConcurrentDictionary<string, Conversation> _conversations = new();

    /// <inheritdoc />
    public string CreateConversation(string? systemPrompt = null)
    {
        var conversationId = Guid.NewGuid().ToString("N");
        var conversation = new Conversation(conversationId, systemPrompt);
        _conversations[conversationId] = conversation;
        return conversationId;
    }

    /// <inheritdoc />
    public string CreateConversation(string? systemPrompt, string conversationId)
    {
        var conversation = new Conversation(conversationId, systemPrompt);
        _conversations[conversationId] = conversation;
        return conversationId;
    }

    /// <inheritdoc />
    public void AddMessage(string conversationId, string role, string content)
    {
        if (!_conversations.TryGetValue(conversationId, out var conversation))
            throw new InvalidOperationException($"Conversation '{conversationId}' not found.");

        conversation.AddMessage(role, content);
    }

    /// <inheritdoc />
    public List<ChatMessage> GetMessages(string conversationId)
    {
        if (!_conversations.TryGetValue(conversationId, out var conversation))
            throw new InvalidOperationException($"Conversation '{conversationId}' not found.");

        return conversation.GetAllMessages()
            .Select(m => new ChatMessage { Role = m.Role, Content = m.Content })
            .ToList();
    }

    /// <inheritdoc />
    public ConversationState? GetState(string conversationId)
    {
        if (!_conversations.TryGetValue(conversationId, out var conversation))
            return null;

        return conversation.GetState();
    }

    /// <inheritdoc />
    public void CleanupConversation(string conversationId)
    {
        _conversations.TryRemove(conversationId, out _);
    }
}
