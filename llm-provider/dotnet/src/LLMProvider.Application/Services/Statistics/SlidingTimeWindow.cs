using System.Collections.Concurrent;
using LLMProvider.Application.DTOs.Statistics;

namespace LLMProvider.Application.Services.Statistics;

/// <summary>
/// Tracks metrics within a sliding time window for percentile calculation.
/// </summary>
internal sealed class SlidingTimeWindow
{
    private readonly ConcurrentQueue<(DateTimeOffset Timestamp, double Value)> _entries = new();
    private readonly TimeSpan _windowDuration;
    private readonly string _name;
    private long _totalTokens;

    public SlidingTimeWindow(TimeSpan windowDuration, string name)
    {
        _windowDuration = windowDuration;
        _name = name;
    }

    public string Name => _name;
    public int WindowSeconds => (int)_windowDuration.TotalSeconds;

    public void Add(double latencyMs, int tokens = 0)
    {
        _entries.Enqueue((DateTimeOffset.UtcNow, latencyMs));
        Interlocked.Add(ref _totalTokens, tokens);
    }

    public void Prune()
    {
        var cutoff = DateTimeOffset.UtcNow - _windowDuration;
        while (_entries.TryPeek(out var oldest) && oldest.Timestamp < cutoff)
        {
            _entries.TryDequeue(out _);
        }
    }

    public int Count
    {
        get
        {
            Prune();
            return _entries.Count;
        }
    }

    public long TotalTokens => Interlocked.Read(ref _totalTokens);

    public double Rate
    {
        get
        {
            Prune();
            var count = _entries.Count;
            return count / _windowDuration.TotalMinutes;
        }
    }

    public LatencyPercentiles GetPercentiles()
    {
        Prune();
        var values = _entries.Select(e => e.Value).OrderBy(v => v).ToList();

        if (values.Count == 0)
        {
            return new LatencyPercentiles(0, 0, 0, 0);
        }

        return new LatencyPercentiles(
            P50: Percentile(values, 0.50),
            P95: Percentile(values, 0.95),
            P99: Percentile(values, 0.99),
            Average: values.Average()
        );
    }

    public TimeWindowMetrics GetMetrics()
    {
        Prune();
        return new TimeWindowMetrics(
            WindowName: _name,
            WindowSeconds: WindowSeconds,
            RequestCount: _entries.Count,
            RequestsPerMinute: Rate,
            Latency: GetPercentiles(),
            TokensTotal: (int)Interlocked.Read(ref _totalTokens)
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
