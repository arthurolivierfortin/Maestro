using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Maestro.Application.Interfaces;

namespace Maestro.Infrastructure.LLMGateway;

/// <summary>
/// LLM Gateway implementation that connects to the LLM-Provider .NET API.
/// Routes requests through the multi-provider gateway at /api/v1/llm/complete.
/// </summary>
public class LLMProviderGateway : ILLMGateway, IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly LLMProviderSettings _settings;
    private readonly ILogger<LLMProviderGateway>? _logger;
    private readonly JsonSerializerOptions _jsonOptions;
    private bool _disposed;

    public LLMProviderGateway(
        HttpClient httpClient,
        IOptions<LLMProviderSettings> settings,
        ILogger<LLMProviderGateway>? logger = null)
    {
        _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        _settings = settings?.Value ?? throw new ArgumentNullException(nameof(settings));
        _logger = logger;

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        // Configure HttpClient
        _httpClient.BaseAddress = new Uri(_settings.BaseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(_settings.TimeoutSeconds);
    }

    public async Task<LLMResponse> SendAsync(LLMRequest request, CancellationToken cancellationToken = default)
    {
        // Build the prompt: if messages are provided, concatenate them for the LLM-Provider API
        var prompt = request.Prompt ?? string.Empty;
        if (request.Messages != null && request.Messages.Count > 0)
        {
            prompt = string.Join("\n\n", request.Messages
                .Where(m => m.Role != "system")
                .Select(m => m.Content));
        }

        var completeRequest = new CompleteRequest
        {
            Prompt = prompt,
            Model = request.ModelId ?? _settings.DefaultModel,
            MaxTokens = request.MaxNewTokens ?? _settings.MaxNewTokens,
            Temperature = request.Temperature ?? _settings.Temperature,
            SystemPrompt = request.SystemPrompt ?? _settings.SystemPrompt
        };

        _logger?.LogDebug("Sending LLM request to {BaseUrl}/api/v1/llm/complete with model {Model}",
            _settings.BaseUrl, completeRequest.Model);

        var response = await SendWithRetryAsync(completeRequest, cancellationToken);

        return new LLMResponse
        {
            Content = response?.Content ?? string.Empty,
            PromptTokens = response?.TokenUsage?.PromptTokens ?? 0,
            CompletionTokens = response?.TokenUsage?.CompletionTokens ?? 0,
            TotalTokens = response?.TokenUsage?.TotalTokens ?? 0,
            Model = response?.Model
        };
    }

    public async IAsyncEnumerable<string> StreamAsync(
        LLMRequest request,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        // Use non-streaming endpoint and yield full response as single chunk.
        // The LLM-Provider .NET API supports SSE streaming via /api/v1/llm/stream,
        // but for simplicity we use the non-streaming path here.
        var response = await SendAsync(request, cancellationToken);

        if (!string.IsNullOrEmpty(response.Content))
        {
            yield return response.Content;
        }
    }

    private async Task<CompleteResponse?> SendWithRetryAsync(
        CompleteRequest request,
        CancellationToken cancellationToken)
    {
        var attempts = 0;
        var delayMs = _settings.InitialRetryDelayMs;

        while (attempts < _settings.MaxRetries)
        {
            attempts++;
            try
            {
                var httpResponse = await _httpClient.PostAsJsonAsync(
                    "/api/v1/llm/complete",
                    request,
                    _jsonOptions,
                    cancellationToken);

                if (httpResponse.IsSuccessStatusCode)
                {
                    var result = await httpResponse.Content.ReadFromJsonAsync<CompleteResponse>(
                        _jsonOptions,
                        cancellationToken);

                    _logger?.LogDebug("LLM response received. Tokens: {Total} (prompt: {Prompt}, completion: {Completion})",
                        result?.TokenUsage?.TotalTokens, result?.TokenUsage?.PromptTokens, result?.TokenUsage?.CompletionTokens);

                    return result;
                }

                var errorContent = await httpResponse.Content.ReadAsStringAsync(cancellationToken);
                _logger?.LogWarning("LLM request failed with status {Status}: {Error}",
                    httpResponse.StatusCode, errorContent);

                if (attempts < _settings.MaxRetries)
                {
                    await Task.Delay(delayMs, cancellationToken);
                    delayMs *= 2; // Exponential backoff
                }
            }
            catch (HttpRequestException ex) when (attempts < _settings.MaxRetries)
            {
                _logger?.LogWarning(ex, "LLM request attempt {Attempt} failed", attempts);
                await Task.Delay(delayMs, cancellationToken);
                delayMs *= 2;
            }
            catch (TaskCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
        }

        _logger?.LogError("LLM request failed after {MaxRetries} attempts", _settings.MaxRetries);
        return null;
    }

    public Task SwitchModelAsync(string modelId, CancellationToken cancellationToken = default)
    {
        // Model switching is handled per-request by the LLM-Provider .NET API.
        // The model is passed in each CompleteRequest, so no explicit switch is needed.
        _logger?.LogDebug("SwitchModelAsync({ModelId}) — no-op, model passed per-request", modelId);
        return Task.CompletedTask;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        // HttpClient is managed by DI, don't dispose
    }
}

/// <summary>
/// Configuration settings for LLM-Provider .NET API connection.
/// </summary>
public class LLMProviderSettings
{
    public const string SectionName = "LLMProvider";

    /// <summary>
    /// Base URL of the LLM-Provider .NET API.
    /// Default: http://localhost:5010
    /// </summary>
    public string BaseUrl { get; set; } = "http://localhost:5010";

    /// <summary>
    /// Default model to use for inference.
    /// </summary>
    public string DefaultModel { get; set; } = "Qwen2.5-Coder-1.5B-Instruct";

    /// <summary>
    /// Request timeout in seconds.
    /// </summary>
    public int TimeoutSeconds { get; set; } = 300;

    /// <summary>
    /// Maximum number of retry attempts.
    /// </summary>
    public int MaxRetries { get; set; } = 3;

    /// <summary>
    /// Initial delay for retry backoff in milliseconds.
    /// </summary>
    public int InitialRetryDelayMs { get; set; } = 200;

    /// <summary>
    /// Maximum new tokens to generate.
    /// </summary>
    public int MaxNewTokens { get; set; } = 512;

    /// <summary>
    /// Sampling temperature (0.0-1.0). Lower = more deterministic.
    /// </summary>
    public float Temperature { get; set; } = 0.7f;

    /// <summary>
    /// Optional system prompt to prepend to all requests.
    /// </summary>
    public string? SystemPrompt { get; set; }
}

/// <summary>
/// Request model for LLM-Provider .NET API /api/v1/llm/complete endpoint.
/// </summary>
internal class CompleteRequest
{
    public string Prompt { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public int? MaxTokens { get; set; }
    public float? Temperature { get; set; }
    public string? SystemPrompt { get; set; }
}

/// <summary>
/// Response model from LLM-Provider .NET API /api/v1/llm/complete endpoint.
/// </summary>
internal class CompleteResponse
{
    public string? Content { get; set; }
    public string? Model { get; set; }
    public string? Provider { get; set; }
    public TokenUsageResponse? TokenUsage { get; set; }
    public long DurationMs { get; set; }
    public string? FinishReason { get; set; }
}

/// <summary>
/// Token usage breakdown in LLM-Provider .NET API responses.
/// </summary>
internal class TokenUsageResponse
{
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public int TotalTokens { get; set; }
}
