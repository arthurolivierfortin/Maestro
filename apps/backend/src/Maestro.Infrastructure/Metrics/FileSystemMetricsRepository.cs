using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Metrics;

/// <summary>
/// File system-based repository for execution metrics.
/// Stores metrics as JSON files in a metrics directory.
/// </summary>
public class FileSystemMetricsRepository : IMetricsRepository
{
    private readonly string _metricsPath;
    private readonly ILogger<FileSystemMetricsRepository>? _logger;
    private readonly JsonSerializerOptions _jsonOptions;
    private readonly object _lock = new();

    public FileSystemMetricsRepository(string metricsPath, ILogger<FileSystemMetricsRepository>? logger = null)
    {
        _metricsPath = metricsPath;
        _logger = logger;
        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        // Ensure directory exists
        Directory.CreateDirectory(_metricsPath);
    }

    public async Task SaveAsync(WorkflowExecutionMetrics metrics, CancellationToken ct = default)
    {
        var filePath = GetMetricsFilePath(metrics.ExecutionId);
        var json = JsonSerializer.Serialize(metrics, _jsonOptions);

        await File.WriteAllTextAsync(filePath, json, ct);

        // Also update the index
        await UpdateIndexAsync(metrics, ct);

        _logger?.LogDebug("Saved metrics for execution {ExecutionId} to {Path}",
            metrics.ExecutionId, filePath);
    }

    public async Task<WorkflowExecutionMetrics?> GetByExecutionIdAsync(string executionId, CancellationToken ct = default)
    {
        var filePath = GetMetricsFilePath(executionId);

        if (!File.Exists(filePath))
        {
            return null;
        }

        var json = await File.ReadAllTextAsync(filePath, ct);
        return JsonSerializer.Deserialize<WorkflowExecutionMetrics>(json, _jsonOptions);
    }

    public async Task<IReadOnlyList<WorkflowExecutionMetrics>> GetByWorkflowIdAsync(
        string workflowId,
        int? limit = null,
        int? offset = null,
        CancellationToken ct = default)
    {
        var index = await LoadIndexAsync(ct);
        var entries = index.Entries
            .Where(e => e.WorkflowId == workflowId)
            .OrderByDescending(e => e.StartedAt)
            .Skip(offset ?? 0)
            .Take(limit ?? int.MaxValue)
            .ToList();

        var results = new List<WorkflowExecutionMetrics>();
        foreach (var entry in entries)
        {
            var metrics = await GetByExecutionIdAsync(entry.ExecutionId, ct);
            if (metrics != null)
            {
                results.Add(metrics);
            }
        }

        return results;
    }

    public async Task<IReadOnlyList<WorkflowExecutionMetrics>> GetByTrainingRunIdAsync(
        string trainingRunId,
        CancellationToken ct = default)
    {
        var index = await LoadIndexAsync(ct);
        var entries = index.Entries
            .Where(e => e.TrainingRunId == trainingRunId)
            .OrderBy(e => e.IterationNumber)
            .ToList();

        var results = new List<WorkflowExecutionMetrics>();
        foreach (var entry in entries)
        {
            var metrics = await GetByExecutionIdAsync(entry.ExecutionId, ct);
            if (metrics != null)
            {
                results.Add(metrics);
            }
        }

        return results;
    }

    public async Task<IReadOnlyList<WorkflowExecutionMetrics>> QueryAsync(
        MetricsQuery query,
        CancellationToken ct = default)
    {
        var index = await LoadIndexAsync(ct);
        var entries = index.Entries.AsEnumerable();

        // Apply filters
        if (!string.IsNullOrEmpty(query.WorkflowId))
        {
            entries = entries.Where(e => e.WorkflowId == query.WorkflowId);
        }

        if (!string.IsNullOrEmpty(query.TrainingRunId))
        {
            entries = entries.Where(e => e.TrainingRunId == query.TrainingRunId);
        }

        if (query.StartDate.HasValue)
        {
            entries = entries.Where(e => e.StartedAt >= query.StartDate.Value);
        }

        if (query.EndDate.HasValue)
        {
            entries = entries.Where(e => e.StartedAt <= query.EndDate.Value);
        }

        if (!string.IsNullOrEmpty(query.Status))
        {
            entries = entries.Where(e => e.Status == query.Status);
        }

        if (query.MaxCost.HasValue)
        {
            entries = entries.Where(e => e.TotalCostUsd <= query.MaxCost.Value);
        }

        // Apply ordering
        entries = query.OrderBy?.ToLower() switch
        {
            "cost" => query.Descending
                ? entries.OrderByDescending(e => e.TotalCostUsd)
                : entries.OrderBy(e => e.TotalCostUsd),
            "duration" => query.Descending
                ? entries.OrderByDescending(e => e.DurationMs)
                : entries.OrderBy(e => e.DurationMs),
            _ => query.Descending
                ? entries.OrderByDescending(e => e.StartedAt)
                : entries.OrderBy(e => e.StartedAt)
        };

        // Apply pagination
        entries = entries.Skip(query.Offset).Take(query.Limit);

        // Load full metrics
        var results = new List<WorkflowExecutionMetrics>();
        foreach (var entry in entries)
        {
            var metrics = await GetByExecutionIdAsync(entry.ExecutionId, ct);
            if (metrics != null)
            {
                // Apply quality filter after loading (not in index)
                if (query.MinQualityScore.HasValue)
                {
                    if (metrics.Quality == null || metrics.Quality.Score < query.MinQualityScore.Value)
                    {
                        continue;
                    }
                }

                results.Add(metrics);
            }
        }

        return results;
    }

    public async Task<AggregatedMetrics> GetAggregatedAsync(
        string? workflowId = null,
        DateTimeOffset? startDate = null,
        DateTimeOffset? endDate = null,
        CancellationToken ct = default)
    {
        var index = await LoadIndexAsync(ct);
        var entries = index.Entries.AsEnumerable();

        if (!string.IsNullOrEmpty(workflowId))
        {
            entries = entries.Where(e => e.WorkflowId == workflowId);
        }

        if (startDate.HasValue)
        {
            entries = entries.Where(e => e.StartedAt >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            entries = entries.Where(e => e.StartedAt <= endDate.Value);
        }

        var entryList = entries.ToList();

        if (!entryList.Any())
        {
            return new AggregatedMetrics();
        }

        var successful = entryList.Where(e => e.Status == "Completed").ToList();

        return new AggregatedMetrics
        {
            TotalExecutions = entryList.Count,
            SuccessfulExecutions = successful.Count,
            FailedExecutions = entryList.Count(e => e.Status == "Failed"),
            AverageDurationMs = (long)entryList.Average(e => e.DurationMs),
            MinDurationMs = entryList.Min(e => e.DurationMs),
            MaxDurationMs = entryList.Max(e => e.DurationMs),
            TotalCostUsd = entryList.Sum(e => e.TotalCostUsd),
            AverageCostUsd = entryList.Average(e => e.TotalCostUsd),
            TotalTokens = entryList.Sum(e => e.TotalTokens),
            AverageInputTokens = (int)entryList.Average(e => e.InputTokens),
            AverageOutputTokens = (int)entryList.Average(e => e.OutputTokens),
            ExecutionsByStatus = entryList
                .GroupBy(e => e.Status)
                .ToDictionary(g => g.Key, g => g.Count())
        };
    }

    public async Task<int> DeleteOlderThanAsync(DateTimeOffset cutoff, CancellationToken ct = default)
    {
        var index = await LoadIndexAsync(ct);
        var toDelete = index.Entries.Where(e => e.StartedAt < cutoff).ToList();

        foreach (var entry in toDelete)
        {
            var filePath = GetMetricsFilePath(entry.ExecutionId);
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
            }

            index.Entries.Remove(entry);
        }

        await SaveIndexAsync(index, ct);

        _logger?.LogInformation("Deleted {Count} metrics older than {Cutoff}", toDelete.Count, cutoff);

        return toDelete.Count;
    }

    private string GetMetricsFilePath(string executionId)
    {
        return Path.Combine(_metricsPath, $"{executionId}.metrics.json");
    }

    private string GetIndexFilePath()
    {
        return Path.Combine(_metricsPath, "_index.json");
    }

    private async Task<MetricsIndex> LoadIndexAsync(CancellationToken ct)
    {
        var indexPath = GetIndexFilePath();

        if (!File.Exists(indexPath))
        {
            return new MetricsIndex();
        }

        try
        {
            var json = await File.ReadAllTextAsync(indexPath, ct);
            return JsonSerializer.Deserialize<MetricsIndex>(json, _jsonOptions) ?? new MetricsIndex();
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to load metrics index, creating new one");
            return new MetricsIndex();
        }
    }

    private async Task SaveIndexAsync(MetricsIndex index, CancellationToken ct)
    {
        var indexPath = GetIndexFilePath();
        var json = JsonSerializer.Serialize(index, _jsonOptions);

        lock (_lock)
        {
            File.WriteAllText(indexPath, json);
        }

        await Task.CompletedTask;
    }

    private async Task UpdateIndexAsync(WorkflowExecutionMetrics metrics, CancellationToken ct)
    {
        var index = await LoadIndexAsync(ct);

        // Remove existing entry if present
        index.Entries.RemoveAll(e => e.ExecutionId == metrics.ExecutionId);

        // Add new entry
        index.Entries.Add(new MetricsIndexEntry
        {
            ExecutionId = metrics.ExecutionId,
            WorkflowId = metrics.WorkflowId,
            TrainingRunId = metrics.TrainingRunId,
            IterationNumber = metrics.IterationNumber,
            StartedAt = metrics.StartedAt,
            DurationMs = metrics.TotalDurationMs,
            TotalCostUsd = metrics.TotalCostUsd,
            Status = metrics.Status,
            TotalTokens = metrics.TotalInputTokens + metrics.TotalOutputTokens,
            InputTokens = metrics.TotalInputTokens,
            OutputTokens = metrics.TotalOutputTokens
        });

        await SaveIndexAsync(index, ct);
    }

    /// <summary>
    /// Index file structure for fast queries.
    /// </summary>
    private class MetricsIndex
    {
        public List<MetricsIndexEntry> Entries { get; set; } = new();
    }

    /// <summary>
    /// Index entry with summary data.
    /// </summary>
    private class MetricsIndexEntry
    {
        public string ExecutionId { get; set; } = string.Empty;
        public string WorkflowId { get; set; } = string.Empty;
        public string? TrainingRunId { get; set; }
        public int? IterationNumber { get; set; }
        public DateTimeOffset StartedAt { get; set; }
        public long DurationMs { get; set; }
        public decimal TotalCostUsd { get; set; }
        public string Status { get; set; } = string.Empty;
        public int TotalTokens { get; set; }
        public int InputTokens { get; set; }
        public int OutputTokens { get; set; }
    }
}
