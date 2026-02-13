using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Maestro.Infrastructure.LLMGateway;

/// <summary>
/// Admin operations for the LLM Provider (health, models, hardware).
/// Calls the Python LLM-Provider API at http://localhost:8000.
/// </summary>
public class LLMProviderService : ILLMProviderService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<LLMProviderService>? _logger;
    private readonly JsonSerializerOptions _jsonOptions;

    public LLMProviderService(
        HttpClient httpClient,
        IOptions<LLMProviderSettings> settings,
        ILogger<LLMProviderService>? logger = null)
    {
        _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        _logger = logger;

        var config = settings?.Value ?? throw new ArgumentNullException(nameof(settings));
        _httpClient.BaseAddress = new Uri(config.BaseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(30);

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            PropertyNameCaseInsensitive = true
        };
    }

    public async Task<LLMProviderHealth> GetHealthAsync(CancellationToken ct = default)
    {
        _logger?.LogDebug("Fetching LLM Provider health");
        var response = await GetAsync<LLMProviderHealth>("/health", ct);
        return response ?? new LLMProviderHealth { Status = "unreachable" };
    }

    public async Task<SystemCapabilities> GetSystemCapabilitiesAsync(CancellationToken ct = default)
    {
        _logger?.LogDebug("Fetching system capabilities");
        var response = await GetAsync<SystemCapabilities>("/v1/system/capabilities", ct);
        return response ?? new SystemCapabilities();
    }

    public async Task<CompatibleModelsResponse> GetCompatibleModelsAsync(string? category = null, CancellationToken ct = default)
    {
        _logger?.LogDebug("Fetching compatible models (category: {Category})", category ?? "all");
        var path = "/v1/models/compatible";
        if (!string.IsNullOrEmpty(category))
            path += $"?category={Uri.EscapeDataString(category)}";

        var response = await GetAsync<CompatibleModelsResponse>(path, ct);
        return response ?? new CompatibleModelsResponse();
    }

    public async Task<LocalModelsResponse> GetLocalModelsAsync(CancellationToken ct = default)
    {
        _logger?.LogDebug("Fetching local models");
        var response = await GetAsync<LocalModelsResponse>("/v1/models/local", ct);
        return response ?? new LocalModelsResponse();
    }

    public async Task<RegistryModelsResponse> GetRegistryModelsAsync(string? category = null, CancellationToken ct = default)
    {
        _logger?.LogDebug("Fetching registry models (category: {Category})", category ?? "all");
        var path = "/v1/models/registry";
        if (!string.IsNullOrEmpty(category))
            path += $"?category={Uri.EscapeDataString(category)}";

        var response = await GetAsync<RegistryModelsResponse>(path, ct);
        return response ?? new RegistryModelsResponse();
    }

    public async Task<SwitchModelResult> SwitchModelAsync(string modelId, bool use8bit = false, CancellationToken ct = default)
    {
        _logger?.LogInformation("Switching model to {ModelId} (8bit: {Use8bit})", modelId, use8bit);
        var request = new { model_id = modelId, use_8bit = use8bit };
        var response = await PostAsync<SwitchModelResult>("/v1/switch-model", request, ct);
        return response ?? new SwitchModelResult { Status = "error" };
    }

    public async Task<LoadModelResult> LoadModelAsync(string modelId, bool use8bit = false, CancellationToken ct = default)
    {
        _logger?.LogInformation("Loading model {ModelId} (8bit: {Use8bit})", modelId, use8bit);
        var request = new { model_id = modelId, use_8bit = use8bit, set_active = true };
        var response = await PostAsync<LoadModelResult>("/v1/models/load", request, ct);
        return response ?? new LoadModelResult { Status = "error" };
    }

    private async Task<T?> GetAsync<T>(string path, CancellationToken ct) where T : class
    {
        try
        {
            var response = await _httpClient.GetAsync(path, ct);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<T>(_jsonOptions, ct);
        }
        catch (HttpRequestException ex)
        {
            _logger?.LogWarning(ex, "LLM Provider unreachable at {Path}", path);
            throw new LLMProviderUnavailableException($"LLM Provider is not running or unreachable: {ex.Message}", ex);
        }
        catch (TaskCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (TaskCanceledException ex)
        {
            _logger?.LogWarning(ex, "LLM Provider request timed out at {Path}", path);
            throw new LLMProviderUnavailableException($"LLM Provider request timed out: {ex.Message}", ex);
        }
    }

    private async Task<T?> PostAsync<T>(string path, object body, CancellationToken ct) where T : class
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync(path, body, _jsonOptions, ct);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<T>(_jsonOptions, ct);
        }
        catch (HttpRequestException ex)
        {
            _logger?.LogWarning(ex, "LLM Provider unreachable at {Path}", path);
            throw new LLMProviderUnavailableException($"LLM Provider is not running or unreachable: {ex.Message}", ex);
        }
        catch (TaskCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (TaskCanceledException ex)
        {
            _logger?.LogWarning(ex, "LLM Provider request timed out at {Path}", path);
            throw new LLMProviderUnavailableException($"LLM Provider request timed out: {ex.Message}", ex);
        }
    }
}

/// <summary>
/// Thrown when the LLM Provider service is unreachable.
/// Controllers catch this and return 503.
/// </summary>
public class LLMProviderUnavailableException : Exception
{
    public LLMProviderUnavailableException(string message, Exception? inner = null)
        : base(message, inner) { }
}
