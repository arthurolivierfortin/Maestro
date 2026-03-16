using System.Net;
using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using LLMProvider.Application.DTOs;
using LLMProvider.Application.Interfaces.Providers;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using DomainModelInfo = LLMProvider.Domain.Entities.ModelInfo;
using DomainMessage = LLMProvider.Domain.Entities.Message;

namespace LLMProvider.AnthropicProvider;

/// <summary>
/// Anthropic Messages API implementation of the LLM provider interface.
/// Calls https://api.anthropic.com/v1/messages directly with an API key.
/// </summary>
public sealed class AnthropicLLMProvider : ILLMProvider
{
    private const string AnthropicVersion = "2023-06-01";

    private readonly AnthropicOptions _options;
    private readonly ILogger<AnthropicLLMProvider> _logger;
    private readonly HttpClient _httpClient;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false
    };

    public AnthropicLLMProvider(
        IOptions<AnthropicOptions> options,
        IHttpClientFactory httpClientFactory,
        ILogger<AnthropicLLMProvider> logger)
    {
        _options = options.Value;
        _logger = logger;
        _httpClient = httpClientFactory.CreateClient("Anthropic");

        _httpClient.BaseAddress = new Uri(_options.BaseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds);
        _httpClient.DefaultRequestHeaders.Add("x-api-key", _options.ApiKey);
        _httpClient.DefaultRequestHeaders.Add("anthropic-version", AnthropicVersion);
        _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var maskedKey = MaskApiKey(_options.ApiKey);
        _logger.LogInformation(
            "Anthropic provider initialized — base URL: {BaseUrl}, API key: {MaskedKey}, models: {ModelCount}",
            _options.BaseUrl,
            maskedKey,
            _options.Models.Count);
    }

    /// <inheritdoc />
    public ProviderType ProviderType => ProviderType.Anthropic;

    /// <inheritdoc />
    public string Name => "Anthropic";

    /// <inheritdoc />
    public async Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            _logger.LogDebug("Anthropic provider unavailable — no API key configured");
            return false;
        }

        if (_options.Models.Count == 0)
        {
            _logger.LogDebug("Anthropic provider unavailable — no models configured");
            return false;
        }

        try
        {
            // Send a minimal request to verify the API key is valid.
            // Use the first configured model with 1 max_tokens to minimize cost.
            var testModel = _options.Models[0].ModelId;
            var body = new AnthropicRequestBody
            {
                Model = testModel,
                MaxTokens = 1,
                Messages = [new AnthropicMessage { Role = "user", Content = "hi" }]
            };

            var json = JsonSerializer.Serialize(body, JsonOptions);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            using var response = await _httpClient.PostAsync("/v1/messages", content, cancellationToken);

            // 200 = working, 401 = bad key, anything else we treat as "available but errored"
            if (response.StatusCode == HttpStatusCode.Unauthorized)
            {
                _logger.LogWarning("Anthropic API key is invalid (401 Unauthorized)");
                return false;
            }

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Anthropic availability check failed");
            return false;
        }
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<DomainModelInfo>> GetAvailableModelsAsync(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            return Task.FromResult<IReadOnlyList<DomainModelInfo>>(Array.Empty<DomainModelInfo>());
        }

        var models = _options.Models.Select(m => new DomainModelInfo(
            id: new ModelId(m.ModelId),
            name: m.ModelId,
            provider: ProviderType.Anthropic,
            contextLength: m.ContextLength,
            maxOutputTokens: m.MaxOutputTokens,
            // Convert per-million pricing to per-1000 (the ModelInfo convention)
            inputTokenPrice: m.InputTokenPrice / 1000m,
            outputTokenPrice: m.OutputTokenPrice / 1000m,
            description: $"Anthropic {m.ModelId} (direct API)",
            capabilities: m.Capabilities,
            isAvailable: true,
            parametersBillions: m.ParametersBillions
        )).ToList().AsReadOnly();

        return Task.FromResult<IReadOnlyList<DomainModelInfo>>(models);
    }

    /// <inheritdoc />
    public async Task<LLMResponse> CompleteAsync(
        LLMRequest request,
        IReadOnlyList<DomainMessage>? conversationHistory = null,
        CancellationToken cancellationToken = default)
    {
        var modelConfig = GetModelConfig(request.ModelId);
        var body = BuildRequestBody(request, modelConfig, conversationHistory);
        var json = JsonSerializer.Serialize(body, JsonOptions);

        _logger.LogDebug(
            "Sending Anthropic request to model {Model} with {MessageCount} messages",
            modelConfig.ModelId,
            body.Messages.Count);

        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        var responseBody = await SendWithRetriesAsync(json, cancellationToken);
        stopwatch.Stop();

        var content = ExtractContent(responseBody);
        var tokenUsage = ExtractTokenUsage(responseBody);

        return new LLMResponse
        {
            Content = content,
            ModelUsed = request.ModelId,
            Provider = ProviderType.Anthropic,
            TokenUsage = tokenUsage,
            Duration = stopwatch.Elapsed,
            FinishReason = responseBody.StopReason
        };
    }

    /// <inheritdoc />
    public async IAsyncEnumerable<LLMStreamChunk> StreamCompleteAsync(
        LLMRequest request,
        IReadOnlyList<DomainMessage>? conversationHistory = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        // Streaming is not supported for this provider — fall back to non-streaming
        // and return the full response as a single chunk.
        var response = await CompleteAsync(request, conversationHistory, cancellationToken);

        yield return new LLMStreamChunk
        {
            Content = response.Content,
            IsComplete = true,
            TokenUsage = response.TokenUsage,
            FinishReason = response.FinishReason,
            ModelUsed = response.ModelUsed,
            Provider = ProviderType.Anthropic
        };
    }

    /// <inheritdoc />
    public AuthStatus GetAuthStatus()
    {
        var isConfigured = !string.IsNullOrWhiteSpace(_options.ApiKey);
        return new AuthStatus(
            IsConfigured: isConfigured,
            Method: "api-key",
            MaskedCredential: MaskCredential(_options.ApiKey)
        );
    }

    // ── Private helpers ──────────────────────────────────────

    private static string? MaskCredential(string? value)
    {
        if (string.IsNullOrEmpty(value) || value.Length < 8)
        {
            return null;
        }

        return $"****{value[^4..]}";
    }

    private AnthropicModelConfig GetModelConfig(ModelId modelId)
    {
        var config = _options.Models.FirstOrDefault(m =>
            m.ModelId.Equals(modelId.Value, StringComparison.OrdinalIgnoreCase));

        if (config is null)
        {
            throw new InvalidOperationException(
                $"No Anthropic model configured for '{modelId}'. " +
                $"Configured models: {string.Join(", ", _options.Models.Select(m => m.ModelId))}");
        }

        return config;
    }

    private static AnthropicRequestBody BuildRequestBody(
        LLMRequest request,
        AnthropicModelConfig modelConfig,
        IReadOnlyList<DomainMessage>? conversationHistory)
    {
        var messages = new List<AnthropicMessage>();

        // Add conversation history (skip system messages — Anthropic uses a separate field)
        if (conversationHistory is not null)
        {
            foreach (var msg in conversationHistory)
            {
                if (msg.Role == MessageRole.System)
                {
                    continue;
                }

                messages.Add(new AnthropicMessage
                {
                    Role = msg.Role switch
                    {
                        MessageRole.User => "user",
                        MessageRole.Assistant => "assistant",
                        _ => "user"
                    },
                    Content = msg.Content
                });
            }
        }

        // Add inline messages if provided
        if (request.Messages is not null)
        {
            foreach (var msg in request.Messages)
            {
                if (msg.Role.Equals("system", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                messages.Add(new AnthropicMessage
                {
                    Role = msg.Role.ToLowerInvariant(),
                    Content = msg.Content
                });
            }
        }

        // Add current prompt as user message
        if (!string.IsNullOrWhiteSpace(request.Prompt))
        {
            messages.Add(new AnthropicMessage
            {
                Role = "user",
                Content = request.Prompt
            });
        }

        // Ensure at least one message
        if (messages.Count == 0)
        {
            messages.Add(new AnthropicMessage
            {
                Role = "user",
                Content = request.Prompt ?? ""
            });
        }

        var body = new AnthropicRequestBody
        {
            Model = modelConfig.ModelId,
            MaxTokens = request.MaxTokens ?? modelConfig.MaxOutputTokens,
            Messages = messages
        };

        // System prompt — Anthropic uses a top-level "system" field, not a message
        if (!string.IsNullOrWhiteSpace(request.SystemPrompt))
        {
            body.System = request.SystemPrompt;
        }
        else if (conversationHistory is not null)
        {
            // Extract system message from conversation history if present
            var systemMsg = conversationHistory.FirstOrDefault(m => m.Role == MessageRole.System);
            if (systemMsg is not null)
            {
                body.System = systemMsg.Content;
            }
        }

        if (request.Temperature.HasValue)
        {
            body.Temperature = request.Temperature.Value;
        }

        return body;
    }

    private async Task<AnthropicResponseBody> SendWithRetriesAsync(
        string jsonBody,
        CancellationToken cancellationToken)
    {
        int attempt = 0;
        while (true)
        {
            attempt++;
            try
            {
                using var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
                using var response = await _httpClient.PostAsync("/v1/messages", content, cancellationToken);

                var responseText = await response.Content.ReadAsStringAsync(cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    var parsed = JsonSerializer.Deserialize<AnthropicResponseBody>(responseText, JsonOptions);
                    if (parsed is null)
                    {
                        throw new InvalidOperationException("Anthropic API returned null response body.");
                    }
                    return parsed;
                }

                // Handle specific error codes
                switch (response.StatusCode)
                {
                    case HttpStatusCode.Unauthorized:
                        throw new InvalidOperationException(
                            "Anthropic API key is invalid (401 Unauthorized). Check your API key configuration.");

                    case HttpStatusCode.TooManyRequests:
                        if (attempt <= _options.MaxRetries)
                        {
                            var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt));
                            _logger.LogWarning(
                                "Anthropic rate limited (429). Retry {Attempt}/{Max} in {Delay}s",
                                attempt, _options.MaxRetries, delay.TotalSeconds);
                            await Task.Delay(delay, cancellationToken);
                            continue;
                        }
                        throw new InvalidOperationException(
                            $"Anthropic API rate limit exceeded after {_options.MaxRetries} retries.");

                    case HttpStatusCode.InternalServerError:
                    case HttpStatusCode.BadGateway:
                    case HttpStatusCode.ServiceUnavailable:
                        if (attempt <= _options.MaxRetries)
                        {
                            var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt));
                            _logger.LogWarning(
                                "Anthropic server error ({Status}). Retry {Attempt}/{Max} in {Delay}s",
                                response.StatusCode, attempt, _options.MaxRetries, delay.TotalSeconds);
                            await Task.Delay(delay, cancellationToken);
                            continue;
                        }
                        throw new InvalidOperationException(
                            $"Anthropic API server error ({response.StatusCode}) after {_options.MaxRetries} retries. Response: {Truncate(responseText, 500)}");

                    default:
                        throw new InvalidOperationException(
                            $"Anthropic API error ({(int)response.StatusCode} {response.StatusCode}): {Truncate(responseText, 500)}");
                }
            }
            catch (TaskCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (TaskCanceledException)
            {
                // Timeout
                if (attempt <= _options.MaxRetries)
                {
                    _logger.LogWarning(
                        "Anthropic request timed out. Retry {Attempt}/{Max}",
                        attempt, _options.MaxRetries);
                    continue;
                }
                throw new InvalidOperationException(
                    $"Anthropic API request timed out after {_options.TimeoutSeconds}s ({_options.MaxRetries} retries exhausted).");
            }
        }
    }

    private static string ExtractContent(AnthropicResponseBody response)
    {
        if (response.Content is null || response.Content.Count == 0)
        {
            return string.Empty;
        }

        // Concatenate all text blocks
        return string.Join("", response.Content
            .Where(c => c.Type == "text")
            .Select(c => c.Text ?? ""));
    }

    private static TokenUsage ExtractTokenUsage(AnthropicResponseBody response)
    {
        if (response.Usage is null)
        {
            return TokenUsage.Zero;
        }

        return new TokenUsage(
            response.Usage.InputTokens,
            response.Usage.OutputTokens);
    }

    private static string MaskApiKey(string? apiKey)
    {
        if (string.IsNullOrEmpty(apiKey) || apiKey.Length < 8)
        {
            return "****";
        }
        return $"****{apiKey[^4..]}";
    }

    private static string Truncate(string text, int maxLength)
    {
        if (text.Length <= maxLength)
        {
            return text;
        }

        return text[..maxLength] + "...";
    }
}

// ── Anthropic API request/response models ──────────────────

internal sealed class AnthropicRequestBody
{
    public required string Model { get; set; }

    [JsonPropertyName("max_tokens")]
    public int MaxTokens { get; set; }

    public List<AnthropicMessage> Messages { get; set; } = [];

    public string? System { get; set; }

    public float? Temperature { get; set; }
}

internal sealed class AnthropicMessage
{
    public required string Role { get; set; }
    public required string Content { get; set; }
}

internal sealed class AnthropicResponseBody
{
    public string? Id { get; set; }
    public string? Type { get; set; }
    public string? Role { get; set; }
    public List<AnthropicContentBlock>? Content { get; set; }
    public string? Model { get; set; }

    [JsonPropertyName("stop_reason")]
    public string? StopReason { get; set; }

    [JsonPropertyName("stop_sequence")]
    public string? StopSequence { get; set; }

    public AnthropicUsage? Usage { get; set; }
}

internal sealed class AnthropicContentBlock
{
    public string Type { get; set; } = "";
    public string? Text { get; set; }
}

internal sealed class AnthropicUsage
{
    [JsonPropertyName("input_tokens")]
    public int InputTokens { get; set; }

    [JsonPropertyName("output_tokens")]
    public int OutputTokens { get; set; }
}
