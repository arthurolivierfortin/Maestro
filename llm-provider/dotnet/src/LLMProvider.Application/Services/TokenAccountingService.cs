using System.Collections.Concurrent;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace LLMProvider.Application.Services;

/// <summary>
/// Service for tracking token usage across providers and conversations.
/// </summary>
public sealed class TokenAccountingService
{
    private readonly ConcurrentDictionary<ProviderType, TokenUsage> _usageByProvider = new();
    private readonly ConcurrentDictionary<ModelId, TokenUsage> _usageByModel = new();
    private readonly ConcurrentDictionary<ConversationId, TokenUsage> _usageByConversation = new();
    private readonly object _lock = new();
    private TokenUsage _totalUsage = TokenUsage.Zero;
    private readonly ILogger<TokenAccountingService> _logger;

    public TokenAccountingService(ILogger<TokenAccountingService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Tracks token usage for a request.
    /// </summary>
    /// <param name="provider">The provider that handled the request.</param>
    /// <param name="model">The model used.</param>
    /// <param name="usage">The token usage.</param>
    /// <param name="conversationId">Optional conversation ID.</param>
    public void Track(
        ProviderType provider,
        ModelId model,
        TokenUsage usage,
        ConversationId? conversationId = null)
    {
        lock (_lock)
        {
            _totalUsage += usage;

            _usageByProvider.AddOrUpdate(
                provider,
                usage,
                (_, existing) => existing + usage);

            _usageByModel.AddOrUpdate(
                model,
                usage,
                (_, existing) => existing + usage);

            if (conversationId.HasValue)
            {
                _usageByConversation.AddOrUpdate(
                    conversationId.Value,
                    usage,
                    (_, existing) => existing + usage);
            }
        }

        _logger.LogDebug(
            "Tracked {TotalTokens} tokens for provider {Provider}, model {Model}",
            usage.TotalTokens,
            provider,
            model);
    }

    /// <summary>
    /// Gets the total token usage across all requests.
    /// </summary>
    public TokenUsage GetTotalUsage()
    {
        lock (_lock)
        {
            return _totalUsage;
        }
    }

    /// <summary>
    /// Gets token usage for a specific provider.
    /// </summary>
    /// <param name="provider">The provider.</param>
    /// <returns>Token usage for the provider.</returns>
    public TokenUsage GetUsageByProvider(ProviderType provider)
    {
        return _usageByProvider.GetValueOrDefault(provider, TokenUsage.Zero);
    }

    /// <summary>
    /// Gets token usage for a specific model.
    /// </summary>
    /// <param name="model">The model.</param>
    /// <returns>Token usage for the model.</returns>
    public TokenUsage GetUsageByModel(ModelId model)
    {
        return _usageByModel.GetValueOrDefault(model, TokenUsage.Zero);
    }

    /// <summary>
    /// Gets token usage for a specific conversation.
    /// </summary>
    /// <param name="conversationId">The conversation ID.</param>
    /// <returns>Token usage for the conversation.</returns>
    public TokenUsage GetUsageByConversation(ConversationId conversationId)
    {
        return _usageByConversation.GetValueOrDefault(conversationId, TokenUsage.Zero);
    }

    /// <summary>
    /// Gets a summary of all token usage.
    /// </summary>
    /// <returns>Usage summary.</returns>
    public TokenUsageSummary GetSummary()
    {
        lock (_lock)
        {
            return new TokenUsageSummary
            {
                TotalUsage = _totalUsage,
                UsageByProvider = _usageByProvider.ToDictionary(kvp => kvp.Key, kvp => kvp.Value),
                UsageByModel = _usageByModel.ToDictionary(kvp => kvp.Key.Value, kvp => kvp.Value),
                ConversationCount = _usageByConversation.Count
            };
        }
    }

    /// <summary>
    /// Resets all usage tracking.
    /// </summary>
    public void Reset()
    {
        lock (_lock)
        {
            _totalUsage = TokenUsage.Zero;
            _usageByProvider.Clear();
            _usageByModel.Clear();
            _usageByConversation.Clear();
        }

        _logger.LogInformation("Token accounting reset");
    }
}

/// <summary>
/// Summary of token usage across the system.
/// </summary>
public sealed record TokenUsageSummary
{
    /// <summary>
    /// Total token usage across all requests.
    /// </summary>
    public required TokenUsage TotalUsage { get; init; }

    /// <summary>
    /// Token usage broken down by provider.
    /// </summary>
    public required IReadOnlyDictionary<ProviderType, TokenUsage> UsageByProvider { get; init; }

    /// <summary>
    /// Token usage broken down by model.
    /// </summary>
    public required IReadOnlyDictionary<string, TokenUsage> UsageByModel { get; init; }

    /// <summary>
    /// Number of conversations with tracked usage.
    /// </summary>
    public required int ConversationCount { get; init; }
}
