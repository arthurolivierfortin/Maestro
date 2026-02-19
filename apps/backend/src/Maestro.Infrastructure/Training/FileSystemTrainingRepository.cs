using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Training;

/// <summary>
/// File system-based repository for training configurations and runs.
/// </summary>
public class FileSystemTrainingConfigurationRepository : ITrainingConfigurationRepository
{
    private readonly string _configPath;
    private readonly ILogger<FileSystemTrainingConfigurationRepository>? _logger;
    private readonly JsonSerializerOptions _jsonOptions;

    public FileSystemTrainingConfigurationRepository(string basePath, ILogger<FileSystemTrainingConfigurationRepository>? logger = null)
    {
        _configPath = Path.Combine(basePath, "configurations");
        _logger = logger;
        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        Directory.CreateDirectory(_configPath);
    }

    public async Task SaveAsync(TrainingConfiguration config, CancellationToken ct = default)
    {
        config.UpdatedAt = DateTimeOffset.UtcNow;
        var filePath = GetConfigFilePath(config.Id);
        var json = JsonSerializer.Serialize(config, _jsonOptions);
        await File.WriteAllTextAsync(filePath, json, ct);

        _logger?.LogDebug("Saved training configuration {Id} to {Path}", config.Id, filePath);
    }

    public async Task<TrainingConfiguration?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        var filePath = GetConfigFilePath(id);

        if (!File.Exists(filePath))
        {
            return null;
        }

        var json = await File.ReadAllTextAsync(filePath, ct);
        return JsonSerializer.Deserialize<TrainingConfiguration>(json, _jsonOptions);
    }

    public async Task<IReadOnlyList<TrainingConfiguration>> GetAllAsync(CancellationToken ct = default)
    {
        var results = new List<TrainingConfiguration>();

        if (!Directory.Exists(_configPath))
        {
            return results;
        }

        foreach (var file in Directory.GetFiles(_configPath, "*.config.json"))
        {
            try
            {
                var json = await File.ReadAllTextAsync(file, ct);
                var config = JsonSerializer.Deserialize<TrainingConfiguration>(json, _jsonOptions);
                if (config != null)
                {
                    results.Add(config);
                }
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to load configuration from {File}", file);
            }
        }

        return results.OrderByDescending(c => c.UpdatedAt).ToList();
    }

    public async Task<IReadOnlyList<TrainingConfiguration>> GetByWorkflowIdAsync(string workflowId, CancellationToken ct = default)
    {
        var all = await GetAllAsync(ct);
        return all.Where(c => c.WorkflowId == workflowId).ToList();
    }

    public Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var filePath = GetConfigFilePath(id);

        if (File.Exists(filePath))
        {
            File.Delete(filePath);
            _logger?.LogDebug("Deleted training configuration {Id}", id);
        }

        return Task.CompletedTask;
    }

    private string GetConfigFilePath(string id)
    {
        return Path.Combine(_configPath, $"{id}.config.json");
    }
}

/// <summary>
/// File system-based repository for training runs.
/// </summary>
public class FileSystemTrainingRunRepository : ITrainingRunRepository
{
    private readonly string _runsPath;
    private readonly ILogger<FileSystemTrainingRunRepository>? _logger;
    private readonly JsonSerializerOptions _jsonOptions;

    public FileSystemTrainingRunRepository(string basePath, ILogger<FileSystemTrainingRunRepository>? logger = null)
    {
        _runsPath = Path.Combine(basePath, "runs");
        _logger = logger;
        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        Directory.CreateDirectory(_runsPath);
    }

    public async Task SaveAsync(TrainingRun run, CancellationToken ct = default)
    {
        var filePath = GetRunFilePath(run.Id);
        var json = JsonSerializer.Serialize(run, _jsonOptions);
        await File.WriteAllTextAsync(filePath, json, ct);

        _logger?.LogDebug("Saved training run {Id} to {Path}", run.Id, filePath);
    }

    public async Task<TrainingRun?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        var filePath = GetRunFilePath(id);

        if (!File.Exists(filePath))
        {
            return null;
        }

        var json = await File.ReadAllTextAsync(filePath, ct);
        return JsonSerializer.Deserialize<TrainingRun>(json, _jsonOptions);
    }

    public async Task<IReadOnlyList<TrainingRun>> GetAllAsync(int? limit = null, int? offset = null, CancellationToken ct = default)
    {
        var results = new List<TrainingRun>();

        if (!Directory.Exists(_runsPath))
        {
            return results;
        }

        foreach (var file in Directory.GetFiles(_runsPath, "*.run.json"))
        {
            try
            {
                var json = await File.ReadAllTextAsync(file, ct);
                var run = JsonSerializer.Deserialize<TrainingRun>(json, _jsonOptions);
                if (run != null)
                {
                    results.Add(run);
                }
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to load training run from {File}", file);
            }
        }

        var ordered = results.OrderByDescending(r => r.CreatedAt).AsEnumerable();

        if (offset.HasValue)
        {
            ordered = ordered.Skip(offset.Value);
        }

        if (limit.HasValue)
        {
            ordered = ordered.Take(limit.Value);
        }

        return ordered.ToList();
    }

    public async Task<IReadOnlyList<TrainingRun>> GetByConfigurationIdAsync(string configurationId, CancellationToken ct = default)
    {
        var all = await GetAllAsync(ct: ct);
        return all.Where(r => r.ConfigurationId == configurationId)
            .OrderByDescending(r => r.CreatedAt)
            .ToList();
    }

    public async Task<IReadOnlyList<TrainingRun>> GetByWorkflowIdAsync(string workflowId, CancellationToken ct = default)
    {
        var all = await GetAllAsync(ct: ct);
        return all.Where(r => r.WorkflowId == workflowId)
            .OrderByDescending(r => r.CreatedAt)
            .ToList();
    }

    public async Task<IReadOnlyList<TrainingRun>> GetActiveRunsAsync(CancellationToken ct = default)
    {
        var all = await GetAllAsync(ct: ct);
        return all.Where(r => r.Status == TrainingRunStatus.Running || r.Status == TrainingRunStatus.Paused)
            .ToList();
    }

    public Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var filePath = GetRunFilePath(id);

        if (File.Exists(filePath))
        {
            File.Delete(filePath);
            _logger?.LogDebug("Deleted training run {Id}", id);
        }

        return Task.CompletedTask;
    }

    private string GetRunFilePath(string id)
    {
        return Path.Combine(_runsPath, $"{id}.run.json");
    }
}
