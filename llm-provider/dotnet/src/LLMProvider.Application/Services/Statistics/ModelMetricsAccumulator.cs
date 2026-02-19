using LLMProvider.Application.DTOs.Statistics;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.Services.Statistics;

/// <summary>
/// Accumulates per-model metrics for statistics and performance profiling.
/// </summary>
internal sealed class ModelMetricsAccumulator
{
    private readonly ModelId _modelId;
    private readonly object _lock = new();

    private long _requestCount;
    private long _totalLatencyMs;
    private long _totalPromptTokens;
    private long _totalCompletionTokens;
    private long _errorCount;
    private readonly List<double> _latencySamples = new(1000);
    private DateTimeOffset _firstRequest = DateTimeOffset.MinValue;
    private DateTimeOffset _lastRequest = DateTimeOffset.MinValue;

    // For performance profile
    private long _totalLoadTimeMs;
    private int _loadCount;

    public ModelMetricsAccumulator(ModelId modelId)
    {
        _modelId = modelId;
    }

    public void Record(RequestMetricEntry entry)
    {
        lock (_lock)
        {
            _requestCount++;
            _totalLatencyMs += entry.LatencyMs;
            _totalPromptTokens += entry.TokenUsage.PromptTokens;
            _totalCompletionTokens += entry.TokenUsage.CompletionTokens;

            if (_firstRequest == DateTimeOffset.MinValue)
            {
                _firstRequest = entry.Timestamp;
            }

            _lastRequest = entry.Timestamp;

            // Keep last 1000 latency samples for percentile calculation
            if (_latencySamples.Count >= 1000)
            {
                _latencySamples.RemoveAt(0);
            }

            _latencySamples.Add(entry.LatencyMs);
        }
    }

    public void RecordError()
    {
        Interlocked.Increment(ref _errorCount);
    }

    public void RecordLoadTime(TimeSpan loadTime)
    {
        lock (_lock)
        {
            _totalLoadTimeMs += (long)loadTime.TotalMilliseconds;
            _loadCount++;
        }
    }

    public ModelStatistics GetStatistics()
    {
        lock (_lock)
        {
            var latency = CalculatePercentiles();
            var totalCount = _requestCount;
            var duration = _lastRequest - _firstRequest;
            var rpm = duration.TotalMinutes > 0 ? totalCount / duration.TotalMinutes : 0;
            var errorRate = totalCount > 0 ? (double)_errorCount / totalCount : 0;

            return new ModelStatistics(
                ModelId: _modelId,
                RequestCount: (int)totalCount,
                Latency: latency,
                TotalTokens: new TokenUsage((int)_totalPromptTokens, (int)_totalCompletionTokens),
                RequestsPerMinute: rpm,
                ErrorRate: errorRate
            );
        }
    }

    public PerformanceProfile GetProfile()
    {
        lock (_lock)
        {
            var totalCount = _requestCount;
            var avgResponseMs = totalCount > 0 ? _totalLatencyMs / (double)totalCount : 0;
            var avgTokens = totalCount > 0 ? (_totalPromptTokens + _totalCompletionTokens) / (double)totalCount : 0;
            var avgLoadMs = _loadCount > 0 ? _totalLoadTimeMs / (double)_loadCount : 0;
            var errorRate = totalCount > 0 ? (double)_errorCount / totalCount : 0;

            return new PerformanceProfile(
                ModelId: _modelId,
                AverageLoadTime: TimeSpan.FromMilliseconds(avgLoadMs),
                AverageResponseTime: TimeSpan.FromMilliseconds(avgResponseMs),
                AvgTokensPerRequest: avgTokens,
                TotalRequests: (int)totalCount,
                ErrorRate: errorRate,
                LastUsed: _lastRequest == DateTimeOffset.MinValue ? DateTimeOffset.UtcNow : _lastRequest
            );
        }
    }

    private LatencyPercentiles CalculatePercentiles()
    {
        if (_latencySamples.Count == 0)
        {
            return new LatencyPercentiles(0, 0, 0, 0);
        }

        var sorted = _latencySamples.OrderBy(v => v).ToList();
        return new LatencyPercentiles(
            P50: Percentile(sorted, 0.50),
            P95: Percentile(sorted, 0.95),
            P99: Percentile(sorted, 0.99),
            Average: sorted.Average()
        );
    }

    private static double Percentile(List<double> sorted, double p)
    {
        if (sorted.Count == 0)
        {
            return 0;
        }

        if (sorted.Count == 1)
        {
            return sorted[0];
        }

        var index = p * (sorted.Count - 1);
        var lower = (int)Math.Floor(index);
        var upper = (int)Math.Ceiling(index);
        var weight = index - lower;

        if (lower == upper)
        {
            return sorted[lower];
        }

        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
}
