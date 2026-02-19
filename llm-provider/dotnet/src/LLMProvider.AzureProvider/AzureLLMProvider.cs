using System.ClientModel;
using System.Runtime.CompilerServices;
using Azure;
using Azure.AI.OpenAI;
using Azure.Identity;
using LLMProvider.Application.DTOs;
using LLMProvider.Application.Interfaces.Providers;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OpenAI.Chat;

namespace LLMProvider.AzureProvider;

/// <summary>
/// Azure OpenAI implementation of the LLM provider interface.
/// </summary>
public sealed class AzureLLMProvider : ILLMProvider
{
    private readonly AzureProviderOptions _options;
    private readonly AzureOpenAIClient _client;
    private readonly ILogger<AzureLLMProvider> _logger;

    public AzureLLMProvider(
        IOptions<AzureProviderOptions> options,
        ILogger<AzureLLMProvider> logger)
    {
        _options = options.Value;
        _logger = logger;

        var endpoint = new Uri(_options.Endpoint);

        // Priority: Explicit API Key > DefaultAzureCredential
        if (!string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            _logger.LogInformation("Using API Key authentication for Azure OpenAI at {Endpoint}", _options.Endpoint);
            var credential = new AzureKeyCredential(_options.ApiKey);
            _client = new AzureOpenAIClient(endpoint, credential);
        }
        else if (_options.UseDefaultCredential)
        {
            _logger.LogInformation("Using DefaultAzureCredential for Azure OpenAI at {Endpoint} (az login, Managed Identity, etc.)", _options.Endpoint);
            var credential = new DefaultAzureCredential();
            _client = new AzureOpenAIClient(endpoint, credential);
        }
        else
        {
            throw new InvalidOperationException(
                "Azure authentication not configured. Either provide an ApiKey or set UseDefaultCredential to true.");
        }
    }

    /// <inheritdoc />
    public ProviderType ProviderType => ProviderType.Azure;

    /// <inheritdoc />
    public string Name => "Azure OpenAI";

    /// <inheritdoc />
    public async Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            // Try to get a chat client for the default deployment
            var deploymentName = _options.DefaultDeployment ?? _options.Deployments.FirstOrDefault()?.DeploymentName;
            if (deploymentName is null)
            {
                _logger.LogWarning("No Azure deployments configured");
                return false;
            }

            // Simple availability check - try to create the client
            var chatClient = _client.GetChatClient(deploymentName);
            return chatClient is not null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Azure OpenAI availability check failed");
            return false;
        }
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<ModelInfo>> GetAvailableModelsAsync(CancellationToken cancellationToken = default)
    {
        var models = _options.Deployments.Select(d => new ModelInfo(
            id: new ModelId(d.ModelId),
            name: d.ModelId,
            provider: ProviderType.Azure,
            contextLength: d.ContextLength,
            maxOutputTokens: d.MaxOutputTokens,
            inputTokenPrice: d.InputTokenPrice,
            outputTokenPrice: d.OutputTokenPrice,
            description: $"Azure OpenAI deployment: {d.DeploymentName}",
            capabilities: d.Capabilities,
            isAvailable: true
        )).ToList().AsReadOnly();

        return Task.FromResult<IReadOnlyList<ModelInfo>>(models);
    }

    /// <inheritdoc />
    public async Task<LLMResponse> CompleteAsync(
        LLMRequest request,
        IReadOnlyList<Message>? conversationHistory = null,
        CancellationToken cancellationToken = default)
    {
        var deployment = GetDeploymentForModel(request.ModelId);
        var chatClient = _client.GetChatClient(deployment.DeploymentName);

        var messages = BuildMessages(request, conversationHistory);
        var options = BuildChatOptions(request);

        _logger.LogDebug(
            "Sending Azure OpenAI request to deployment {Deployment} with {MessageCount} messages",
            deployment.DeploymentName,
            messages.Count);

        var result = await chatClient.CompleteChatAsync(messages, options, cancellationToken);
        var completion = result.Value;

        var tokenUsage = new TokenUsage(
            completion.Usage.InputTokenCount,
            completion.Usage.OutputTokenCount);

        return new LLMResponse
        {
            Content = completion.Content[0].Text,
            ModelUsed = request.ModelId,
            Provider = ProviderType.Azure,
            TokenUsage = tokenUsage,
            FinishReason = completion.FinishReason.ToString()
        };
    }

    /// <inheritdoc />
    public async IAsyncEnumerable<LLMStreamChunk> StreamCompleteAsync(
        LLMRequest request,
        IReadOnlyList<Message>? conversationHistory = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var deployment = GetDeploymentForModel(request.ModelId);
        var chatClient = _client.GetChatClient(deployment.DeploymentName);

        var messages = BuildMessages(request, conversationHistory);
        var options = BuildChatOptions(request);

        _logger.LogDebug(
            "Starting Azure OpenAI streaming request to deployment {Deployment}",
            deployment.DeploymentName);

        var streamingResult = chatClient.CompleteChatStreamingAsync(messages, options, cancellationToken);

        var totalContent = new System.Text.StringBuilder();
        TokenUsage? finalUsage = null;
        string? finishReason = null;

        await foreach (var update in streamingResult.WithCancellation(cancellationToken))
        {
            foreach (var contentPart in update.ContentUpdate)
            {
                totalContent.Append(contentPart.Text);

                yield return new LLMStreamChunk
                {
                    Content = contentPart.Text,
                    IsComplete = false,
                    ModelUsed = request.ModelId,
                    Provider = ProviderType.Azure
                };
            }

            if (update.Usage is not null)
            {
                finalUsage = new TokenUsage(
                    update.Usage.InputTokenCount,
                    update.Usage.OutputTokenCount);
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
            Provider = ProviderType.Azure
        };
    }

    private DeploymentConfig GetDeploymentForModel(ModelId modelId)
    {
        var deployment = _options.Deployments.FirstOrDefault(d =>
            d.ModelId.Equals(modelId.Value, StringComparison.OrdinalIgnoreCase));

        if (deployment is null)
        {
            throw new InvalidOperationException(
                $"No Azure deployment configured for model '{modelId}'.");
        }

        return deployment;
    }

    private static List<ChatMessage> BuildMessages(LLMRequest request, IReadOnlyList<Message>? history)
    {
        var messages = new List<ChatMessage>();

        // Add system prompt if provided
        if (!string.IsNullOrWhiteSpace(request.SystemPrompt))
        {
            messages.Add(new SystemChatMessage(request.SystemPrompt));
        }

        // Add conversation history
        if (history is not null)
        {
            foreach (var msg in history)
            {
                ChatMessage chatMsg = msg.Role switch
                {
                    MessageRole.System => new SystemChatMessage(msg.Content),
                    MessageRole.User => new UserChatMessage(msg.Content),
                    MessageRole.Assistant => new AssistantChatMessage(msg.Content),
                    _ => throw new ArgumentOutOfRangeException()
                };
                messages.Add(chatMsg);
            }
        }

        // Add current user message
        messages.Add(new UserChatMessage(request.Prompt));

        return messages;
    }

    private static ChatCompletionOptions BuildChatOptions(LLMRequest request)
    {
        var options = new ChatCompletionOptions();

        if (request.MaxTokens.HasValue)
        {
            options.MaxOutputTokenCount = request.MaxTokens.Value;
        }

        if (request.Temperature.HasValue)
        {
            options.Temperature = request.Temperature.Value;
        }

        return options;
    }
}
