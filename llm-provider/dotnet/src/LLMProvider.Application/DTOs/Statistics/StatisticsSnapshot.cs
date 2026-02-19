using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.DTOs.Statistics;

/// <summary>
/// Complete snapshot of all statistics at a point in time.
/// </summary>
public sealed record StatisticsSnapshot(
    int TotalRequests,
    LatencyPercentiles Latency,
    TokenUsage TotalTokens,
    IReadOnlyList<ModelStatistics> ModelStats,
    QueueStatistics Queue,
    SwitchingStatistics Switching,
    IReadOnlyList<TimeWindowMetrics> TimeWindows,
    DateTimeOffset GeneratedAt);
