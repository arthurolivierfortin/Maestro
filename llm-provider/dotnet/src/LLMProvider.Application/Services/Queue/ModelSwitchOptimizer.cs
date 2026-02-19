using LLMProvider.Application.DTOs.Queue;
using LLMProvider.Application.Interfaces;
using LLMProvider.Application.Options;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LLMProvider.Application.Services.Queue;

/// <summary>
/// Evaluates whether to switch the active model based on pending requests and performance profiles.
/// </summary>
public sealed class ModelSwitchOptimizer
{
    private readonly IStatisticsService _statistics;
    private readonly QueueOptions _options;
    private readonly ILogger<ModelSwitchOptimizer> _logger;

    public ModelSwitchOptimizer(
        IStatisticsService statistics,
        IOptions<QueueOptions> options,
        ILogger<ModelSwitchOptimizer> logger)
    {
        _statistics = statistics;
        _options = options.Value;
        _logger = logger;
    }

    public SwitchDecisionResult Evaluate(ModelId? currentModel, IReadOnlyList<QueuedRequest> pending)
    {
        // No pending requests - keep current
        if (pending.Count == 0)
        {
            return SwitchDecisionResult.KeepCurrent(
                currentModel ?? new ModelId("none"),
                0,
                "No pending requests");
        }

        // Check starvation: any request past its max wait time
        var starvingRequest = pending.FirstOrDefault(r => r.IsStarving);
        if (starvingRequest is not null)
        {
            _logger.LogWarning(
                "Request {RequestId} for model {Model} is starving (waited {Wait:F1}s), forcing switch",
                starvingRequest.Id, starvingRequest.TargetModel, starvingRequest.WaitTime.TotalSeconds);

            return SwitchDecisionResult.ForcedSwitch(
                starvingRequest.TargetModel,
                $"Starvation: request waited {starvingRequest.WaitTime.TotalSeconds:F1}s");
        }

        // Group pending by model
        var groups = pending
            .GroupBy(r => r.TargetModel.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        // If no current model or current model has 0 pending, switch to model with most pending
        var currentModelKey = currentModel?.Value;
        var currentPendingCount = currentModelKey is not null && groups.ContainsKey(currentModelKey)
            ? groups[currentModelKey].Count
            : 0;

        if (currentModel is null || currentPendingCount == 0)
        {
            var bestModel = groups.OrderByDescending(g => g.Value.Count).First();
            return SwitchDecisionResult.SwitchTo(
                new ModelId(bestModel.Key),
                bestModel.Value.Count,
                $"No current model or 0 pending for current; {bestModel.Value.Count} pending for {bestModel.Key}");
        }

        // Evaluate switch score for each alternative model
        var bestScore = double.MinValue;
        string? bestTarget = null;
        string bestReason = "";

        foreach (var (modelKey, requests) in groups)
        {
            if (modelKey == currentModelKey)
            {
                continue;
            }

            var targetModelId = new ModelId(modelKey);
            var profile = _statistics.GetPerformanceProfile(targetModelId);
            var currentProfile = _statistics.GetPerformanceProfile(currentModel.Value);

            var estimatedSwitchTimeMs = profile?.AverageLoadTime.TotalMilliseconds ?? _options.DefaultSwitchCostMs;
            var avgResponseForTarget = profile?.AverageResponseTime.TotalMilliseconds ?? 1000;
            var avgResponseForCurrent = currentProfile?.AverageResponseTime.TotalMilliseconds ?? 1000;

            // score = (pendingForTarget * avgResponseTimeMs) - (estimatedSwitchTimeMs + pendingForCurrent * avgResponseTimeMs)
            var score = (requests.Count * avgResponseForTarget)
                      - (estimatedSwitchTimeMs + currentPendingCount * avgResponseForCurrent);

            var reason = $"{requests.Count} pending for {modelKey} vs {currentPendingCount} for {currentModelKey}, " +
                        $"switch cost {estimatedSwitchTimeMs:F0}ms";

            _logger.LogDebug("Switch score for {Model}: {Score:F1} ({Reason})", modelKey, score, reason);

            if (score > bestScore)
            {
                bestScore = score;
                bestTarget = modelKey;
                bestReason = reason;
            }
        }

        if (bestTarget is not null && bestScore > _options.SwitchCostThreshold)
        {
            return SwitchDecisionResult.SwitchTo(new ModelId(bestTarget), bestScore, bestReason);
        }

        return SwitchDecisionResult.KeepCurrent(currentModel.Value, bestScore, bestReason);
    }
}
