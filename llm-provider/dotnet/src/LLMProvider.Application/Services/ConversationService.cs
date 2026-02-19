using LLMProvider.Application.Interfaces.Repositories;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.Exceptions;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace LLMProvider.Application.Services;

/// <summary>
/// Service for managing conversation lifecycle.
/// </summary>
public sealed class ConversationService
{
    private readonly IConversationRepository _repository;
    private readonly ILogger<ConversationService> _logger;

    public ConversationService(
        IConversationRepository repository,
        ILogger<ConversationService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    /// <summary>
    /// Creates a new conversation.
    /// </summary>
    /// <param name="title">Optional title for the conversation.</param>
    /// <param name="systemPrompt">Optional system prompt to initialize the conversation.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The created conversation.</returns>
    public async Task<Conversation> CreateConversationAsync(
        string? title = null,
        string? systemPrompt = null,
        CancellationToken cancellationToken = default)
    {
        var conversation = Conversation.Create(title, systemPrompt);

        await _repository.CreateAsync(conversation, cancellationToken);

        _logger.LogInformation(
            "Created conversation {ConversationId} with title '{Title}'",
            conversation.Id,
            title ?? "(none)");

        return conversation;
    }

    /// <summary>
    /// Gets a conversation by ID.
    /// </summary>
    /// <param name="id">The conversation ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The conversation.</returns>
    /// <exception cref="ConversationNotFoundException">Thrown when conversation is not found.</exception>
    public async Task<Conversation> GetConversationAsync(
        ConversationId id,
        CancellationToken cancellationToken = default)
    {
        var conversation = await _repository.GetByIdAsync(id, cancellationToken);

        if (conversation is null)
        {
            throw new ConversationNotFoundException(id);
        }

        return conversation;
    }

    /// <summary>
    /// Gets a conversation by ID, or null if not found.
    /// </summary>
    /// <param name="id">The conversation ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The conversation or null.</returns>
    public Task<Conversation?> GetConversationOrDefaultAsync(
        ConversationId id,
        CancellationToken cancellationToken = default)
    {
        return _repository.GetByIdAsync(id, cancellationToken);
    }

    /// <summary>
    /// Gets all conversations.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>All conversations.</returns>
    public Task<IReadOnlyList<Conversation>> GetAllConversationsAsync(
        CancellationToken cancellationToken = default)
    {
        return _repository.GetAllAsync(cancellationToken);
    }

    /// <summary>
    /// Gets conversations with pagination.
    /// </summary>
    /// <param name="page">Page number (1-based).</param>
    /// <param name="pageSize">Number of items per page.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Paginated list of conversations.</returns>
    public async Task<(IReadOnlyList<Conversation> Items, int TotalCount)> GetConversationsPagedAsync(
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var skip = (page - 1) * pageSize;
        var items = await _repository.GetPagedAsync(skip, pageSize, cancellationToken);
        var totalCount = await _repository.CountAsync(cancellationToken);

        return (items, totalCount);
    }

    /// <summary>
    /// Updates a conversation's title.
    /// </summary>
    /// <param name="id">The conversation ID.</param>
    /// <param name="title">The new title.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The updated conversation.</returns>
    public async Task<Conversation> UpdateTitleAsync(
        ConversationId id,
        string? title,
        CancellationToken cancellationToken = default)
    {
        var conversation = await GetConversationAsync(id, cancellationToken);
        conversation.SetTitle(title);
        await _repository.UpdateAsync(conversation, cancellationToken);

        _logger.LogInformation(
            "Updated conversation {ConversationId} title to '{Title}'",
            id,
            title ?? "(none)");

        return conversation;
    }

    /// <summary>
    /// Deletes a conversation.
    /// </summary>
    /// <param name="id">The conversation ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>True if deleted; false if not found.</returns>
    public async Task<bool> DeleteConversationAsync(
        ConversationId id,
        CancellationToken cancellationToken = default)
    {
        var deleted = await _repository.DeleteAsync(id, cancellationToken);

        if (deleted)
        {
            _logger.LogInformation("Deleted conversation {ConversationId}", id);
        }

        return deleted;
    }

    /// <summary>
    /// Gets the total token usage for a conversation.
    /// </summary>
    /// <param name="id">The conversation ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The total token usage.</returns>
    public async Task<TokenUsage> GetConversationTokenUsageAsync(
        ConversationId id,
        CancellationToken cancellationToken = default)
    {
        var conversation = await GetConversationAsync(id, cancellationToken);
        return conversation.TotalTokenUsage;
    }
}
