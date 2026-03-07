using System.Collections.Concurrent;
using Maestro.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Pricing;

/// <summary>
/// Provides model pricing by fetching from LLM-Provider and caching in memory.
/// Cache TTL: 5 minutes. Fallback: $5/$15 per million (cloud), $0/$0 (local).
/// </summary>
public class ModelPricingService : IModelPricingService
{
    private readonly ILLMProviderService _providerService;
    private readonly ILogger<ModelPricingService>? _logger;

    private readonly ConcurrentDictionary<string, ModelPricing> _cache = new(StringComparer.OrdinalIgnoreCase);
    private DateTimeOffset _cacheExpiry = DateTimeOffset.MinValue;
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    // Known local model name fragments
    private static readonly string[] LocalModelFragments = { "qwen", "llama", "smollm", "local", "mistral", "mixtral", "phi", "gemma", "deepseek" };

    public ModelPricingService(ILLMProviderService providerService, ILogger<ModelPricingService>? logger = null)
    {
        _providerService = providerService ?? throw new ArgumentNullException(nameof(providerService));
        _logger = logger;
    }

    public async Task<ModelPricing?> GetPricingAsync(string modelId, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(modelId))
            return null;

        await EnsureCacheAsync(ct);

        if (_cache.TryGetValue(modelId, out var pricing))
            return pricing;

        // Fallback for unknown models
        return GetFallbackPricing(modelId);
    }

    public async Task<decimal> EstimateCostAsync(string modelId, int promptTokens, int completionTokens, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(modelId) || (promptTokens == 0 && completionTokens == 0))
            return 0m;

        var pricing = await GetPricingAsync(modelId, ct);
        if (pricing == null)
            return 0m;

        return (promptTokens * pricing.InputPricePerMillion / 1_000_000m)
             + (completionTokens * pricing.OutputPricePerMillion / 1_000_000m);
    }

    private async Task EnsureCacheAsync(CancellationToken ct)
    {
        if (DateTimeOffset.UtcNow < _cacheExpiry)
            return;

        // Only one thread refreshes the cache at a time
        if (!await _refreshLock.WaitAsync(0, ct))
            return; // Another thread is refreshing; use stale cache

        try
        {
            if (DateTimeOffset.UtcNow < _cacheExpiry)
                return; // Double-check after acquiring lock

            await RefreshCacheAsync(ct);
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    private async Task RefreshCacheAsync(CancellationToken ct)
    {
        try
        {
            var response = await _providerService.GetCompatibleModelsAsync(null, ct);
            foreach (var model in response.Models)
            {
                if (string.IsNullOrEmpty(model.ModelId))
                    continue;

                var inputPrice = model.InputTokenPricePerMillion ?? GetFallbackPricing(model.ModelId)?.InputPricePerMillion ?? 5m;
                var outputPrice = model.OutputTokenPricePerMillion ?? GetFallbackPricing(model.ModelId)?.OutputPricePerMillion ?? 15m;
                var paramB = model.ParametersB > 0 ? (double?)model.ParametersB : null;

                _cache[model.ModelId] = new ModelPricing(inputPrice, outputPrice, paramB);
            }

            _cacheExpiry = DateTimeOffset.UtcNow + CacheTtl;
            _logger?.LogDebug("Model pricing cache refreshed with {Count} models", response.Models.Count);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to refresh model pricing cache, using stale/fallback data");
            // Extend TTL by 1 minute to avoid hammering a down service
            _cacheExpiry = DateTimeOffset.UtcNow + TimeSpan.FromMinutes(1);
        }
    }

    private static ModelPricing? GetFallbackPricing(string modelId)
    {
        var id = modelId.ToLowerInvariant();

        // Local models: free
        if (LocalModelFragments.Any(f => id.Contains(f)))
            return new ModelPricing(0m, 0m, 7);

        // Unknown cloud models: generic fallback
        return new ModelPricing(5m, 15m, null);
    }
}
