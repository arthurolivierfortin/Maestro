using LLMProvider.Domain.Entities;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.Interfaces.Repositories;

/// <summary>
/// Repository interface for conversation persistence.
/// </summary>
public interface IConversationRepository
{
    /// <summary>
    /// Gets a conversation by its ID.
    /// </summary>
    /// <param name="id">The conversation ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The conversation if found; otherwise, null.</returns>
    Task<Conversation?> GetByIdAsync(ConversationId id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets all conversations.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>All conversations.</returns>
    Task<IReadOnlyList<Conversation>> GetAllAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets conversations with pagination.
    /// </summary>
    /// <param name="skip">Number of conversations to skip.</param>
    /// <param name="take">Number of conversations to take.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Paginated list of conversations.</returns>
    Task<IReadOnlyList<Conversation>> GetPagedAsync(
        int skip,
        int take,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a new conversation.
    /// </summary>
    /// <param name="conversation">The conversation to create.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The created conversation.</returns>
    Task<Conversation> CreateAsync(Conversation conversation, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates an existing conversation.
    /// </summary>
    /// <param name="conversation">The conversation to update.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task UpdateAsync(Conversation conversation, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a conversation.
    /// </summary>
    /// <param name="id">The conversation ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>True if deleted; false if not found.</returns>
    Task<bool> DeleteAsync(ConversationId id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks if a conversation exists.
    /// </summary>
    /// <param name="id">The conversation ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>True if exists; otherwise, false.</returns>
    Task<bool> ExistsAsync(ConversationId id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the total count of conversations.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Total conversation count.</returns>
    Task<int> CountAsync(CancellationToken cancellationToken = default);
}
