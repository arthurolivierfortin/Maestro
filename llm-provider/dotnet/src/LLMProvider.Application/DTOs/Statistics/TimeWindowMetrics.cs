namespace LLMProvider.Application.DTOs.Statistics;

/// <summary>
/// Metrics for a specific sliding time window.
/// </summary>
public sealed record TimeWindowMetrics(
    string WindowName,
    int WindowSeconds,
    int RequestCount,
    double RequestsPerMinute,
    LatencyPercentiles Latency,
    int TokensTotal);
