using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Maestro.Application.Interfaces;

namespace Maestro.Infrastructure.LLMGateway;

/// <summary>
/// LLM Gateway implementation for Azure OpenAI Service.
/// Uses the Azure OpenAI REST API (chat/completions endpoint).
/// </summary>
public class AzureOpenAIGateway : ILLMGateway, IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly AzureOpenAISettings _settings;
    private readonly ILogger<AzureOpenAIGateway>? _logger;
    private readonly JsonSerializerOptions _jsonOptions;
    private bool _disposed;

    public AzureOpenAIGateway(
        HttpClient httpClient,
        IOptions<AzureOpenAISettings> settings,
        ILogger<AzureOpenAIGateway>? logger = null)
    {
        _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        _settings = settings?.Value ?? throw new ArgumentNullException(nameof(settings));
        _logger = logger;

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        // Configure HttpClient for Azure
        if (!string.IsNullOrEmpty(_settings.Endpoint))
        {
            _httpClient.BaseAddress = new Uri(_settings.Endpoint.TrimEnd('/'));
        }
        _httpClient.Timeout = TimeSpan.FromSeconds(_settings.TimeoutSeconds);
        _httpClient.DefaultRequestHeaders.Add("api-key", _settings.ApiKey);
    }

    public async Task<LLMResponse> SendAsync(LLMRequest request, CancellationToken cancellationToken = default)
    {
        var messages = BuildMessages(request);
        var azureRequest = new AzureCompletionRequest
        {
            Messages = messages,
            MaxTokens = request.MaxNewTokens ?? _settings.MaxTokens,
            Temperature = request.Temperature ?? _settings.Temperature
        };

        var deployment = request.ModelId ?? _settings.DeploymentName;
        var url = $"/openai/deployments/{deployment}/chat/completions?api-version={_settings.ApiVersion}";

        _logger?.LogDebug("Sending Azure OpenAI request to deployment {Deployment}", deployment);

        try
        {
            var httpResponse = await _httpClient.PostAsJsonAsync(url, azureRequest, _jsonOptions, cancellationToken);

            if (!httpResponse.IsSuccessStatusCode)
            {
                var errorBody = await httpResponse.Content.ReadAsStringAsync(cancellationToken);
                _logger?.LogWarning("Azure OpenAI request failed: {Status} - {Error}", httpResponse.StatusCode, errorBody);
                throw new HttpRequestException($"Azure OpenAI returned {httpResponse.StatusCode}: {errorBody}");
            }

            var azureResponse = await httpResponse.Content.ReadFromJsonAsync<AzureCompletionResponse>(_jsonOptions, cancellationToken);

            var content = azureResponse?.Choices?.FirstOrDefault()?.Message?.Content ?? string.Empty;

            return new LLMResponse
            {
                Content = content,
                PromptTokens = azureResponse?.Usage?.PromptTokens ?? 0,
                CompletionTokens = azureResponse?.Usage?.CompletionTokens ?? 0,
                TotalTokens = azureResponse?.Usage?.TotalTokens ?? 0,
                Model = azureResponse?.Model ?? deployment
            };
        }
        catch (HttpRequestException)
        {
            throw;
        }
        catch (TaskCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Unexpected error calling Azure OpenAI");
            throw new HttpRequestException($"Azure OpenAI error: {ex.Message}", ex);
        }
    }

    public async IAsyncEnumerable<string> StreamAsync(
        LLMRequest request,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var messages = BuildMessages(request);
        var azureRequest = new AzureCompletionRequest
        {
            Messages = messages,
            MaxTokens = request.MaxNewTokens ?? _settings.MaxTokens,
            Temperature = request.Temperature ?? _settings.Temperature,
            Stream = true
        };

        var deployment = request.ModelId ?? _settings.DeploymentName;
        var url = $"/openai/deployments/{deployment}/chat/completions?api-version={_settings.ApiVersion}";

        _logger?.LogDebug("Starting Azure OpenAI streaming request to deployment {Deployment}", deployment);

        var httpRequest = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(azureRequest, options: _jsonOptions)
        };

        var httpResponse = await _httpClient.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

        if (!httpResponse.IsSuccessStatusCode)
        {
            var errorBody = await httpResponse.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException($"Azure OpenAI stream failed: {httpResponse.StatusCode}: {errorBody}");
        }

        using var stream = await httpResponse.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);

        while (!cancellationToken.IsCancellationRequested)
        {
            var line = await reader.ReadLineAsync(cancellationToken);
            if (line == null) break; // End of stream
            if (string.IsNullOrEmpty(line)) continue;
            if (!line.StartsWith("data: ")) continue;

            var data = line[6..];
            if (data == "[DONE]") break;

            var delta = ParseStreamChunk(data);
            if (delta != null)
            {
                yield return delta;
            }
        }
    }

    private string? ParseStreamChunk(string data)
    {
        try
        {
            var chunk = JsonSerializer.Deserialize<AzureStreamChunk>(data, _jsonOptions);
            return chunk?.Choices?.FirstOrDefault()?.Delta?.Content;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public Task SwitchModelAsync(string modelId, CancellationToken cancellationToken = default)
    {
        // Azure uses deployment names — model switching is a no-op
        _logger?.LogInformation("Azure OpenAI: model switch to {ModelId} ignored (use deployment name)", modelId);
        return Task.CompletedTask;
    }

    private List<AzureMessage> BuildMessages(LLMRequest request)
    {
        var messages = new List<AzureMessage>();

        if (!string.IsNullOrEmpty(request.SystemPrompt))
        {
            messages.Add(new AzureMessage { Role = "system", Content = request.SystemPrompt });
        }

        if (request.Messages != null && request.Messages.Count > 0)
        {
            messages.AddRange(request.Messages.Select(m => new AzureMessage { Role = m.Role, Content = m.Content }));
        }
        else if (!string.IsNullOrEmpty(request.Prompt))
        {
            messages.Add(new AzureMessage { Role = "user", Content = request.Prompt });
        }

        return messages;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
    }
}

/// <summary>
/// Configuration for Azure OpenAI connection.
/// </summary>
public class AzureOpenAISettings
{
    public const string SectionName = "AzureOpenAI";

    public string Endpoint { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string DeploymentName { get; set; } = string.Empty;
    public string ApiVersion { get; set; } = "2024-06-01";
    public int MaxTokens { get; set; } = 1024;
    public float Temperature { get; set; } = 0.7f;
    public int TimeoutSeconds { get; set; } = 120;

    public bool IsConfigured => !string.IsNullOrEmpty(Endpoint) && !string.IsNullOrEmpty(ApiKey) && !string.IsNullOrEmpty(DeploymentName);
}

// Azure OpenAI API models

internal class AzureMessage
{
    [JsonPropertyName("role")]
    public string Role { get; set; } = string.Empty;

    [JsonPropertyName("content")]
    public string Content { get; set; } = string.Empty;
}

internal class AzureCompletionRequest
{
    [JsonPropertyName("messages")]
    public List<AzureMessage> Messages { get; set; } = new();

    [JsonPropertyName("max_tokens")]
    public int MaxTokens { get; set; } = 1024;

    [JsonPropertyName("temperature")]
    public float Temperature { get; set; } = 0.7f;

    [JsonPropertyName("stream")]
    public bool? Stream { get; set; }
}

internal class AzureCompletionResponse
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("model")]
    public string? Model { get; set; }

    [JsonPropertyName("choices")]
    public List<AzureChoice>? Choices { get; set; }

    [JsonPropertyName("usage")]
    public AzureUsage? Usage { get; set; }
}

internal class AzureChoice
{
    [JsonPropertyName("message")]
    public AzureMessage? Message { get; set; }

    [JsonPropertyName("finish_reason")]
    public string? FinishReason { get; set; }
}

internal class AzureUsage
{
    [JsonPropertyName("prompt_tokens")]
    public int PromptTokens { get; set; }

    [JsonPropertyName("completion_tokens")]
    public int CompletionTokens { get; set; }

    [JsonPropertyName("total_tokens")]
    public int TotalTokens { get; set; }
}

internal class AzureStreamChunk
{
    [JsonPropertyName("choices")]
    public List<AzureStreamChoice>? Choices { get; set; }
}

internal class AzureStreamChoice
{
    [JsonPropertyName("delta")]
    public AzureStreamDelta? Delta { get; set; }
}

internal class AzureStreamDelta
{
    [JsonPropertyName("content")]
    public string? Content { get; set; }

    [JsonPropertyName("role")]
    public string? Role { get; set; }
}
