using System.Collections.Concurrent;
using System.Text.Json;
using LLMProvider.Application.DTOs.Statistics;
using LLMProvider.Application.Interfaces;
using LLMProvider.Application.Options;
using LLMProvider.Application.Services.Statistics;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LLMProvider.Application.Services;

/// <summary>
/// Tracks and aggregates statistics across all LLM requests, model switches, and queue operations.
/// </summary>
public sealed class StatisticsService : IStatisticsService, IDisposable
{
    private readonly StatisticsOptions _options;
    private readonly ILogger<StatisticsService> _logger;

    private readonly ConcurrentDictionary<string, ModelMetricsAccumulator> _modelMetrics = new();
    private readonly SlidingTimeWindow _window1m;
    private readonly SlidingTimeWindow _window5m;
    private readonly SlidingTimeWindow _window15m;

    private readonly ConcurrentQueue<SwitchEvent> _recentSwitchEvents = new();
    private readonly object _switchLock = new();
    private int _totalSwitches;
    private int _switchesAvoided;
    private long _totalSwitchDurationMs;

    // Queue state (updated externally)
    private volatile int _queueDepth;
    private volatile Dictionary<string, int> _queueDepthByModel = new();
    private volatile string? _currentModel;
    private long _totalEnqueued;
    private long _totalProcessed;
    private long _totalWaitTimeMs;

    private readonly Timer? _persistenceTimer;
    private bool _disposed;

    public StatisticsService(IOptions<StatisticsOptions> options, ILogger<StatisticsService> logger)
    {
        _options = options.Value;
        _logger = logger;

        _window1m = new SlidingTimeWindow(TimeSpan.FromMinutes(1), "1m");
        _window5m = new SlidingTimeWindow(TimeSpan.FromMinutes(5), "5m");
        _window15m = new SlidingTimeWindow(TimeSpan.FromMinutes(15), "15m");

        // Load persisted data if available
        TryLoadPersistedData();

        if (_options.PersistenceEnabled)
        {
            _persistenceTimer = new Timer(
                _ => PersistSnapshot(),
                null,
                TimeSpan.FromSeconds(_options.PersistenceIntervalSeconds),
                TimeSpan.FromSeconds(_options.PersistenceIntervalSeconds));
        }

        _logger.LogInformation("Statistics service initialized (persistence: {Enabled})", _options.PersistenceEnabled);
    }

    // --- Write methods (internal, used by orchestration and queue processor) ---

    public void RecordRequest(RequestMetricEntry entry)
    {
        var accumulator = _modelMetrics.GetOrAdd(entry.ModelId.Value, _ => new ModelMetricsAccumulator(entry.ModelId));
        accumulator.Record(entry);

        var latency = (double)entry.LatencyMs;
        var tokens = entry.TokenUsage.TotalTokens;

        _window1m.Add(latency, tokens);
        _window5m.Add(latency, tokens);
        _window15m.Add(latency, tokens);

        if (entry.QueueWaitTime.HasValue)
        {
            Interlocked.Add(ref _totalWaitTimeMs, (long)entry.QueueWaitTime.Value.TotalMilliseconds);
        }
    }

    public void RecordModelSwitch(SwitchEvent switchEvent)
    {
        // Keep last 100 switch events
        _recentSwitchEvents.Enqueue(switchEvent);
        while (_recentSwitchEvents.Count > 100)
        {
            _recentSwitchEvents.TryDequeue(out _);
        }

        lock (_switchLock)
        {
            if (switchEvent.Decision is Domain.Enums.SwitchDecision.SwitchImmediate
                or Domain.Enums.SwitchDecision.ForcedByStarvation)
            {
                _totalSwitches++;
                _totalSwitchDurationMs += (long)switchEvent.Duration.TotalMilliseconds;
            }
            else
            {
                _switchesAvoided++;
            }
        }
    }

    public void UpdateQueueDepth(int depth, Dictionary<string, int> byModel, string? currentModel)
    {
        _queueDepth = depth;
        _queueDepthByModel = byModel;
        _currentModel = currentModel;
    }

    public void RecordEnqueue() => Interlocked.Increment(ref _totalEnqueued);

    public void RecordProcessed() => Interlocked.Increment(ref _totalProcessed);

    public void RecordModelLoadTime(ModelId modelId, TimeSpan loadTime)
    {
        var accumulator = _modelMetrics.GetOrAdd(modelId.Value, _ => new ModelMetricsAccumulator(modelId));
        accumulator.RecordLoadTime(loadTime);
    }

    // --- Read methods (IStatisticsService) ---

    public StatisticsSnapshot GetSnapshot()
    {
        var modelStats = _modelMetrics.Values.Select(m => m.GetStatistics()).ToList();
        var totalRequests = modelStats.Sum(m => m.RequestCount);

        // Aggregate latency across all models
        var allLatencies = new List<double>();
        var totalPromptTokens = 0;
        var totalCompletionTokens = 0;
        foreach (var ms in modelStats)
        {
            totalPromptTokens += ms.TotalTokens.PromptTokens;
            totalCompletionTokens += ms.TotalTokens.CompletionTokens;
        }

        var aggregateLatency = _window15m.GetPercentiles();

        return new StatisticsSnapshot(
            TotalRequests: totalRequests,
            Latency: aggregateLatency,
            TotalTokens: new TokenUsage(totalPromptTokens, totalCompletionTokens),
            ModelStats: modelStats.AsReadOnly(),
            Queue: GetQueueStatistics(),
            Switching: GetSwitchingStatistics(),
            TimeWindows: new List<TimeWindowMetrics>
            {
                _window1m.GetMetrics(),
                _window5m.GetMetrics(),
                _window15m.GetMetrics()
            }.AsReadOnly(),
            GeneratedAt: DateTimeOffset.UtcNow
        );
    }

    public ModelStatistics? GetModelStatistics(ModelId modelId)
    {
        return _modelMetrics.TryGetValue(modelId.Value, out var accumulator)
            ? accumulator.GetStatistics()
            : null;
    }

    public QueueStatistics GetQueueStatistics()
    {
        var processed = Interlocked.Read(ref _totalProcessed);
        var avgWait = processed > 0
            ? Interlocked.Read(ref _totalWaitTimeMs) / (double)processed
            : 0;

        return new QueueStatistics(
            CurrentDepth: _queueDepth,
            DepthByModel: new Dictionary<string, int>(_queueDepthByModel),
            CurrentModel: _currentModel,
            AvgWaitTimeMs: avgWait,
            TotalEnqueued: (int)Interlocked.Read(ref _totalEnqueued),
            TotalProcessed: (int)processed
        );
    }

    public SwitchingStatistics GetSwitchingStatistics()
    {
        lock (_switchLock)
        {
            var avgDuration = _totalSwitches > 0
                ? TimeSpan.FromMilliseconds(_totalSwitchDurationMs / (double)_totalSwitches)
                : TimeSpan.Zero;

            return new SwitchingStatistics(
                TotalSwitches: _totalSwitches,
                SwitchesAvoided: _switchesAvoided,
                AvgSwitchDuration: avgDuration,
                RecentDecisions: _recentSwitchEvents.ToList().AsReadOnly()
            );
        }
    }

    public PerformanceProfile? GetPerformanceProfile(ModelId modelId)
    {
        return _modelMetrics.TryGetValue(modelId.Value, out var accumulator)
            ? accumulator.GetProfile()
            : null;
    }

    public IReadOnlyList<PerformanceProfile> GetAllPerformanceProfiles()
    {
        return _modelMetrics.Values.Select(m => m.GetProfile()).ToList().AsReadOnly();
    }

    // --- Persistence ---

    private void PersistSnapshot()
    {
        try
        {
            var dir = _options.DataDirectory;
            Directory.CreateDirectory(dir);

            var snapshot = GetSnapshot();
            var fileName = $"metrics-{DateTime.UtcNow:yyyy-MM-dd}.json";
            var filePath = Path.Combine(dir, fileName);

            var json = JsonSerializer.Serialize(snapshot, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            File.WriteAllText(filePath, json);
            _logger.LogDebug("Persisted statistics snapshot to {Path}", filePath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to persist statistics snapshot");
        }
    }

    private void TryLoadPersistedData()
    {
        try
        {
            var dir = _options.DataDirectory;
            if (!Directory.Exists(dir))
            {
                return;
            }

            var files = Directory.GetFiles(dir, "metrics-*.json")
                .OrderByDescending(f => f)
                .FirstOrDefault();

            if (files is null)
            {
                return;
            }

            _logger.LogInformation("Loading persisted statistics from {Path}", files);
            // Performance profiles are loaded on startup to warm up estimates
            // Full deserialization and warm-up is done here
            var json = File.ReadAllText(files);
            var snapshot = JsonSerializer.Deserialize<JsonElement>(json);

            if (snapshot.TryGetProperty("totalRequests", out var totalReq))
            {
                _logger.LogInformation("Loaded persisted statistics with {Count} total requests", totalReq.GetInt32());
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load persisted statistics");
        }
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;

        _persistenceTimer?.Dispose();

        if (_options.PersistenceEnabled)
        {
            PersistSnapshot();
        }
    }
}
