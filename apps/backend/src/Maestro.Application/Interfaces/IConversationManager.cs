using Maestro.Domain.Entities;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Manages conversations as first-class entities.
/// Provides CRUD operations on conversation state during agentic execution.
/// Conversations live in memory for the duration of a block execution.
/// </summary>
public interface IConversationManager
{
    /// <summary>
    /// Creates a new conversation, optionally with a system prompt.
    /// </summary>
    /// <returns>The conversation ID.</returns>
    string CreateConversation(string? systemPrompt = null);

    /// <summary>
    /// Creates a conversation with a specific ID. Used to recreate conversations
    /// lost due to process restart (in-memory storage).
    /// </summary>
    string CreateConversation(string? systemPrompt, string conversationId);

    /// <summary>
    /// Adds a message to an existing conversation.
    /// </summary>
    void AddMessage(string conversationId, string role, string content);

    /// <summary>
    /// Gets all messages from a conversation as ChatMessage list (for LLM compatibility).
    /// </summary>
    List<ChatMessage> GetMessages(string conversationId);

    /// <summary>
    /// Gets the observable state of a conversation (token counts, message counts).
    /// </summary>
    ConversationState? GetState(string conversationId);

    /// <summary>
    /// Cleans up a conversation (removes from memory).
    /// </summary>
    void CleanupConversation(string conversationId);
}
