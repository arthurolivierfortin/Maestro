using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Fitness;

/// <summary>
/// File system based repository for task entropy data.
/// </summary>
public class FileSystemTaskEntropyRepository : ITaskEntropyRepository
{
    private readonly string _storagePath;
    private readonly ILogger<FileSystemTaskEntropyRepository>? _logger;
    private readonly Dictionary<string, TaskEntropy> _cache = new();
    private readonly SemaphoreSlim _lock = new(1, 1);
    private bool _initialized = false;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public FileSystemTaskEntropyRepository(
        string storagePath,
        ILogger<FileSystemTaskEntropyRepository>? logger = null)
    {
        _storagePath = storagePath;
        _logger = logger;
    }

    private static string GetKey(string entityId, string entityType) => $"{entityType}:{entityId}";

    public async Task<TaskEntropy?> GetAsync(string entityId, string entityType = "model", CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        var key = GetKey(entityId, entityType);

        await _lock.WaitAsync(ct);
        try
        {
            return _cache.GetValueOrDefault(key);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<IReadOnlyList<TaskEntropy>> GetAllAsync(CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        await _lock.WaitAsync(ct);
        try
        {
            return _cache.Values.ToList();
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<IReadOnlyList<TaskEntropy>> GetByEntityTypeAsync(string entityType, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        await _lock.WaitAsync(ct);
        try
        {
            return _cache.Values
                .Where(e => e.EntityType.Equals(entityType, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<TaskEntropy> SaveAsync(TaskEntropy entropy, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        var key = GetKey(entropy.EntityId, entropy.EntityType);
        var updatedEntropy = entropy with { CalculatedAt = DateTimeOffset.UtcNow };

        await _lock.WaitAsync(ct);
        try
        {
            _cache[key] = updatedEntropy;
            await PersistCacheAsync(ct);
        }
        finally
        {
            _lock.Release();
        }

        _logger?.LogDebug("Saved task entropy for {EntityType}:{EntityId}", entropy.EntityType, entropy.EntityId);
        return updatedEntropy;
    }

    public async Task DeleteAsync(string entityId, string entityType = "model", CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        var key = GetKey(entityId, entityType);

        await _lock.WaitAsync(ct);
        try
        {
            if (_cache.Remove(key))
            {
                await PersistCacheAsync(ct);
                _logger?.LogDebug("Deleted task entropy for {EntityType}:{EntityId}", entityType, entityId);
            }
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<TaskEntropy> RecordTaskAsync(
        string entityId,
        string entityType,
        string taskType,
        CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        var key = GetKey(entityId, entityType);

        await _lock.WaitAsync(ct);
        try
        {
            var existing = _cache.GetValueOrDefault(key);

            TaskEntropy updated;
            if (existing != null)
            {
                // Add task to existing distribution
                updated = existing.AddTask(taskType);
            }
            else
            {
                // Create new entropy with this task
                updated = TaskEntropy.CreateSpecialized(entityId, entityType, taskType, 1);
            }

            _cache[key] = updated;
            await PersistCacheAsync(ct);

            _logger?.LogDebug(
                "Recorded task {TaskType} for {EntityType}:{EntityId}, entropy={Entropy:F3}",
                taskType, entityType, entityId, updated.EntropyValue);

            return updated;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<TaskEntropy> GetOrCreateAsync(
        string entityId,
        string entityType = "model",
        CancellationToken ct = default)
    {
        var existing = await GetAsync(entityId, entityType, ct);
        if (existing != null)
        {
            return existing;
        }

        // Create empty entropy record
        var newEntropy = new TaskEntropy
        {
            EntityId = entityId,
            EntityType = entityType,
            TaskDistribution = new Dictionary<string, int>(),
            EntropyValue = 0,
            TotalTasks = 0
        };

        return await SaveAsync(newEntropy, ct);
    }

    private async Task EnsureInitializedAsync(CancellationToken ct)
    {
        if (_initialized) return;

        await _lock.WaitAsync(ct);
        try
        {
            if (_initialized) return;

            // Ensure directory exists
            var directory = Path.GetDirectoryName(_storagePath);
            if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            // Load from file if exists
            if (File.Exists(_storagePath))
            {
                try
                {
                    var json = await File.ReadAllTextAsync(_storagePath, ct);
                    var entropies = JsonSerializer.Deserialize<List<TaskEntropy>>(json, JsonOptions);
                    if (entropies != null)
                    {
                        foreach (var entropy in entropies)
                        {
                            var key = GetKey(entropy.EntityId, entropy.EntityType);
                            _cache[key] = entropy;
                        }
                    }
                    _logger?.LogInformation("Loaded {Count} task entropy records from {Path}", _cache.Count, _storagePath);
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex, "Failed to load task entropy from {Path}, starting fresh", _storagePath);
                }
            }

            _initialized = true;
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task PersistCacheAsync(CancellationToken ct)
    {
        var entropies = _cache.Values.ToList();
        var json = JsonSerializer.Serialize(entropies, JsonOptions);
        await File.WriteAllTextAsync(_storagePath, json, ct);
    }
}
