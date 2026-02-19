using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.DTOs.Statistics;

/// <summary>
/// Performance profile for a model based on historical data.
/// </summary>
public sealed record PerformanceProfile(
    ModelId ModelId,
    TimeSpan AverageLoadTime,
    TimeSpan AverageResponseTime,
    double AvgTokensPerRequest,
    int TotalRequests,
    double ErrorRate,
    DateTimeOffset LastUsed);
