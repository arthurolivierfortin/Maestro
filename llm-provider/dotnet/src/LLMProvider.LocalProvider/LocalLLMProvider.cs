using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;
using LLMProvider.Application.DTOs;
using LLMProvider.Application.Interfaces.Providers;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;
using LLMProvider.LocalProvider.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LLMProvider.LocalProvider;

/// <summary>
/// Local LLM provider that communicates with the Python FastAPI service.
/// </summary>
public sealed class LocalLLMProvider : ILLMProvider, IModelSwitchable
{
    private readonly LocalProviderOptions _options;
    private readonly HttpClient _httpClient;
    private readonly ILogger<LocalLLMProvider> _logger;

    public LocalLLMProvider(
        IOptions<LocalProviderOptions> options,
        HttpClient httpClient,
        ILogger<LocalLLMProvider> logger)
    {
        _options = options.Value;
        _httpClient = httpClient;
        _logger = logger;

        _httpClient.BaseAddress = new Uri(_options.BaseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds);
    }

    /// <inheritdoc />
    public ProviderType ProviderType => ProviderType.Local;

    /// <inheritdoc />
    public string Name => "Local LLM (Python)";

    /// <inheritdoc />
    public AuthStatus GetAuthStatus()
    {
        return new AuthStatus(
            IsConfigured: true,
            Method: "none",
            MaskedCredential: null
        );
    }

    /// <inheritdoc />
    public async Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync("/health", cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return false;
            }

            var health = await response.Content.ReadFromJsonAsync<HealthResponse>(cancellationToken);
            return health?.Status == "healthy";
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Local LLM availability check failed");
            return false;
        }
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<ModelInfo>> GetAvailableModelsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetFromJsonAsync<ModelsResponse>(
                "/v1/models",
                cancellationToken);

            if (response?.Models is null || response.Models.Count == 0)
            {
                _logger.LogWarning("No models loaded on local provider");
                return [];
            }

            return response.Models.Select(kvp => new ModelInfo(
                id: new ModelId(kvp.Key),
                name: kvp.Key,
                provider: ProviderType.Local,
                contextLength: kvp.Value.ContextLength,
                maxOutputTokens: kvp.Value.MaxOutputTokens,
                inputTokenPrice: null, // Local is free
                outputTokenPrice: null,
                description: $"Local model on {kvp.Value.Device ?? "CPU"}",
                capabilities: kvp.Value.Capabilities,
                isAvailable: kvp.Value.IsActive || response.ActiveModel == kvp.Key
            )).ToList().AsReadOnly();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get models from local provider");
            return [];
        }
    }

    /// <inheritdoc />
    public async Task<LLMResponse> CompleteAsync(
        LLMRequest request,
        IReadOnlyList<Message>? conversationHistory = null,
        CancellationToken cancellationToken = default)
    {
        // Build the request with messages if we have history
        var generateRequest = BuildGenerateRequest(request, conversationHistory);

        _logger.LogDebug(
            "Sending request to local LLM, model: {Model}",
            request.ModelId);

        var response = await _httpClient.PostAsJsonAsync(
            "/v1/generate",
            generateRequest,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"Local LLM request failed: {error}");
        }

        var result = await response.Content.ReadFromJsonAsync<GenerateResponse>(cancellationToken);

        if (result is null)
        {
            throw new InvalidOperationException("Received null response from local LLM");
        }

        var tokenUsage = new TokenUsage(result.PromptTokens, result.CompletionTokens);

        return new LLMResponse
        {
            Content = result.GeneratedText,
            ModelUsed = request.ModelId,
            Provider = ProviderType.Local,
            TokenUsage = tokenUsage,
            FinishReason = result.FinishReason ?? "stop"
        };
    }

    /// <inheritdoc />
    public async IAsyncEnumerable<LLMStreamChunk> StreamCompleteAsync(
        LLMRequest request,
        IReadOnlyList<Message>? conversationHistory = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        // For now, use non-streaming and simulate chunks
        // Full WebSocket streaming would require System.Net.WebSockets
        _logger.LogDebug("Using simulated streaming for local provider");

        var response = await CompleteAsync(request, conversationHistory, cancellationToken);

        // Yield content in chunks
        const int chunkSize = 20;
        var content = response.Content;

        for (var i = 0; i < content.Length; i += chunkSize)
        {
            var chunk = content.Substring(i, Math.Min(chunkSize, content.Length - i));
            var isLast = i + chunkSize >= content.Length;

            yield return new LLMStreamChunk
            {
                Content = chunk,
                IsComplete = isLast,
                TokenUsage = isLast ? response.TokenUsage : null,
                FinishReason = isLast ? response.FinishReason : null,
                ModelUsed = response.ModelUsed,
                Provider = ProviderType.Local
            };

            if (!isLast)
            {
                await Task.Delay(10, cancellationToken);
            }
        }
    }

    /// <summary>
    /// Loads a model on the local server.
    /// </summary>
    /// <param name="modelId">The Hugging Face model ID to load.</param>
    /// <param name="use8Bit">Whether to load in 8-bit quantization mode.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public async Task LoadModelAsync(
        string modelId,
        bool use8Bit = false,
        CancellationToken cancellationToken = default)
    {
        var loadRequest = new LoadModelRequest
        {
            ModelId = modelId,
            Use8Bit = use8Bit,
            SetActive = true
        };

        _logger.LogInformation("Loading model {ModelId} on local server (8-bit: {Use8Bit})", modelId, use8Bit);

        var response = await _httpClient.PostAsJsonAsync(
            "/v1/models/load",
            loadRequest,
            cancellationToken);

        response.EnsureSuccessStatusCode();

        _logger.LogInformation("Model {ModelId} loaded successfully", modelId);
    }

    /// <summary>
    /// Switches the active model on the local server.
    /// </summary>
    /// <param name="modelId">The model to switch to.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public async Task SwitchModelAsync(string modelId, CancellationToken cancellationToken = default)
    {
        var switchRequest = new SwitchModelRequest
        {
            ModelId = modelId,
            Use8Bit = false
        };

        var response = await _httpClient.PostAsJsonAsync(
            "/v1/switch-model",
            switchRequest,
            cancellationToken);

        response.EnsureSuccessStatusCode();

        _logger.LogInformation("Switched local model to {ModelId}", modelId);
    }

    /// <summary>
    /// Gets the currently active model on the local server.
    /// </summary>
    public async Task<string?> GetActiveModelAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var health = await _httpClient.GetFromJsonAsync<HealthResponse>("/health", cancellationToken);
            return health?.ActiveModel;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to get active model from local provider");
            return null;
        }
    }

    /// <summary>
    /// Gets the list of recommended models that can be loaded.
    /// </summary>
    public async Task<AvailableModelsResponse?> GetRecommendedModelsAsync(
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await _httpClient.GetFromJsonAsync<AvailableModelsResponse>(
                "/v1/available-models",
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get recommended models");
            return null;
        }
    }

    /// <summary>
    /// Gets health information from the local server.
    /// </summary>
    public async Task<HealthResponse?> GetHealthAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            return await _httpClient.GetFromJsonAsync<HealthResponse>("/health", cancellationToken);
        }
        catch
        {
            return null;
        }
    }

    private static GenerateRequest BuildGenerateRequest(
        LLMRequest request,
        IReadOnlyList<Message>? history)
    {
        // If we have conversation history, send as messages
        if (history is not null && history.Count > 0)
        {
            var messages = history.Select(m => new LocalMessage
            {
                Role = m.Role switch
                {
                    MessageRole.System => "system",
                    MessageRole.User => "user",
                    MessageRole.Assistant => "assistant",
                    _ => "user"
                },
                Content = m.Content
            }).ToList();

            // Add current user message
            messages.Add(new LocalMessage
            {
                Role = "user",
                Content = request.Prompt
            });

            return new GenerateRequest
            {
                Prompt = request.Prompt,
                ModelId = request.ModelId.Value,
                MaxNewTokens = request.MaxTokens ?? 256,
                Temperature = request.Temperature ?? 0.7f,
                DoSample = true,
                TopP = 0.95f,
                SystemPrompt = request.SystemPrompt,
                Messages = messages
            };
        }

        // Simple prompt-only request
        return new GenerateRequest
        {
            Prompt = request.Prompt,
            ModelId = request.ModelId.Value,
            MaxNewTokens = request.MaxTokens ?? 256,
            Temperature = request.Temperature ?? 0.7f,
            DoSample = true,
            TopP = 0.95f,
            SystemPrompt = request.SystemPrompt
        };
    }
}
