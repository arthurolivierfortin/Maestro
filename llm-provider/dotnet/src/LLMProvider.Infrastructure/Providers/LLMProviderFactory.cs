using System.Text.Json;
using LLMProvider.Application.Interfaces.Providers;
using LLMProvider.Application.Options;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LLMProvider.Infrastructure.Providers;

/// <summary>
/// Factory for managing and accessing LLM provider instances.
/// Supports conflict detection and user-configurable priority when
/// multiple providers serve the same model.
/// </summary>
public sealed class LLMProviderFactory : ILLMProviderFactory
{
    private readonly Dictionary<ProviderType, ILLMProvider> _providers = new();
    private readonly ILogger<LLMProviderFactory> _logger;
    private readonly ProviderPriorityOptions _priorityOptions;
    private readonly string _priorityFilePath;
    private List<ModelConflict> _conflicts = new();

    public LLMProviderFactory(
        IEnumerable<ILLMProvider> providers,
        IOptions<ProviderPriorityOptions> priorityOptions,
        ILogger<LLMProviderFactory> logger)
    {
        _logger = logger;
        _priorityOptions = priorityOptions.Value;

        // Determine priority file path (next to the running assembly)
        var baseDir = AppContext.BaseDirectory;
        _priorityFilePath = Path.Combine(baseDir, "provider-priority.json");

        // Load persisted preferences from file (overrides config-based ones)
        LoadPersistedPreferences();

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
        var availableProviders = await GetAvailableProvidersAsync(cancellationToken);

        // Check user-configured priority first
        if (_priorityOptions.ModelPreferences.TryGetValue(modelId.Value, out var preferredName)
            && Enum.TryParse<ProviderType>(preferredName, true, out var preferredType))
        {
            var preferred = availableProviders.FirstOrDefault(p => p.ProviderType == preferredType);
            if (preferred != null)
            {
                try
                {
                    var models = await preferred.GetAvailableModelsAsync(cancellationToken);
                    if (models.Any(m => m.Id.Value.Equals(modelId.Value, StringComparison.OrdinalIgnoreCase)))
                    {
                        _logger.LogDebug(
                            "Using preferred provider {Provider} for model {Model}",
                            preferredType, modelId.Value);
                        return preferred;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(
                        ex,
                        "Preferred provider {Provider} failed model check for {Model}, falling back",
                        preferredType, modelId.Value);
                }
            }
        }

        // Fallback: first provider that has the model
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

    /// <inheritdoc />
    public async Task<IReadOnlyList<ModelConflict>> DetectModelConflictsAsync(
        CancellationToken cancellationToken = default)
    {
        var modelProviders = new Dictionary<string, List<ProviderType>>(StringComparer.OrdinalIgnoreCase);

        foreach (var provider in _providers.Values)
        {
            try
            {
                if (!await provider.IsAvailableAsync(cancellationToken))
                {
                    continue;
                }

                var models = await provider.GetAvailableModelsAsync(cancellationToken);
                foreach (var model in models)
                {
                    if (!modelProviders.ContainsKey(model.Id.Value))
                    {
                        modelProviders[model.Id.Value] = new List<ProviderType>();
                    }
                    modelProviders[model.Id.Value].Add(provider.ProviderType);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Error scanning models for provider {Provider} during conflict detection",
                    provider.ProviderType);
            }
        }

        _conflicts = modelProviders
            .Where(kv => kv.Value.Count > 1)
            .Select(kv => new ModelConflict(kv.Key, kv.Value, GetPreferredForModel(kv.Key)))
            .ToList();

        if (_conflicts.Count > 0)
        {
            _logger.LogInformation(
                "Detected {Count} model conflict(s): {Models}",
                _conflicts.Count,
                string.Join(", ", _conflicts.Select(c => c.ModelId)));
        }

        return _conflicts.AsReadOnly();
    }

    /// <inheritdoc />
    public void SetModelPreference(string modelId, ProviderType preferredProvider)
    {
        _priorityOptions.ModelPreferences[modelId] = preferredProvider.ToString();
        _logger.LogInformation(
            "Set provider preference for model {Model} to {Provider}",
            modelId, preferredProvider);

        PersistPreferences();
    }

    /// <summary>
    /// Gets the preferred provider type for a model from config, or null if none configured.
    /// </summary>
    private ProviderType? GetPreferredForModel(string modelId)
    {
        if (_priorityOptions.ModelPreferences.TryGetValue(modelId, out var preferredName)
            && Enum.TryParse<ProviderType>(preferredName, true, out var preferredType))
        {
            return preferredType;
        }
        return null;
    }

    /// <summary>
    /// Loads persisted preferences from provider-priority.json.
    /// </summary>
    private void LoadPersistedPreferences()
    {
        try
        {
            if (!File.Exists(_priorityFilePath))
            {
                return;
            }

            var json = File.ReadAllText(_priorityFilePath);
            var persisted = JsonSerializer.Deserialize<Dictionary<string, string>>(json);
            if (persisted != null)
            {
                foreach (var (key, value) in persisted)
                {
                    _priorityOptions.ModelPreferences[key] = value;
                }
                _logger.LogInformation(
                    "Loaded {Count} provider preference(s) from {Path}",
                    persisted.Count, _priorityFilePath);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to load provider preferences from {Path}",
                _priorityFilePath);
        }
    }

    /// <summary>
    /// Persists current preferences to provider-priority.json.
    /// </summary>
    private void PersistPreferences()
    {
        try
        {
            var json = JsonSerializer.Serialize(
                _priorityOptions.ModelPreferences,
                new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(_priorityFilePath, json);
            _logger.LogDebug("Persisted provider preferences to {Path}", _priorityFilePath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to persist provider preferences to {Path}",
                _priorityFilePath);
        }
    }
}
