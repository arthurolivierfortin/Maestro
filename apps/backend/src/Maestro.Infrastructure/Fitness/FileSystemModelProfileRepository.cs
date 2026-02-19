using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Fitness;

/// <summary>
/// File system based repository for model profiles.
/// </summary>
public class FileSystemModelProfileRepository : IModelProfileRepository
{
    private readonly string _storagePath;
    private readonly ILogger<FileSystemModelProfileRepository>? _logger;
    private readonly Dictionary<string, ModelProfile> _cache = new();
    private readonly SemaphoreSlim _lock = new(1, 1);
    private bool _initialized = false;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public FileSystemModelProfileRepository(
        string storagePath,
        ILogger<FileSystemModelProfileRepository>? logger = null)
    {
        _storagePath = storagePath;
        _logger = logger;
    }

    public async Task<ModelProfile?> GetAsync(string modelId, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        await _lock.WaitAsync(ct);
        try
        {
            return _cache.GetValueOrDefault(modelId);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<IReadOnlyList<ModelProfile>> GetAllAsync(CancellationToken ct = default)
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

    public async Task<IReadOnlyList<ModelProfile>> GetByProviderAsync(string provider, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        await _lock.WaitAsync(ct);
        try
        {
            return _cache.Values
                .Where(p => p.Provider.Equals(provider, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<ModelProfile> SaveAsync(ModelProfile profile, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        var updatedProfile = profile with { UpdatedAt = DateTimeOffset.UtcNow };

        await _lock.WaitAsync(ct);
        try
        {
            _cache[profile.ModelId] = updatedProfile;
            await PersistCacheAsync(ct);
        }
        finally
        {
            _lock.Release();
        }

        _logger?.LogDebug("Saved model profile for {ModelId}", profile.ModelId);
        return updatedProfile;
    }

    public async Task DeleteAsync(string modelId, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        await _lock.WaitAsync(ct);
        try
        {
            if (_cache.Remove(modelId))
            {
                await PersistCacheAsync(ct);
                _logger?.LogDebug("Deleted model profile for {ModelId}", modelId);
            }
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<bool> ExistsAsync(string modelId, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        await _lock.WaitAsync(ct);
        try
        {
            return _cache.ContainsKey(modelId);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<ModelProfile> GetOrCreateAsync(string modelId, string provider, bool isLocal = false, CancellationToken ct = default)
    {
        var existing = await GetAsync(modelId, ct);
        if (existing != null)
        {
            return existing;
        }

        // Create a generic profile
        var newProfile = ModelProfile.CreateGeneric(modelId, provider, isLocal);
        return await SaveAsync(newProfile, ct);
    }

    public async Task InitializeDefaultsAsync(CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            var addedCount = 0;
            foreach (var profile in ModelProfile.DefaultProfiles)
            {
                if (!_cache.ContainsKey(profile.ModelId))
                {
                    _cache[profile.ModelId] = profile;
                    addedCount++;
                }
            }

            if (addedCount > 0)
            {
                await PersistCacheAsync(ct);
                _logger?.LogInformation("Initialized {Count} default model profiles", addedCount);
            }
        }
        finally
        {
            _lock.Release();
        }
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
                    var profiles = JsonSerializer.Deserialize<List<ModelProfile>>(json, JsonOptions);
                    if (profiles != null)
                    {
                        foreach (var profile in profiles)
                        {
                            _cache[profile.ModelId] = profile;
                        }
                    }
                    _logger?.LogInformation("Loaded {Count} model profiles from {Path}", _cache.Count, _storagePath);
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex, "Failed to load model profiles from {Path}, starting fresh", _storagePath);
                }
            }

            // Initialize defaults if cache is empty
            if (_cache.Count == 0)
            {
                foreach (var profile in ModelProfile.DefaultProfiles)
                {
                    _cache[profile.ModelId] = profile;
                }
                await PersistCacheAsync(ct);
                _logger?.LogInformation("Initialized {Count} default model profiles", _cache.Count);
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
        var profiles = _cache.Values.ToList();
        var json = JsonSerializer.Serialize(profiles, JsonOptions);
        await File.WriteAllTextAsync(_storagePath, json, ct);
    }
}
