using System.Diagnostics;
using LLMProvider.Application.DTOs;
using LLMProvider.Application.DTOs.Statistics;
using LLMProvider.Application.Interfaces;
using LLMProvider.Application.Interfaces.Providers;
using LLMProvider.Application.Interfaces.Repositories;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.Exceptions;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace LLMProvider.Application.Services;

/// <summary>
/// Orchestrates LLM requests across providers, handling memory management and token tracking.
/// </summary>
public sealed class LLMOrchestrationService
{
    private readonly ILLMProviderFactory _providerFactory;
    private readonly IConversationRepository _conversationRepository;
    private readonly MemoryManagementService _memoryService;
    private readonly TokenAccountingService _tokenAccountingService;
    private readonly ILogger<LLMOrchestrationService> _logger;
    private readonly StatisticsService _statisticsService;
    private readonly IRequestQueue _requestQueue;

    public LLMOrchestrationService(
        ILLMProviderFactory providerFactory,
        IConversationRepository conversationRepository,
        MemoryManagementService memoryService,
        TokenAccountingService tokenAccountingService,
        ILogger<LLMOrchestrationService> logger,
        StatisticsService statisticsService,
        IRequestQueue requestQueue)
    {
        _providerFactory = providerFactory;
        _conversationRepository = conversationRepository;
        _memoryService = memoryService;
        _tokenAccountingService = tokenAccountingService;
        _logger = logger;
        _statisticsService = statisticsService;
        _requestQueue = requestQueue;
    }

    /// <summary>
    /// Sends a completion request to the appropriate LLM provider.
    /// </summary>
    /// <param name="request">The completion request.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The completion response.</returns>
    public async Task<LLMResponse> CompleteAsync(LLMRequest request, CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        _logger.LogInformation(
            "Processing LLM request for model {ModelId}, conversation {ConversationId}",
            request.ModelId,
            request.ConversationId?.ToString() ?? "none");

        // 1. Resolve the provider
        var provider = await ResolveProviderAsync(request, cancellationToken);

        // 1b. If this is a Local provider and queue is enabled, route through queue
        if (provider.ProviderType == ProviderType.Local && _requestQueue.IsEnabled)
        {
            var (conversation2, history2) = await GetConversationContextAsync(request, cancellationToken);
            var queuedRequest = new Domain.Entities.QueuedRequest(request.ModelId, provider.ProviderType, RequestPriority.Normal);
            var handle = await _requestQueue.EnqueueAsync(queuedRequest, request, history2, conversation2, cancellationToken);
            return await handle.ResultTask;
        }

        // 2. Get conversation history if applicable
        var (conversation, history) = await GetConversationContextAsync(request, cancellationToken);

        // 2b. If inline messages are provided (no persistent conversation), convert them
        //     to Message entities so the provider receives structured conversation data.
        if (history is null && request.Messages is { Count: > 0 })
        {
            history = request.Messages
                .Select(m => new Message(
                    MessageId.New(),
                    m.Role.ToLowerInvariant() switch
                    {
                        "system" => MessageRole.System,
                        "assistant" => MessageRole.Assistant,
                        _ => MessageRole.User
                    },
                    m.Content))
                .ToList();
        }

        // 3. Execute the request
        var response = await provider.CompleteAsync(request, history, cancellationToken);

        stopwatch.Stop();

        // 4. Update conversation if applicable
        MessageId? userMessageId = null;
        MessageId? assistantMessageId = null;

        if (conversation is not null && request.MemoryStrategy != MemoryStrategy.None)
        {
            var userMessage = conversation.AddUserMessage(request.Prompt);
            userMessageId = userMessage.Id;

            var assistantMessage = conversation.AddAssistantMessage(
                response.Content,
                response.TokenUsage,
                response.ModelUsed,
                response.Provider);
            assistantMessageId = assistantMessage.Id;

            await _conversationRepository.UpdateAsync(conversation, cancellationToken);
        }

        // 5. Track token usage
        _tokenAccountingService.Track(
            response.Provider,
            response.ModelUsed,
            response.TokenUsage,
            request.ConversationId);

        // 6. Record statistics
        _statisticsService.RecordRequest(new RequestMetricEntry
        {
            ModelId = response.ModelUsed,
            ProviderType = response.Provider,
            LatencyMs = stopwatch.ElapsedMilliseconds,
            TokenUsage = response.TokenUsage,
            Timestamp = DateTimeOffset.UtcNow
        });

        // 7. Build final response
        var finalResponse = response with
        {
            ConversationId = conversation?.Id,
            UserMessageId = userMessageId,
            AssistantMessageId = assistantMessageId,
            Duration = stopwatch.Elapsed
        };

        _logger.LogInformation(
            "Completed LLM request in {Duration}ms, tokens: {TotalTokens}",
            stopwatch.ElapsedMilliseconds,
            response.TokenUsage.TotalTokens);

        return finalResponse;
    }

    /// <summary>
    /// Streams a completion response from the appropriate LLM provider.
    /// </summary>
    /// <param name="request">The completion request.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>An async enumerable of response chunks.</returns>
    public async IAsyncEnumerable<LLMStreamChunk> StreamCompleteAsync(
        LLMRequest request,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        _logger.LogInformation(
            "Starting streaming LLM request for model {ModelId}",
            request.ModelId);

        // Streaming is NOT queued (complex to buffer) - warn if Local+queue
        if (_requestQueue.IsEnabled)
        {
            _logger.LogWarning("Streaming request bypasses queue for model {ModelId}", request.ModelId);
        }

        // 1. Resolve the provider
        var provider = await ResolveProviderAsync(request, cancellationToken);

        // 2. Get conversation history if applicable
        var (conversation, history) = await GetConversationContextAsync(request, cancellationToken);

        // 3. Stream the response
        var fullContent = new System.Text.StringBuilder();
        TokenUsage? finalTokenUsage = null;

        await foreach (var chunk in provider.StreamCompleteAsync(request, history, cancellationToken))
        {
            fullContent.Append(chunk.Content);

            if (chunk.IsComplete && chunk.TokenUsage is not null)
            {
                finalTokenUsage = chunk.TokenUsage;
            }

            yield return chunk;
        }

        stopwatch.Stop();

        // 4. Update conversation after stream completes
        if (conversation is not null && request.MemoryStrategy != MemoryStrategy.None && finalTokenUsage is not null)
        {
            conversation.AddUserMessage(request.Prompt);
            conversation.AddAssistantMessage(
                fullContent.ToString(),
                finalTokenUsage,
                request.ModelId,
                provider.ProviderType);

            await _conversationRepository.UpdateAsync(conversation, cancellationToken);

            // Track token usage
            _tokenAccountingService.Track(
                provider.ProviderType,
                request.ModelId,
                finalTokenUsage,
                conversation.Id);
        }

        // 5. Record statistics
        if (finalTokenUsage is not null)
        {
            _statisticsService.RecordRequest(new RequestMetricEntry
            {
                ModelId = request.ModelId,
                ProviderType = provider.ProviderType,
                LatencyMs = stopwatch.ElapsedMilliseconds,
                TokenUsage = finalTokenUsage,
                Timestamp = DateTimeOffset.UtcNow
            });
        }

        _logger.LogInformation("Completed streaming LLM request in {Duration}ms", stopwatch.ElapsedMilliseconds);
    }

    private async Task<ILLMProvider> ResolveProviderAsync(LLMRequest request, CancellationToken cancellationToken)
    {
        if (request.PreferredProvider.HasValue)
        {
            var provider = _providerFactory.GetProvider(request.PreferredProvider.Value);
            if (!await provider.IsAvailableAsync(cancellationToken))
            {
                throw new ProviderUnavailableException(request.PreferredProvider.Value);
            }

            return provider;
        }

        return await _providerFactory.GetProviderForModelAsync(request.ModelId, cancellationToken);
    }

    private async Task<(Conversation? conversation, IReadOnlyList<Message>? history)> GetConversationContextAsync(
        LLMRequest request,
        CancellationToken cancellationToken)
    {
        if (request.ConversationId is null || request.MemoryStrategy == MemoryStrategy.None)
        {
            return (null, null);
        }

        var conversation = await _conversationRepository.GetByIdAsync(request.ConversationId.Value, cancellationToken);
        if (conversation is null)
        {
            throw new ConversationNotFoundException(request.ConversationId.Value);
        }

        var history = _memoryService.GetMessagesForStrategy(
            conversation,
            request.MemoryStrategy,
            request.WindowSize);

        return (conversation, history);
    }
}

/// <summary>
/// Exception thrown when a provider is unavailable.
/// </summary>
public class ProviderUnavailableException : Exception
{
    public ProviderType Provider { get; }

    public ProviderUnavailableException(ProviderType provider)
        : base($"Provider '{provider}' is currently unavailable.")
    {
        Provider = provider;
    }
}
