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
    /// Returns an existing conversation by ID, or creates a new one if it doesn't exist.
    /// Used for persistent conversations that survive across invocations (e.g., agent sessions).
    /// If the conversation already exists, the systemPrompt parameter is ignored.
    /// </summary>
    string CreateOrGetConversation(string conversationId, string? systemPrompt = null);

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
