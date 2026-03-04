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

    public async Task<SystemCapabilities> GetSystemCapabilitiesAsync(CancellationToken ct = default)
    {
        // Try to read client-side detected capabilities from ~/.maestro/capabilities.json
        try
        {
            var capFile = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                ".maestro", "capabilities.json");

            if (File.Exists(capFile))
            {
                var json = await File.ReadAllTextAsync(capFile, ct);
                var caps = JsonSerializer.Deserialize<JsonElement>(json, _jsonOptions);

                return new SystemCapabilities
                {
                    Platform = caps.TryGetProperty("platform", out var p) ? p.GetString() : "unknown",
                    CudaAvailable = caps.TryGetProperty("cudaAvailable", out var ca) && ca.GetBoolean(),
                    MpsAvailable = false,
                    Gpu = caps.TryGetProperty("gpuName", out var gn) && gn.GetString() != null
                        ? new GpuInfo
                        {
                            Available = caps.TryGetProperty("cudaAvailable", out var ga) && ga.GetBoolean(),
                            Name = gn.GetString(),
                            VramTotalGb = caps.TryGetProperty("vramMb", out var vm) ? vm.GetDouble() / 1024.0 : 0,
                        }
                        : null,
                    Ram = caps.TryGetProperty("ramMb", out var rm)
                        ? new RamInfo { TotalGb = rm.GetDouble() / 1024.0 }
                        : null,
                    Cpu = caps.TryGetProperty("cpuCores", out var cc)
                        ? new CpuInfo
                        {
                            CoresLogical = cc.GetInt32(),
                            Name = caps.TryGetProperty("cpuModel", out var cm) ? cm.GetString() : null,
                        }
                        : null,
                };
            }
        }
        catch (Exception ex)
        {
            _logger?.LogDebug(ex, "Failed to read capabilities file");
        }

        // Fallback: no capabilities detected
        _logger?.LogDebug("No capabilities file found at ~/.maestro/capabilities.json");
        return new SystemCapabilities
        {
            Platform = $"{Environment.OSVersion.Platform}",
            CudaAvailable = false,
            MpsAvailable = false
        };
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

    // ═══ Stats / Metrics — call LLM-Provider .NET endpoints ═══

    public async Task<LLMProviderStats> GetStatsAsync(CancellationToken ct = default)
    {
        try
        {
            var response = await _httpClient.GetAsync("/api/v1/stats", ct);
            if (!response.IsSuccessStatusCode)
                return new LLMProviderStats();

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions, ct);
            return MapStats(json);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger?.LogDebug(ex, "Stats endpoint unavailable");
            return new LLMProviderStats();
        }
    }

    public async Task<LLMQueueStats> GetQueueStatsAsync(CancellationToken ct = default)
    {
        try
        {
            var response = await _httpClient.GetAsync("/api/v1/stats/queue", ct);
            if (!response.IsSuccessStatusCode)
                return new LLMQueueStats();

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(_jsonOptions, ct);
            return new LLMQueueStats
            {
                ActiveModel = json.TryGetProperty("activeModel", out var am) ? am.GetString() : null,
                Depth = json.TryGetProperty("depth", out var d) ? d.GetInt32() : 0,
                AvgWaitMs = json.TryGetProperty("avgWaitMs", out var aw) ? aw.GetDouble() : 0,
                TotalEnqueued = json.TryGetProperty("totalEnqueued", out var te) ? te.GetInt64() : 0,
                TotalProcessed = json.TryGetProperty("totalProcessed", out var tp) ? tp.GetInt64() : 0,
                DepthByModel = json.TryGetProperty("depthByModel", out var dbm)
                    ? JsonSerializer.Deserialize<Dictionary<string, int>>(dbm.GetRawText(), _jsonOptions) ?? new()
                    : new()
            };
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger?.LogDebug(ex, "Queue stats endpoint unavailable");
            return new LLMQueueStats();
        }
    }

    public async Task<List<LLMPerformanceProfile>> GetPerformanceProfilesAsync(CancellationToken ct = default)
    {
        try
        {
            var response = await _httpClient.GetAsync("/api/v1/stats/performance", ct);
            if (!response.IsSuccessStatusCode)
                return new List<LLMPerformanceProfile>();

            var profiles = await response.Content.ReadFromJsonAsync<List<JsonElement>>(_jsonOptions, ct);
            return profiles?.Select(p => new LLMPerformanceProfile
            {
                Model = p.TryGetProperty("model", out var m) ? m.GetString() ?? "" : "",
                RequestCount = p.TryGetProperty("requestCount", out var rc) ? rc.GetInt64() : 0,
                AvgResponseTimeMs = p.TryGetProperty("avgResponseTimeMs", out var art) ? art.GetDouble() : 0,
                AvgTokensPerRequest = p.TryGetProperty("avgTokensPerRequest", out var atr) ? atr.GetDouble() : 0,
                AvgLoadTimeMs = p.TryGetProperty("avgLoadTimeMs", out var alt) ? alt.GetDouble() : 0,
            }).ToList() ?? new List<LLMPerformanceProfile>();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger?.LogDebug(ex, "Performance profiles endpoint unavailable");
            return new List<LLMPerformanceProfile>();
        }
    }

    public async Task<List<LLMSwitchEvent>> GetSwitchDecisionsAsync(CancellationToken ct = default)
    {
        try
        {
            var response = await _httpClient.GetAsync("/api/v1/stats/switching/decisions", ct);
            if (!response.IsSuccessStatusCode)
                return new List<LLMSwitchEvent>();

            var events = await response.Content.ReadFromJsonAsync<List<JsonElement>>(_jsonOptions, ct);
            return events?.Select(e => new LLMSwitchEvent
            {
                Timestamp = e.TryGetProperty("timestamp", out var ts) ? ts.GetString() ?? "" : "",
                Action = e.TryGetProperty("action", out var a) ? a.GetString() ?? "" : "",
                Target = e.TryGetProperty("target", out var t) ? t.GetString() ?? "" : "",
                Score = e.TryGetProperty("score", out var s) ? s.GetDouble() : 0,
                Reason = e.TryGetProperty("reason", out var r) ? r.GetString() : null,
            }).ToList() ?? new List<LLMSwitchEvent>();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger?.LogDebug(ex, "Switch decisions endpoint unavailable");
            return new List<LLMSwitchEvent>();
        }
    }

    private static LLMProviderStats MapStats(JsonElement json)
    {
        var perModel = new List<PerModelStats>();
        if (json.TryGetProperty("perModel", out var pm) && pm.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in pm.EnumerateArray())
            {
                perModel.Add(new PerModelStats
                {
                    Model = item.TryGetProperty("model", out var m) ? m.GetString() ?? "" : "",
                    Requests = item.TryGetProperty("requests", out var r) ? r.GetInt64() : 0,
                    AvgLatencyMs = item.TryGetProperty("avgLatencyMs", out var al) ? al.GetDouble() : 0,
                    TotalTokens = item.TryGetProperty("totalTokens", out var tt) ? tt.GetInt64() : 0,
                    Rpm = item.TryGetProperty("rpm", out var rpm) ? rpm.GetDouble() : 0,
                });
            }
        }

        return new LLMProviderStats
        {
            TotalRequests = json.TryGetProperty("totalRequests", out var tr) ? tr.GetInt64() : 0,
            TotalErrors = json.TryGetProperty("totalErrors", out var te) ? te.GetInt64() : 0,
            ErrorRate = json.TryGetProperty("errorRate", out var er) ? er.GetDouble() : 0,
            PromptTokens = json.TryGetProperty("promptTokens", out var pt) ? pt.GetInt64() : 0,
            CompletionTokens = json.TryGetProperty("completionTokens", out var ct2) ? ct2.GetInt64() : 0,
            TotalTokens = json.TryGetProperty("totalTokens", out var tt2) ? tt2.GetInt64() : 0,
            LatencyP50Ms = json.TryGetProperty("latencyP50Ms", out var p50) ? p50.GetDouble() : 0,
            LatencyP95Ms = json.TryGetProperty("latencyP95Ms", out var p95) ? p95.GetDouble() : 0,
            LatencyP99Ms = json.TryGetProperty("latencyP99Ms", out var p99) ? p99.GetDouble() : 0,
            AvgLatencyMs = json.TryGetProperty("avgLatencyMs", out var avg) ? avg.GetDouble() : 0,
            PerModel = perModel
        };
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
