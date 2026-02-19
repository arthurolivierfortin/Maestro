using LLMProvider.Application.Interfaces.Providers;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace LLMProvider.Infrastructure.Providers;

/// <summary>
/// Factory for managing and accessing LLM provider instances.
/// </summary>
public sealed class LLMProviderFactory : ILLMProviderFactory
{
    private readonly Dictionary<ProviderType, ILLMProvider> _providers = new();
    private readonly ILogger<LLMProviderFactory> _logger;

    public LLMProviderFactory(
        IEnumerable<ILLMProvider> providers,
        ILogger<LLMProviderFactory> logger)
    {
        _logger = logger;

        foreach (var provider in providers)
        {
            if (_providers.TryAdd(provider.ProviderType, provider))
            {
                _logger.LogInformation(
                    "Registered LLM provider: {ProviderName} ({ProviderType})",
                    provider.Name,
                    provider.ProviderType);
            }
            else
            {
                _logger.LogWarning(
                    "Duplicate provider registration attempted for {ProviderType}",
                    provider.ProviderType);
            }
        }
    }

    /// <inheritdoc />
    public ILLMProvider GetProvider(ProviderType type)
    {
        if (_providers.TryGetValue(type, out var provider))
        {
            return provider;
        }

        throw new InvalidOperationException($"No provider registered for type '{type}'.");
    }

    /// <inheritdoc />
    public bool TryGetProvider(ProviderType type, out ILLMProvider? provider)
    {
        return _providers.TryGetValue(type, out provider);
    }

    /// <inheritdoc />
    public async Task<ILLMProvider> GetProviderForModelAsync(
        ModelId modelId,
        CancellationToken cancellationToken = default)
    {
        // Check each available provider for the model
        var availableProviders = await GetAvailableProvidersAsync(cancellationToken);

        foreach (var provider in availableProviders)
        {
            try
            {
                var models = await provider.GetAvailableModelsAsync(cancellationToken);
                if (models.Any(m => m.Id.Value.Equals(modelId.Value, StringComparison.OrdinalIgnoreCase)))
                {
                    return provider;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Error checking models for provider {Provider}",
                    provider.ProviderType);
            }
        }

        throw new InvalidOperationException($"No provider found that supports model '{modelId}'.");
    }

    /// <inheritdoc />
    public IEnumerable<ProviderType> GetRegisteredProviders()
    {
        return _providers.Keys;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<ILLMProvider>> GetAvailableProvidersAsync(
        CancellationToken cancellationToken = default)
    {
        var availableProviders = new List<ILLMProvider>();

        foreach (var provider in _providers.Values)
        {
            try
            {
                if (await provider.IsAvailableAsync(cancellationToken))
                {
                    availableProviders.Add(provider);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Error checking availability for provider {Provider}",
                    provider.ProviderType);
            }
        }

        return availableProviders.AsReadOnly();
    }
}
