namespace LLMProvider.Application.DTOs.Statistics;

/// <summary>
/// Latency percentile breakdown.
/// </summary>
public sealed record LatencyPercentiles(double P50, double P95, double P99, double Average);
