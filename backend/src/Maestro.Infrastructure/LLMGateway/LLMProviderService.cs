using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Maestro.Infrastructure.LLMGateway;

/// <summary>
/// Admin operations for the LLM-Provider .NET API (health, models, stats).
/// Calls the LLM-Provider .NET gateway at http://localhost:5010.
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
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            PropertyNameCaseInsensitive = true
        };
    }

    public async Task<LLMProviderHealth> GetHealthAsync(CancellationToken ct = default)
    {
        _logger?.LogDebug("Fetching LLM-Provider health");
        try
        {
            var response = await _httpClient.GetAsync("/api/v1/health/", ct);
            response.EnsureSuccessStatusCode();
            var health = await response.Content.ReadFromJsonAsync<ProviderHealthResponse>(_jsonOptions, ct);

            // Map .NET health response to Maestro DTO
            var providerCount = health?.Providers?.Count ?? 0;
            return new LLMProviderHealth
            {
                Status = health?.Status ?? "unreachable",
                ActiveModel = null,
                ModelsLoaded = providerCount,
                Device = "managed",
                CudaAvailable = false,
                CudaDeviceName = null
            };
        }
        catch (HttpRequestException ex)
        {
            _logger?.LogWarning(ex, "LLM-Provider unreachable at /api/v1/health/");
            throw new LLMProviderUnavailableException($"LLM-Provider is not running or unreachable: {ex.Message}", ex);
        }
        catch (TaskCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (TaskCanceledException ex)
        {
            _logger?.LogWarning(ex, "LLM-Provider health check timed out");
            throw new LLMProviderUnavailableException($"LLM-Provider request timed out: {ex.Message}", ex);
        }
    }

    public Task<SystemCapabilities> GetSystemCapabilitiesAsync(CancellationToken ct = default)
    {
        // System capabilities (GPU/VRAM info) are Python-specific.
        // The .NET API manages provider routing, not hardware.
        _logger?.LogDebug("GetSystemCapabilitiesAsync — not available via .NET API");
        return Task.FromResult(new SystemCapabilities
        {
            Platform = "dotnet",
            CudaAvailable = false,
            MpsAvailable = false
        });
    }

    public async Task<CompatibleModelsResponse> GetCompatibleModelsAsync(string? category = null, CancellationToken ct = default)
    {
        _logger?.LogDebug("Fetching available models (category: {Category})", category ?? "all");
        try
        {
            var response = await _httpClient.GetAsync("/api/v1/models/", ct);
            response.EnsureSuccessStatusCode();
            var modelsWrapper = await response.Content.ReadFromJsonAsync<ModelsListResponse>(_jsonOptions, ct);
            var models = modelsWrapper?.Models ?? new List<ProviderModelInfo>();

            // Filter by category if specified (match against capabilities)
            if (!string.IsNullOrEmpty(category))
            {
                models = models.Where(m =>
                    m.Capabilities?.Any(c => c.Equals(category, StringComparison.OrdinalIgnoreCase)) == true
                ).ToList();
            }

            return new CompatibleModelsResponse
            {
                Count = models.Count,
                Models = models.Select(m => new CompatibleModel
                {
                    ModelId = m.Id ?? string.Empty,
                    Name = m.Name ?? string.Empty,
                    Description = m.Description,
                    Category = m.Provider,
                    ContextLength = m.ContextLength,
                    Capabilities = m.Capabilities ?? new List<string>()
                }).ToList()
            };
        }
        catch (HttpRequestException ex)
        {
            _logger?.LogWarning(ex, "LLM-Provider unreachable at /api/v1/models/");
            throw new LLMProviderUnavailableException($"LLM-Provider is not running or unreachable: {ex.Message}", ex);
        }
        catch (TaskCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (TaskCanceledException ex)
        {
            _logger?.LogWarning(ex, "LLM-Provider models request timed out");
            throw new LLMProviderUnavailableException($"LLM-Provider request timed out: {ex.Message}", ex);
        }
    }

    public async Task<LocalModelsResponse> GetLocalModelsAsync(CancellationToken ct = default)
    {
        _logger?.LogDebug("Fetching local models");
        try
        {
            var response = await _httpClient.GetAsync("/api/v1/models/provider/Local", ct);
            if (!response.IsSuccessStatusCode)
            {
                // No local provider might be registered — return empty
                return new LocalModelsResponse();
            }

            var modelsWrapper = await response.Content.ReadFromJsonAsync<ModelsListResponse>(_jsonOptions, ct);
            var models = modelsWrapper?.Models ?? new List<ProviderModelInfo>();

            return new LocalModelsResponse
            {
                Count = models.Count,
                Models = models.Select(m => new LocalModel
                {
                    ModelId = m.Id ?? string.Empty,
                    DisplayName = m.Name,
                    ContextLength = m.ContextLength,
                    Capabilities = m.Capabilities ?? new List<string>()
                }).ToList()
            };
        }
        catch (HttpRequestException ex)
        {
            _logger?.LogWarning(ex, "LLM-Provider unreachable at /api/v1/models/provider/Local");
            throw new LLMProviderUnavailableException($"LLM-Provider is not running or unreachable: {ex.Message}", ex);
        }
        catch (TaskCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (TaskCanceledException ex)
        {
            _logger?.LogWarning(ex, "LLM-Provider local models request timed out");
            throw new LLMProviderUnavailableException($"LLM-Provider request timed out: {ex.Message}", ex);
        }
    }

    public async Task<RegistryModelsResponse> GetRegistryModelsAsync(string? category = null, CancellationToken ct = default)
    {
        // Registry models are a Python-specific concept (HuggingFace model catalog).
        // The .NET API returns all registered models via /api/v1/models/.
        _logger?.LogDebug("Fetching registry models (category: {Category})", category ?? "all");
        var compatible = await GetCompatibleModelsAsync(category, ct);

        return new RegistryModelsResponse
        {
            Count = compatible.Count,
            Models = compatible.Models.Select(m => new RegistryModel
            {
                ModelId = m.ModelId,
                Name = m.Name,
                Description = m.Description,
                Category = m.Category,
                ContextLength = m.ContextLength,
                Capabilities = m.Capabilities
            }).ToList()
        };
    }

    public Task<SwitchModelResult> SwitchModelAsync(string modelId, bool use8bit = false, CancellationToken ct = default)
    {
        // Model switching is per-request in the .NET API — no dedicated endpoint needed.
        _logger?.LogInformation("SwitchModelAsync({ModelId}) — model passed per-request, no switch needed", modelId);
        return Task.FromResult(new SwitchModelResult
        {
            Status = "ok",
            ActiveModel = modelId,
            LoadTimeS = 0
        });
    }

    public Task<LoadModelResult> LoadModelAsync(string modelId, bool use8bit = false, CancellationToken ct = default)
    {
        // Model loading is automatic in the .NET API — providers handle their own model management.
        _logger?.LogInformation("LoadModelAsync({ModelId}) — model managed by provider", modelId);
        return Task.FromResult(new LoadModelResult
        {
            Status = "ok",
            ModelId = modelId,
            LoadTimeS = 0,
            Device = "managed"
        });
    }
}

/// <summary>
/// Thrown when the LLM-Provider service is unreachable.
/// Controllers catch this and return 503.
/// </summary>
public class LLMProviderUnavailableException : Exception
{
    public LLMProviderUnavailableException(string message, Exception? inner = null)
        : base(message, inner) { }
}

// ═══ Internal DTOs for .NET API responses ═══

/// <summary>Health response from LLM-Provider .NET API.</summary>
internal class ProviderHealthResponse
{
    public string? Status { get; set; }
    public DateTimeOffset? Timestamp { get; set; }
    public Dictionary<string, ProviderHealthStatus>? Providers { get; set; }
}

internal class ProviderHealthStatus
{
    public string? Name { get; set; }
    public bool IsAvailable { get; set; }
}

/// <summary>Models list response from LLM-Provider .NET API.</summary>
internal class ModelsListResponse
{
    public List<ProviderModelInfo>? Models { get; set; }
}

internal class ProviderModelInfo
{
    public string? Id { get; set; }
    public string? Name { get; set; }
    public string? Provider { get; set; }
    public int ContextLength { get; set; }
    public int? MaxOutputTokens { get; set; }
    public string? Description { get; set; }
    public List<string>? Capabilities { get; set; }
    public bool IsAvailable { get; set; }
}
