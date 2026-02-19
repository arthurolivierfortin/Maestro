using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.DTOs.Statistics;

/// <summary>
/// A single recorded request metric.
/// </summary>
public sealed record RequestMetricEntry
{
    public required ModelId ModelId { get; init; }
    public required ProviderType ProviderType { get; init; }
    public required long LatencyMs { get; init; }
    public required TokenUsage TokenUsage { get; init; }
    public required DateTimeOffset Timestamp { get; init; }
    public TimeSpan? QueueWaitTime { get; init; }
}
