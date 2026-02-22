using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Serialization;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Memory;

/// <summary>
/// File-system backed memory manager.
/// Stores memories as JSON files in a configurable directory.
/// Thread-safe via ConcurrentDictionary cache + file locks.
/// </summary>
public class FileSystemMemoryManager : IMemoryManager
{
    private readonly string _basePath;
    private readonly ILogger<FileSystemMemoryManager>? _logger;
    private readonly ConcurrentDictionary<string, MemoryStore> _cache = new();
    private readonly SemaphoreSlim _fileLock = new(1, 1);
    private bool _loaded;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public FileSystemMemoryManager(string basePath, ILogger<FileSystemMemoryManager>? logger = null)
    {
        _basePath = basePath;
        _logger = logger;
        Directory.CreateDirectory(_basePath);
    }

    public async Task<MemoryStore> CreateStoreAsync(string id, string name, string category,
        string? blockId = null, string? sessionId = null, CancellationToken ct = default)
    {
        await EnsureLoadedAsync(ct);

        if (_cache.ContainsKey(id))
            throw new InvalidOperationException($"Memory store '{id}' already exists.");

        var store = new MemoryStore
        {
            Id = id,
            Name = name,
            Category = category,
            BlockId = blockId,
            SessionId = sessionId,
            CreatedAt = DateTimeOffset.UtcNow,
            LastModifiedAt = DateTimeOffset.UtcNow
        };

        _cache[id] = store;
        await PersistStoreAsync(store, ct);
        _logger?.LogInformation("Memory store created: {Id} ({Category})", id, category);
        return store;
    }

    public async Task<MemoryStore?> GetStoreAsync(string id, CancellationToken ct = default)
    {
        await EnsureLoadedAsync(ct);
        return _cache.TryGetValue(id, out var store) ? store : null;
    }

    public async Task<IReadOnlyList<MemoryStore>> ListStoresAsync(
        string? category = null, string? blockId = null, CancellationToken ct = default)
    {
        await EnsureLoadedAsync(ct);

        var stores = _cache.Values.AsEnumerable();

        if (!string.IsNullOrEmpty(category))
            stores = stores.Where(s => s.Category == category);

        if (!string.IsNullOrEmpty(blockId))
            stores = stores.Where(s => s.BlockId == blockId);

        return stores.OrderBy(s => s.Name).ToList();
    }

    public async Task AddEntryAsync(string storeId, MemoryEntry entry, CancellationToken ct = default)
    {
        await EnsureLoadedAsync(ct);

        if (!_cache.TryGetValue(storeId, out var store))
        {
            // Auto-create the store if it doesn't exist (agents shouldn't manage store lifecycle)
            store = await CreateStoreAsync(storeId, storeId, "general", ct: ct);
        }

        var existing = store.Entries.FindIndex(e => e.Key == entry.Key);
        if (existing >= 0)
        {
            store.Entries[existing] = entry;
        }
        else
        {
            store.Entries.Add(entry);
        }

        store.LastModifiedAt = DateTimeOffset.UtcNow;
        await PersistStoreAsync(store, ct);
    }

    public async Task<IReadOnlyList<MemoryEntry>> GetEntriesAsync(
        string storeId, IEnumerable<string>? tags = null, CancellationToken ct = default)
    {
        await EnsureLoadedAsync(ct);

        if (!_cache.TryGetValue(storeId, out var store))
            return Array.Empty<MemoryEntry>();

        var entries = store.Entries.AsEnumerable();

        if (tags != null)
        {
            var tagSet = new HashSet<string>(tags, StringComparer.OrdinalIgnoreCase);
            entries = entries.Where(e => e.Tags.Any(t => tagSet.Contains(t)));
        }

        return entries.ToList();
    }

    public async Task<IReadOnlyList<(string StoreId, MemoryEntry Entry)>> SearchAsync(
        string query, string? category = null, int maxResults = 20, CancellationToken ct = default)
    {
        await EnsureLoadedAsync(ct);

        var results = new List<(string StoreId, MemoryEntry Entry, double Score)>();
        var queryLower = query.ToLowerInvariant();

        foreach (var store in _cache.Values)
        {
            if (!string.IsNullOrEmpty(category) && store.Category != category)
                continue;

            foreach (var entry in store.Entries)
            {
                var contentLower = entry.Content.ToLowerInvariant();
                var keyLower = entry.Key.ToLowerInvariant();

                if (contentLower.Contains(queryLower) || keyLower.Contains(queryLower)
                    || entry.Tags.Any(t => t.Contains(queryLower, StringComparison.OrdinalIgnoreCase)))
                {
                    var score = entry.Confidence * (1.0 + Math.Log(1 + entry.UseCount));
                    results.Add((store.Id, entry, score));
                }
            }
        }

        return results
            .OrderByDescending(r => r.Score)
            .Take(maxResults)
            .Select(r => (r.StoreId, r.Entry))
            .ToList();
    }

    public async Task RemoveEntryAsync(string storeId, string key, CancellationToken ct = default)
    {
        await EnsureLoadedAsync(ct);

        if (!_cache.TryGetValue(storeId, out var store))
            return;

        store.Entries.RemoveAll(e => e.Key == key);
        store.LastModifiedAt = DateTimeOffset.UtcNow;
        await PersistStoreAsync(store, ct);
    }

    public async Task DeleteStoreAsync(string id, CancellationToken ct = default)
    {
        await EnsureLoadedAsync(ct);

        _cache.TryRemove(id, out _);
        var path = GetStorePath(id);
        if (File.Exists(path))
            File.Delete(path);

        _logger?.LogInformation("Memory store deleted: {Id}", id);
    }

    public async Task TouchEntryAsync(string storeId, string key, CancellationToken ct = default)
    {
        await EnsureLoadedAsync(ct);

        if (!_cache.TryGetValue(storeId, out var store))
            return;

        var entry = store.Entries.FirstOrDefault(e => e.Key == key);
        if (entry == null) return;

        entry.UseCount++;
        entry.LastUsedAt = DateTimeOffset.UtcNow;
        store.LastModifiedAt = DateTimeOffset.UtcNow;
        await PersistStoreAsync(store, ct);
    }

    public async Task<IReadOnlyList<MemoryEntry>> GetRelevantEntriesAsync(
        string? category = null, string? blockId = null,
        IEnumerable<string>? tags = null, int maxEntries = 10,
        CancellationToken ct = default)
    {
        await EnsureLoadedAsync(ct);

        var allEntries = new List<(MemoryEntry Entry, double Score)>();
        var tagSet = tags != null ? new HashSet<string>(tags, StringComparer.OrdinalIgnoreCase) : null;
        var now = DateTimeOffset.UtcNow;

        foreach (var store in _cache.Values)
        {
            if (!string.IsNullOrEmpty(category) && store.Category != category)
                continue;

            if (!string.IsNullOrEmpty(blockId) && store.BlockId != null && store.BlockId != blockId)
                continue;

            foreach (var entry in store.Entries)
            {
                if (tagSet != null && !entry.Tags.Any(t => tagSet.Contains(t)))
                    continue;

                // Score: confidence * recency * usage
                var daysSinceUse = Math.Max(1, (now - entry.LastUsedAt).TotalDays);
                var recency = 1.0 / Math.Log(1 + daysSinceUse);
                var usage = Math.Log(1 + entry.UseCount);
                var score = entry.Confidence * recency * (1.0 + usage);

                allEntries.Add((entry, score));
            }
        }

        return allEntries
            .OrderByDescending(e => e.Score)
            .Take(maxEntries)
            .Select(e => e.Entry)
            .ToList();
    }

    private async Task EnsureLoadedAsync(CancellationToken ct)
    {
        if (_loaded) return;

        await _fileLock.WaitAsync(ct);
        try
        {
            if (_loaded) return;

            foreach (var file in Directory.GetFiles(_basePath, "*.memory.json"))
            {
                try
                {
                    var json = await File.ReadAllTextAsync(file, ct);
                    var store = JsonSerializer.Deserialize<MemoryStore>(json, JsonOptions);
                    if (store != null)
                    {
                        _cache[store.Id] = store;
                    }
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex, "Failed to load memory file: {Path}", file);
                }
            }

            _loaded = true;
            _logger?.LogInformation("Loaded {Count} memory stores from {Path}", _cache.Count, _basePath);
        }
        finally
        {
            _fileLock.Release();
        }
    }

    private async Task PersistStoreAsync(MemoryStore store, CancellationToken ct)
    {
        var path = GetStorePath(store.Id);
        var json = JsonSerializer.Serialize(store, JsonOptions);

        await _fileLock.WaitAsync(ct);
        try
        {
            await File.WriteAllTextAsync(path, json, ct);
        }
        finally
        {
            _fileLock.Release();
        }
    }

    private string GetStorePath(string id)
    {
        var safeId = id.Replace('/', '_').Replace('\\', '_');
        return Path.Combine(_basePath, $"{safeId}.memory.json");
    }
}
