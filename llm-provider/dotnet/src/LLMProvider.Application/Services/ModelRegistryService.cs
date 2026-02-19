using System.Collections.Concurrent;
using LLMProvider.Application.Interfaces;
using LLMProvider.Application.Interfaces.Providers;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace LLMProvider.Application.Services;

/// <summary>
/// Service for discovering and caching available models from all providers.
/// </summary>
public sealed class ModelRegistryService : IModelRegistry
{
    private readonly ILLMProviderFactory _providerFactory;
    private readonly ILogger<ModelRegistryService> _logger;
    private readonly ConcurrentDictionary<ModelId, ModelInfo> _modelCache = new();
    private readonly SemaphoreSlim _refreshLock = new(1, 1);
    private DateTimeOffset _lastRefresh = DateTimeOffset.MinValue;
    private readonly TimeSpan _cacheExpiration = TimeSpan.FromMinutes(5);

    public ModelRegistryService(
        ILLMProviderFactory providerFactory,
        ILogger<ModelRegistryService> logger)
    {
        _providerFactory = providerFactory;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<ModelInfo>> GetAllModelsAsync(CancellationToken cancellationToken = default)
    {
        await EnsureCacheAsync(cancellationToken);
        return _modelCache.Values.ToList().AsReadOnly();
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<ModelInfo>> GetModelsByProviderAsync(
        ProviderType provider,
        CancellationToken cancellationToken = default)
    {
        await EnsureCacheAsync(cancellationToken);
        return _modelCache.Values
            .Where(m => m.Provider == provider)
            .ToList()
            .AsReadOnly();
    }

    /// <inheritdoc />
    public async Task<ModelInfo?> GetModelAsync(ModelId modelId, CancellationToken cancellationToken = default)
    {
        await EnsureCacheAsync(cancellationToken);
        return _modelCache.GetValueOrDefault(modelId);
    }

    /// <inheritdoc />
    public async Task RefreshAsync(CancellationToken cancellationToken = default)
    {
        await _refreshLock.WaitAsync(cancellationToken);
        try
        {
            await RefreshCacheInternalAsync(cancellationToken);
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<ModelInfo>> GetModelsByCapabilityAsync(
        string capability,
        CancellationToken cancellationToken = default)
    {
        await EnsureCacheAsync(cancellationToken);
        return _modelCache.Values
            .Where(m => m.HasCapability(capability))
            .ToList()
            .AsReadOnly();
    }

    private async Task EnsureCacheAsync(CancellationToken cancellationToken)
    {
        if (DateTimeOffset.UtcNow - _lastRefresh < _cacheExpiration && !_modelCache.IsEmpty)
        {
            return;
        }

        await _refreshLock.WaitAsync(cancellationToken);
        try
        {
            // Double-check after acquiring lock
            if (DateTimeOffset.UtcNow - _lastRefresh < _cacheExpiration && !_modelCache.IsEmpty)
            {
                return;
            }

            await RefreshCacheInternalAsync(cancellationToken);
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    private async Task RefreshCacheInternalAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Refreshing model registry cache");

        var providers = await _providerFactory.GetAvailableProvidersAsync(cancellationToken);
        var allModels = new List<ModelInfo>();

        // Fetch models from all providers in parallel
        var tasks = providers.Select(async provider =>
        {
            try
            {
                var models = await provider.GetAvailableModelsAsync(cancellationToken);
                return (Provider: provider.ProviderType, Models: models, Success: true);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Failed to fetch models from provider {Provider}",
                    provider.ProviderType);
                return (Provider: provider.ProviderType, Models: (IReadOnlyList<ModelInfo>)[], Success: false);
            }
        });

        var results = await Task.WhenAll(tasks);

        // Update cache
        _modelCache.Clear();
        foreach (var result in results.Where(r => r.Success))
        {
            foreach (var model in result.Models)
            {
                _modelCache.TryAdd(model.Id, model);
            }
        }

        _lastRefresh = DateTimeOffset.UtcNow;

        _logger.LogInformation(
            "Model registry cache refreshed. {ModelCount} models from {ProviderCount} providers",
            _modelCache.Count,
            results.Count(r => r.Success));
    }
}
