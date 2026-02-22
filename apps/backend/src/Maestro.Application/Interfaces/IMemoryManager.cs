using Maestro.Domain.Entities;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Manages persistent memory stores.
/// Memories persist across sessions and can be queried by category, tags, or block scope.
/// </summary>
public interface IMemoryManager
{
    /// <summary>
    /// Creates a new memory store.
    /// </summary>
    Task<MemoryStore> CreateStoreAsync(string id, string name, string category,
        string? blockId = null, string? sessionId = null, CancellationToken ct = default);

    /// <summary>
    /// Gets a memory store by ID. Returns null if not found.
    /// </summary>
    Task<MemoryStore?> GetStoreAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Lists all memory stores, optionally filtered by category or block.
    /// </summary>
    Task<IReadOnlyList<MemoryStore>> ListStoresAsync(
        string? category = null, string? blockId = null, CancellationToken ct = default);

    /// <summary>
    /// Adds or updates an entry in a memory store.
    /// If the key already exists, it is updated.
    /// </summary>
    Task AddEntryAsync(string storeId, MemoryEntry entry, CancellationToken ct = default);

    /// <summary>
    /// Gets entries from a store, optionally filtered by tags.
    /// </summary>
    Task<IReadOnlyList<MemoryEntry>> GetEntriesAsync(
        string storeId, IEnumerable<string>? tags = null, CancellationToken ct = default);

    /// <summary>
    /// Searches entries across ALL stores by content substring or tags.
    /// </summary>
    Task<IReadOnlyList<(string StoreId, MemoryEntry Entry)>> SearchAsync(
        string query, string? category = null, int maxResults = 20, CancellationToken ct = default);

    /// <summary>
    /// Removes a single entry from a store.
    /// </summary>
    Task RemoveEntryAsync(string storeId, string key, CancellationToken ct = default);

    /// <summary>
    /// Deletes an entire memory store.
    /// </summary>
    Task DeleteStoreAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Marks an entry as used (increments use count, updates lastUsedAt).
    /// </summary>
    Task TouchEntryAsync(string storeId, string key, CancellationToken ct = default);

    /// <summary>
    /// Gets entries relevant to a given context (category + optional tags).
    /// Entries are sorted by relevance: confidence * recency * useCount.
    /// This is what the ContextAssembler calls to inject memories.
    /// </summary>
    Task<IReadOnlyList<MemoryEntry>> GetRelevantEntriesAsync(
        string? category = null, string? blockId = null,
        IEnumerable<string>? tags = null, int maxEntries = 10,
        CancellationToken ct = default);
}
