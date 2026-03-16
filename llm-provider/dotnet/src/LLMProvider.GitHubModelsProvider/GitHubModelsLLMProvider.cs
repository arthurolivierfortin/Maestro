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

namespace LLMProvider.GitHubModelsProvider;

/// <summary>
/// GitHub Models provider implementation using the OpenAI-compatible chat completions API.
/// Calls POST {endpoint}/chat/completions with a GitHub personal access token.
/// </summary>
public sealed class GitHubModelsLLMProvider : ILLMProvider
{
    private readonly GitHubModelsOptions _options;
    private readonly ILogger<GitHubModelsLLMProvider> _logger;
    private readonly HttpClient _httpClient;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false
    };

    public GitHubModelsLLMProvider(
        IOptions<GitHubModelsOptions> options,
        IHttpClientFactory httpClientFactory,
        ILogger<GitHubModelsLLMProvider> logger)
    {
        _options = options.Value;
        _logger = logger;
        _httpClient = httpClientFactory.CreateClient("GitHubModels");

        _httpClient.BaseAddress = new Uri(_options.Endpoint.TrimEnd('/'));
        _httpClient.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds);
        _httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", _options.Token);
        _httpClient.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json"));

        var maskedToken = MaskToken(_options.Token);
        _logger.LogInformation(
            "GitHub Models provider initialized — endpoint: {Endpoint}, token: {MaskedToken}, models: {ModelCount}",
            _options.Endpoint,
            maskedToken,
            _options.Models.Count);
    }

    /// <inheritdoc />
    public ProviderType ProviderType => ProviderType.GitHubModels;

    /// <inheritdoc />
    public string Name => "GitHub Models";

    /// <inheritdoc />
    public Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.Token))
        {
            _logger.LogDebug("GitHub Models provider unavailable — no token configured");
            return Task.FromResult(false);
        }

        if (_options.Models.Count == 0)
        {
            _logger.LogDebug("GitHub Models provider unavailable — no models configured");
            return Task.FromResult(false);
        }

        // Token is configured — report as available without making an API call.
        // Actual token validity will be verified on first real request.
        return Task.FromResult(true);
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<DomainModelInfo>> GetAvailableModelsAsync(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.Token))
        {
            return Task.FromResult<IReadOnlyList<DomainModelInfo>>(Array.Empty<DomainModelInfo>());
        }

        var models = _options.Models.Select(m => new DomainModelInfo(
            id: new ModelId(m.ModelId),
            name: m.ModelId,
            provider: ProviderType.GitHubModels,
            contextLength: m.ContextLength,
            maxOutputTokens: m.MaxOutputTokens,
            // Convert per-million pricing to per-1000 (the ModelInfo convention)
            inputTokenPrice: m.InputTokenPrice / 1000m,
            outputTokenPrice: m.OutputTokenPrice / 1000m,
            description: $"GitHub Models {m.ModelId} ({m.ModelFamily ?? "unknown"})",
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
            "Sending GitHub Models request to model {Model} with {MessageCount} messages",
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
            Provider = ProviderType.GitHubModels,
            TokenUsage = tokenUsage,
            Duration = stopwatch.Elapsed,
            FinishReason = responseBody.Choices?.FirstOrDefault()?.FinishReason
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
            Provider = ProviderType.GitHubModels
        };
    }

    /// <inheritdoc />
    public AuthStatus GetAuthStatus()
    {
        var isConfigured = !string.IsNullOrWhiteSpace(_options.Token);
        return new AuthStatus(
            IsConfigured: isConfigured,
            Method: "token",
            MaskedCredential: MaskCredential(_options.Token)
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

    private GitHubModelsModelConfig GetModelConfig(ModelId modelId)
    {
        var config = _options.Models.FirstOrDefault(m =>
            m.ModelId.Equals(modelId.Value, StringComparison.OrdinalIgnoreCase));

        if (config is null)
        {
            throw new InvalidOperationException(
                $"No GitHub Models model configured for '{modelId}'. " +
                $"Configured models: {string.Join(", ", _options.Models.Select(m => m.ModelId))}");
        }

        return config;
    }

    private static GitHubModelsRequestBody BuildRequestBody(
        LLMRequest request,
        GitHubModelsModelConfig modelConfig,
        IReadOnlyList<DomainMessage>? conversationHistory)
    {
        var messages = new List<ChatMessage>();

        // System prompt — OpenAI format uses a system message in the messages array
        if (!string.IsNullOrWhiteSpace(request.SystemPrompt))
        {
            messages.Add(new ChatMessage { Role = "system", Content = request.SystemPrompt });
        }
        else if (conversationHistory is not null)
        {
            var systemMsg = conversationHistory.FirstOrDefault(m => m.Role == MessageRole.System);
            if (systemMsg is not null)
            {
                messages.Add(new ChatMessage { Role = "system", Content = systemMsg.Content });
            }
        }

        // Add conversation history (skip system messages — already handled above)
        if (conversationHistory is not null)
        {
            foreach (var msg in conversationHistory)
            {
                if (msg.Role == MessageRole.System)
                {
                    continue;
                }

                messages.Add(new ChatMessage
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
                // System messages already handled above via SystemPrompt
                if (msg.Role.Equals("system", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                messages.Add(new ChatMessage
                {
                    Role = msg.Role.ToLowerInvariant(),
                    Content = msg.Content
                });
            }
        }

        // Add current prompt as user message
        if (!string.IsNullOrWhiteSpace(request.Prompt))
        {
            messages.Add(new ChatMessage
            {
                Role = "user",
                Content = request.Prompt
            });
        }

        // Ensure at least one message
        if (messages.Count == 0)
        {
            messages.Add(new ChatMessage
            {
                Role = "user",
                Content = request.Prompt ?? ""
            });
        }

        var body = new GitHubModelsRequestBody
        {
            Model = modelConfig.ModelId,
            MaxTokens = request.MaxTokens ?? modelConfig.MaxOutputTokens,
            Messages = messages
        };

        if (request.Temperature.HasValue)
        {
            body.Temperature = request.Temperature.Value;
        }

        return body;
    }

    private async Task<GitHubModelsResponseBody> SendWithRetriesAsync(
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
                using var response = await _httpClient.PostAsync("/chat/completions", content, cancellationToken);

                var responseText = await response.Content.ReadAsStringAsync(cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    var parsed = JsonSerializer.Deserialize<GitHubModelsResponseBody>(responseText, JsonOptions);
                    if (parsed is null)
                    {
                        throw new InvalidOperationException("GitHub Models API returned null response body.");
                    }
                    return parsed;
                }

                // Handle specific error codes
                switch (response.StatusCode)
                {
                    case HttpStatusCode.Unauthorized:
                        throw new InvalidOperationException(
                            "GitHub Models token is invalid (401 Unauthorized). Check your GitHub personal access token.");

                    case HttpStatusCode.TooManyRequests:
                        if (attempt <= _options.MaxRetries)
                        {
                            var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt));
                            _logger.LogWarning(
                                "GitHub Models rate limited (429). Retry {Attempt}/{Max} in {Delay}s",
                                attempt, _options.MaxRetries, delay.TotalSeconds);
                            await Task.Delay(delay, cancellationToken);
                            continue;
                        }
                        throw new InvalidOperationException(
                            $"GitHub Models API rate limit exceeded after {_options.MaxRetries} retries.");

                    case HttpStatusCode.InternalServerError:
                    case HttpStatusCode.BadGateway:
                    case HttpStatusCode.ServiceUnavailable:
                        if (attempt <= _options.MaxRetries)
                        {
                            var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt));
                            _logger.LogWarning(
                                "GitHub Models server error ({Status}). Retry {Attempt}/{Max} in {Delay}s",
                                response.StatusCode, attempt, _options.MaxRetries, delay.TotalSeconds);
                            await Task.Delay(delay, cancellationToken);
                            continue;
                        }
                        throw new InvalidOperationException(
                            $"GitHub Models API server error ({response.StatusCode}) after {_options.MaxRetries} retries. Response: {Truncate(responseText, 500)}");

                    default:
                        throw new InvalidOperationException(
                            $"GitHub Models API error ({(int)response.StatusCode} {response.StatusCode}): {Truncate(responseText, 500)}");
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
                        "GitHub Models request timed out. Retry {Attempt}/{Max}",
                        attempt, _options.MaxRetries);
                    continue;
                }
                throw new InvalidOperationException(
                    $"GitHub Models API request timed out after {_options.TimeoutSeconds}s ({_options.MaxRetries} retries exhausted).");
            }
        }
    }

    private static string ExtractContent(GitHubModelsResponseBody response)
    {
        if (response.Choices is null || response.Choices.Count == 0)
        {
            return string.Empty;
        }

        return response.Choices[0].Message?.Content ?? string.Empty;
    }

    private static TokenUsage ExtractTokenUsage(GitHubModelsResponseBody response)
    {
        if (response.Usage is null)
        {
            return TokenUsage.Zero;
        }

        return new TokenUsage(
            response.Usage.PromptTokens,
            response.Usage.CompletionTokens);
    }

    private static string MaskToken(string? token)
    {
        if (string.IsNullOrEmpty(token) || token.Length < 8)
        {
            return "****";
        }
        return $"****{token[^4..]}";
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

// ── GitHub Models API request/response models (OpenAI-compatible) ──

internal sealed class GitHubModelsRequestBody
{
    public required string Model { get; set; }

    [JsonPropertyName("max_tokens")]
    public int MaxTokens { get; set; }

    public List<ChatMessage> Messages { get; set; } = [];

    public float? Temperature { get; set; }
}

internal sealed class ChatMessage
{
    public required string Role { get; set; }
    public required string Content { get; set; }
}

internal sealed class GitHubModelsResponseBody
{
    public string? Id { get; set; }
    public string? Object { get; set; }
    public List<ChatChoice>? Choices { get; set; }
    public ChatUsage? Usage { get; set; }
    public string? Model { get; set; }
}

internal sealed class ChatChoice
{
    public int Index { get; set; }
    public ChatChoiceMessage? Message { get; set; }

    [JsonPropertyName("finish_reason")]
    public string? FinishReason { get; set; }
}

internal sealed class ChatChoiceMessage
{
    public string? Role { get; set; }
    public string? Content { get; set; }
}

internal sealed class ChatUsage
{
    [JsonPropertyName("prompt_tokens")]
    public int PromptTokens { get; set; }

    [JsonPropertyName("completion_tokens")]
    public int CompletionTokens { get; set; }

    [JsonPropertyName("total_tokens")]
    public int TotalTokens { get; set; }
}
