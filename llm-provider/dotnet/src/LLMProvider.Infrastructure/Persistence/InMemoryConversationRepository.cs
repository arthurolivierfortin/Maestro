using System.Collections.Concurrent;
using LLMProvider.Application.Interfaces.Repositories;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Infrastructure.Persistence;

/// <summary>
/// Thread-safe in-memory implementation of the conversation repository.
/// </summary>
public sealed class InMemoryConversationRepository : IConversationRepository
{
    private readonly ConcurrentDictionary<ConversationId, Conversation> _conversations = new();

    /// <inheritdoc />
    public Task<Conversation?> GetByIdAsync(ConversationId id, CancellationToken cancellationToken = default)
    {
        _conversations.TryGetValue(id, out var conversation);
        return Task.FromResult(conversation);
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<Conversation>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var result = _conversations.Values
            .OrderByDescending(c => c.UpdatedAt)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<IReadOnlyList<Conversation>>(result);
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<Conversation>> GetPagedAsync(
        int skip,
        int take,
        CancellationToken cancellationToken = default)
    {
        var result = _conversations.Values
            .OrderByDescending(c => c.UpdatedAt)
            .Skip(skip)
            .Take(take)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<IReadOnlyList<Conversation>>(result);
    }

    /// <inheritdoc />
    public Task<Conversation> CreateAsync(Conversation conversation, CancellationToken cancellationToken = default)
    {
        if (!_conversations.TryAdd(conversation.Id, conversation))
        {
            throw new InvalidOperationException($"Conversation with ID {conversation.Id} already exists.");
        }

        return Task.FromResult(conversation);
    }

    /// <inheritdoc />
    public Task UpdateAsync(Conversation conversation, CancellationToken cancellationToken = default)
    {
        _conversations[conversation.Id] = conversation;
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task<bool> DeleteAsync(ConversationId id, CancellationToken cancellationToken = default)
    {
        var removed = _conversations.TryRemove(id, out _);
        return Task.FromResult(removed);
    }

    /// <inheritdoc />
    public Task<bool> ExistsAsync(ConversationId id, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(_conversations.ContainsKey(id));
    }

    /// <inheritdoc />
    public Task<int> CountAsync(CancellationToken cancellationToken = default)
    {
        return Task.FromResult(_conversations.Count);
    }

    /// <summary>
    /// Clears all conversations (for testing purposes).
    /// </summary>
    public void Clear()
    {
        _conversations.Clear();
    }
}
