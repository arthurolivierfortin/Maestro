using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.DTOs.Statistics;

/// <summary>
/// Aggregated statistics for a single model.
/// </summary>
public sealed record ModelStatistics(
    ModelId ModelId,
    int RequestCount,
    LatencyPercentiles Latency,
    TokenUsage TotalTokens,
    double RequestsPerMinute,
    double ErrorRate);
