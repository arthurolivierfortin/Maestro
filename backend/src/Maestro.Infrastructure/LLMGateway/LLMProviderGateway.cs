using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Maestro.Application.Interfaces;

namespace Maestro.Infrastructure.LLMGateway;

/// <summary>
/// LLM Gateway implementation that connects to LLM-Provider service.
/// Supports both synchronous and streaming completion requests.
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
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        // Configure HttpClient
        _httpClient.BaseAddress = new Uri(_settings.BaseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(_settings.TimeoutSeconds);
    }

    public async Task<LLMResponse> SendAsync(LLMRequest request, CancellationToken cancellationToken = default)
    {
        var providerRequest = new LLMProviderRequest
        {
            Prompt = request.Prompt,
            ModelId = _settings.DefaultModel,
            MaxNewTokens = _settings.MaxNewTokens,
            Temperature = _settings.Temperature,
            DoSample = _settings.DoSample,
            TopP = _settings.TopP,
            SystemPrompt = _settings.SystemPrompt
        };

        _logger?.LogDebug("Sending LLM request to {BaseUrl} with model {Model}",
            _settings.BaseUrl, _settings.DefaultModel);

        var response = await SendWithRetryAsync(providerRequest, cancellationToken);

        return new LLMResponse
        {
            Content = response?.GeneratedText ?? string.Empty
        };
    }

    public async IAsyncEnumerable<string> StreamAsync(
        LLMRequest request,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var providerRequest = new LLMProviderRequest
        {
            Prompt = request.Prompt,
            ModelId = _settings.DefaultModel,
            MaxNewTokens = _settings.MaxNewTokens,
            Temperature = _settings.Temperature,
            DoSample = _settings.DoSample,
            TopP = _settings.TopP,
            SystemPrompt = _settings.SystemPrompt
        };

        _logger?.LogDebug("Starting streaming LLM request to {BaseUrl}", _settings.BaseUrl);

        // LLM-Provider supports WebSocket streaming, but for simplicity we'll use the non-streaming endpoint
        // and yield the full response as a single chunk.
        // In future iterations, implement WebSocket streaming via /v1/stream endpoint.

        var response = await SendWithRetryAsync(providerRequest, cancellationToken);

        if (response?.GeneratedText != null)
        {
            yield return response.GeneratedText;
        }
    }

    private async Task<LLMProviderResponse?> SendWithRetryAsync(
        LLMProviderRequest request,
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
                    "/v1/generate",
                    request,
                    _jsonOptions,
                    cancellationToken);

                if (httpResponse.IsSuccessStatusCode)
                {
                    var result = await httpResponse.Content.ReadFromJsonAsync<LLMProviderResponse>(
                        _jsonOptions,
                        cancellationToken);

                    _logger?.LogDebug("LLM response received. Tokens: {Total} (prompt: {Prompt}, completion: {Completion})",
                        result?.TotalTokens, result?.PromptTokens, result?.CompletionTokens);

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

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        // HttpClient is managed by DI, don't dispose
    }
}

/// <summary>
/// Configuration settings for LLM-Provider connection.
/// </summary>
public class LLMProviderSettings
{
    public const string SectionName = "LLMProvider";

    /// <summary>
    /// Base URL of the LLM-Provider service.
    /// Default: http://localhost:8000 (Python FastAPI server)
    /// Alternative: http://localhost:5000 (for .NET unified API)
    /// </summary>
    public string BaseUrl { get; set; } = "http://localhost:8000";

    /// <summary>
    /// Default model to use for inference.
    /// </summary>
    public string DefaultModel { get; set; } = "deepseek-ai/deepseek-coder-1.3b-instruct";

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
    public int MaxNewTokens { get; set; } = 256;

    /// <summary>
    /// Sampling temperature (0.0-1.0). Lower = more deterministic.
    /// </summary>
    public float Temperature { get; set; } = 0.7f;

    /// <summary>
    /// Whether to use sampling (true) or greedy decoding (false).
    /// </summary>
    public bool DoSample { get; set; } = true;

    /// <summary>
    /// Top-p (nucleus) sampling parameter.
    /// </summary>
    public float TopP { get; set; } = 0.95f;

    /// <summary>
    /// Optional system prompt to prepend to all requests.
    /// </summary>
    public string? SystemPrompt { get; set; }
}

/// <summary>
/// Request model for LLM-Provider /v1/generate endpoint.
/// </summary>
internal class LLMProviderRequest
{
    [JsonPropertyName("prompt")]
    public string Prompt { get; set; } = string.Empty;

    [JsonPropertyName("model_id")]
    public string? ModelId { get; set; }

    [JsonPropertyName("max_new_tokens")]
    public int MaxNewTokens { get; set; } = 256;

    [JsonPropertyName("temperature")]
    public float Temperature { get; set; } = 0.7f;

    [JsonPropertyName("do_sample")]
    public bool DoSample { get; set; } = true;

    [JsonPropertyName("top_p")]
    public float TopP { get; set; } = 0.95f;

    [JsonPropertyName("system_prompt")]
    public string? SystemPrompt { get; set; }
}

/// <summary>
/// Response model from LLM-Provider /v1/generate endpoint.
/// </summary>
internal class LLMProviderResponse
{
    [JsonPropertyName("generated_text")]
    public string? GeneratedText { get; set; }

    [JsonPropertyName("model")]
    public string? Model { get; set; }

    [JsonPropertyName("prompt_tokens")]
    public int PromptTokens { get; set; }

    [JsonPropertyName("completion_tokens")]
    public int CompletionTokens { get; set; }

    [JsonPropertyName("total_tokens")]
    public int TotalTokens { get; set; }

    [JsonPropertyName("finish_reason")]
    public string? FinishReason { get; set; }
}
