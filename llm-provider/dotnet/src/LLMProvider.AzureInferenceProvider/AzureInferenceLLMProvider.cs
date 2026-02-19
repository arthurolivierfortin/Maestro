using System.Runtime.CompilerServices;
using Azure;
using Azure.AI.Inference;
using Azure.Identity;
using LLMProvider.Application.DTOs;
using LLMProvider.Application.Interfaces.Providers;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using DomainModelInfo = LLMProvider.Domain.Entities.ModelInfo;
using DomainMessage = LLMProvider.Domain.Entities.Message;

namespace LLMProvider.AzureInferenceProvider;

/// <summary>
/// Azure AI Inference implementation of the LLM provider interface.
/// Supports Llama, Mistral, Phi, Cohere, and other Azure AI Model Catalog models.
/// </summary>
public sealed class AzureInferenceLLMProvider : ILLMProvider
{
    private readonly AzureInferenceProviderOptions _options;
    private readonly ILogger<AzureInferenceLLMProvider> _logger;
    private readonly Uri _endpoint;
    private readonly AzureKeyCredential? _apiKeyCredential;
    private readonly DefaultAzureCredential? _tokenCredential;

    public AzureInferenceLLMProvider(
        IOptions<AzureInferenceProviderOptions> options,
        ILogger<AzureInferenceLLMProvider> logger)
    {
        _options = options.Value;
        _logger = logger;
        _endpoint = new Uri(_options.Endpoint);

        // Priority: Explicit API Key > DefaultAzureCredential
        if (!string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            _logger.LogInformation("Using API Key authentication for Azure AI Inference at {Endpoint}", _options.Endpoint);
            _apiKeyCredential = new AzureKeyCredential(_options.ApiKey);
        }
        else if (_options.UseDefaultCredential)
        {
            _logger.LogInformation("Using DefaultAzureCredential for Azure AI Inference at {Endpoint} (az login, Managed Identity, etc.)", _options.Endpoint);
            _tokenCredential = new DefaultAzureCredential();
        }
        else
        {
            throw new InvalidOperationException(
                "Azure AI Inference authentication not configured. Either provide an ApiKey or set UseDefaultCredential to true.");
        }
    }

    /// <inheritdoc />
    public ProviderType ProviderType => ProviderType.AzureInference;

    /// <inheritdoc />
    public string Name => "Azure AI Inference";

    /// <inheritdoc />
    public async Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var modelConfig = _options.Models.FirstOrDefault();
            if (modelConfig is null)
            {
                _logger.LogWarning("No Azure AI Inference models configured");
                return false;
            }

            // Create a client and try a minimal check
            var client = CreateChatClient(modelConfig);
            return client is not null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Azure AI Inference availability check failed");
            return false;
        }
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<DomainModelInfo>> GetAvailableModelsAsync(CancellationToken cancellationToken = default)
    {
        var models = _options.Models.Select(m => new DomainModelInfo(
            id: new ModelId(m.ModelId),
            name: m.ModelId,
            provider: ProviderType.AzureInference,
            contextLength: m.ContextLength,
            maxOutputTokens: m.MaxOutputTokens,
            inputTokenPrice: m.InputTokenPrice,
            outputTokenPrice: m.OutputTokenPrice,
            description: $"Azure AI Inference deployment: {m.DeploymentName} ({m.ModelFamily ?? "unknown"})",
            capabilities: m.Capabilities,
            isAvailable: true
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
        var client = CreateChatClient(modelConfig);

        var messages = BuildMessages(request, conversationHistory);
        var options = BuildChatOptions(request, messages);

        _logger.LogDebug(
            "Sending Azure AI Inference request to deployment {Deployment} with {MessageCount} messages",
            modelConfig.DeploymentName,
            messages.Count);

        var result = await client.CompleteAsync(options, cancellationToken);
        var completion = result.Value;

        var tokenUsage = new TokenUsage(
            completion.Usage.PromptTokens,
            completion.Usage.CompletionTokens);

        return new LLMResponse
        {
            Content = completion.Content,
            ModelUsed = request.ModelId,
            Provider = ProviderType.AzureInference,
            TokenUsage = tokenUsage,
            FinishReason = completion.FinishReason.ToString()
        };
    }

    /// <inheritdoc />
    public async IAsyncEnumerable<LLMStreamChunk> StreamCompleteAsync(
        LLMRequest request,
        IReadOnlyList<DomainMessage>? conversationHistory = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var modelConfig = GetModelConfig(request.ModelId);
        var client = CreateChatClient(modelConfig);

        var messages = BuildMessages(request, conversationHistory);
        var options = BuildChatOptions(request, messages);

        _logger.LogDebug(
            "Starting Azure AI Inference streaming request to deployment {Deployment}",
            modelConfig.DeploymentName);

        var streamingResult = await client.CompleteStreamingAsync(options, cancellationToken);

        var totalContent = new System.Text.StringBuilder();
        TokenUsage? finalUsage = null;
        string? finishReason = null;

        await foreach (var update in streamingResult.WithCancellation(cancellationToken))
        {
            if (!string.IsNullOrEmpty(update.ContentUpdate))
            {
                totalContent.Append(update.ContentUpdate);

                yield return new LLMStreamChunk
                {
                    Content = update.ContentUpdate,
                    IsComplete = false,
                    ModelUsed = request.ModelId,
                    Provider = ProviderType.AzureInference
                };
            }

            if (update.Usage is not null)
            {
                finalUsage = new TokenUsage(
                    update.Usage.PromptTokens,
                    update.Usage.CompletionTokens);
            }

            if (update.FinishReason.HasValue)
            {
                finishReason = update.FinishReason.ToString();
            }
        }

        // Final chunk with usage info
        yield return new LLMStreamChunk
        {
            Content = string.Empty,
            IsComplete = true,
            TokenUsage = finalUsage ?? new TokenUsage(0, 0),
            FinishReason = finishReason,
            ModelUsed = request.ModelId,
            Provider = ProviderType.AzureInference
        };
    }

    private ChatCompletionsClient CreateChatClient(AzureInferenceModelConfig modelConfig)
    {
        // Build the full endpoint URL with the deployment name
        var deploymentEndpoint = new Uri(_endpoint, $"models/{modelConfig.DeploymentName}");

        if (_apiKeyCredential is not null)
        {
            return new ChatCompletionsClient(deploymentEndpoint, _apiKeyCredential);
        }
        else if (_tokenCredential is not null)
        {
            return new ChatCompletionsClient(deploymentEndpoint, _tokenCredential);
        }
        else
        {
            throw new InvalidOperationException("No authentication credential configured.");
        }
    }

    private AzureInferenceModelConfig GetModelConfig(ModelId modelId)
    {
        var config = _options.Models.FirstOrDefault(m =>
            m.ModelId.Equals(modelId.Value, StringComparison.OrdinalIgnoreCase));

        if (config is null)
        {
            throw new InvalidOperationException(
                $"No Azure AI Inference model configured for '{modelId}'.");
        }

        return config;
    }

    private static List<ChatRequestMessage> BuildMessages(LLMRequest request, IReadOnlyList<DomainMessage>? history)
    {
        var messages = new List<ChatRequestMessage>();

        // Add system prompt if provided
        if (!string.IsNullOrWhiteSpace(request.SystemPrompt))
        {
            messages.Add(new ChatRequestSystemMessage(request.SystemPrompt));
        }

        // Add conversation history
        if (history is not null)
        {
            foreach (var msg in history)
            {
                ChatRequestMessage chatMsg = msg.Role switch
                {
                    MessageRole.System => new ChatRequestSystemMessage(msg.Content),
                    MessageRole.User => new ChatRequestUserMessage(msg.Content),
                    MessageRole.Assistant => new ChatRequestAssistantMessage(msg.Content),
                    _ => throw new ArgumentOutOfRangeException()
                };
                messages.Add(chatMsg);
            }
        }

        // Add current user message
        messages.Add(new ChatRequestUserMessage(request.Prompt));

        return messages;
    }

    private static ChatCompletionsOptions BuildChatOptions(LLMRequest request, List<ChatRequestMessage> messages)
    {
        var options = new ChatCompletionsOptions(messages);

        if (request.MaxTokens.HasValue)
        {
            options.MaxTokens = request.MaxTokens.Value;
        }

        if (request.Temperature.HasValue)
        {
            options.Temperature = request.Temperature.Value;
        }

        return options;
    }
}
