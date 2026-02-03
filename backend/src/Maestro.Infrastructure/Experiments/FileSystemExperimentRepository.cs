using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Experiments;

public class FileSystemExperimentRepository : IExperimentRepository
{
    private readonly string _basePath;
    private readonly ILogger<FileSystemExperimentRepository>? _logger;
    private readonly JsonSerializerOptions _jsonOptions;

    public FileSystemExperimentRepository(string basePath, ILogger<FileSystemExperimentRepository>? logger = null)
    {
        _basePath = basePath;
        _logger = logger;
        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Converters = { new JsonStringEnumConverter() }
        };

        Directory.CreateDirectory(_basePath);
    }

    public async Task<TrainingExperiment?> GetByIdAsync(string id)
    {
        var filePath = GetFilePath(id);
        if (!File.Exists(filePath))
            return null;

        try
        {
            var json = await File.ReadAllTextAsync(filePath);
            var data = JsonSerializer.Deserialize<ExperimentData>(json, _jsonOptions);
            return data?.ToDomain();
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to load experiment {Id}", id);
            return null;
        }
    }

    public async Task<IEnumerable<TrainingExperiment>> GetByWorkspaceAsync(string workspaceId)
    {
        var all = await GetAllAsync();
        return all.Where(e => e.WorkspaceId == workspaceId);
    }

    public async Task<IEnumerable<TrainingExperiment>> GetByStatusAsync(ExperimentStatus status)
    {
        var all = await GetAllAsync();
        return all.Where(e => e.Status == status);
    }

    public async Task<IEnumerable<TrainingExperiment>> GetByAgentAsync(string agentId)
    {
        var all = await GetAllAsync();
        return all.Where(e => e.TargetAgentId == agentId);
    }

    public async Task<IEnumerable<TrainingExperiment>> GetByStrategyAsync(string strategyBlockId)
    {
        var all = await GetAllAsync();
        return all.Where(e => e.StrategyBlockId == strategyBlockId);
    }

    public async Task<IEnumerable<TrainingExperiment>> GetAllAsync()
    {
        var experiments = new List<TrainingExperiment>();

        if (!Directory.Exists(_basePath))
            return experiments;

        foreach (var file in Directory.GetFiles(_basePath, "*.json"))
        {
            try
            {
                var json = await File.ReadAllTextAsync(file);
                var data = JsonSerializer.Deserialize<ExperimentData>(json, _jsonOptions);
                if (data != null)
                {
                    var experiment = data.ToDomain();
                    if (experiment != null)
                        experiments.Add(experiment);
                }
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to load experiment from {File}", file);
            }
        }

        return experiments.OrderByDescending(e => e.CreatedAt);
    }

    public async Task SaveAsync(TrainingExperiment experiment)
    {
        var filePath = GetFilePath(experiment.Id);
        var data = ExperimentData.FromDomain(experiment);
        var json = JsonSerializer.Serialize(data, _jsonOptions);
        await File.WriteAllTextAsync(filePath, json);
        _logger?.LogDebug("Saved experiment {Id} to {Path}", experiment.Id, filePath);
    }

    public Task DeleteAsync(string id)
    {
        var filePath = GetFilePath(id);
        if (File.Exists(filePath))
        {
            File.Delete(filePath);
            _logger?.LogDebug("Deleted experiment {Id}", id);
        }
        return Task.CompletedTask;
    }

    public Task<bool> ExistsAsync(string id)
    {
        var filePath = GetFilePath(id);
        return Task.FromResult(File.Exists(filePath));
    }

    private string GetFilePath(string id) => Path.Combine(_basePath, $"{id}.json");

    /// <summary>
    /// Internal data class for JSON serialization
    /// </summary>
    private class ExperimentData
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string WorkspaceId { get; set; } = string.Empty;
        public string TargetAgentId { get; set; } = string.Empty;
        public string StrategyBlockId { get; set; } = string.Empty;
        public ExperimentStatus Status { get; set; }
        public Dictionary<string, object> Config { get; set; } = new();
        public List<string> SessionIds { get; set; } = new();
        public ExperimentResultsData? Results { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? StartedAt { get; set; }
        public DateTimeOffset? CompletedAt { get; set; }
        public string? Error { get; set; }
        public int CurrentIteration { get; set; }
        public double CurrentFitness { get; set; }

        public TrainingExperiment ToDomain()
        {
            return TrainingExperiment.Reconstitute(
                Id,
                Name,
                WorkspaceId,
                TargetAgentId,
                StrategyBlockId,
                Status,
                Config,
                SessionIds,
                Results?.ToDomain(),
                CreatedAt,
                StartedAt,
                CompletedAt,
                Error,
                CurrentIteration,
                CurrentFitness
            );
        }

        public static ExperimentData FromDomain(TrainingExperiment experiment)
        {
            return new ExperimentData
            {
                Id = experiment.Id,
                Name = experiment.Name,
                WorkspaceId = experiment.WorkspaceId,
                TargetAgentId = experiment.TargetAgentId,
                StrategyBlockId = experiment.StrategyBlockId,
                Status = experiment.Status,
                Config = experiment.Config,
                SessionIds = experiment.SessionIds,
                Results = experiment.Results != null
                    ? ExperimentResultsData.FromDomain(experiment.Results)
                    : null,
                CreatedAt = experiment.CreatedAt,
                StartedAt = experiment.StartedAt,
                CompletedAt = experiment.CompletedAt,
                Error = experiment.Error,
                CurrentIteration = experiment.CurrentIteration,
                CurrentFitness = experiment.CurrentFitness
            };
        }
    }

    private class ExperimentResultsData
    {
        public double InitialFitness { get; set; }
        public double FinalFitness { get; set; }
        public int TotalIterations { get; set; }
        public int SuccessfulIterations { get; set; }
        public decimal TotalCost { get; set; }
        public string TotalDuration { get; set; } = string.Empty;
        public double BestFitness { get; set; }
        public int BestIteration { get; set; }
        public string StopReason { get; set; } = string.Empty;
        public List<IterationSnapshotData> Snapshots { get; set; } = new();
        public Dictionary<string, object> Metadata { get; set; } = new();

        public ExperimentResults ToDomain()
        {
            return new ExperimentResults
            {
                InitialFitness = InitialFitness,
                FinalFitness = FinalFitness,
                TotalIterations = TotalIterations,
                SuccessfulIterations = SuccessfulIterations,
                TotalCost = TotalCost,
                TotalDuration = TimeSpan.TryParse(TotalDuration, out var ts) ? ts : TimeSpan.Zero,
                BestFitness = BestFitness,
                BestIteration = BestIteration,
                StopReason = StopReason,
                Snapshots = Snapshots.Select(s => s.ToDomain()).ToList(),
                Metadata = Metadata
            };
        }

        public static ExperimentResultsData FromDomain(ExperimentResults results)
        {
            return new ExperimentResultsData
            {
                InitialFitness = results.InitialFitness,
                FinalFitness = results.FinalFitness,
                TotalIterations = results.TotalIterations,
                SuccessfulIterations = results.SuccessfulIterations,
                TotalCost = results.TotalCost,
                TotalDuration = results.TotalDuration.ToString(),
                BestFitness = results.BestFitness,
                BestIteration = results.BestIteration,
                StopReason = results.StopReason,
                Snapshots = results.Snapshots.Select(IterationSnapshotData.FromDomain).ToList(),
                Metadata = results.Metadata
            };
        }
    }

    private class IterationSnapshotData
    {
        public int Iteration { get; set; }
        public double Fitness { get; set; }
        public decimal Cost { get; set; }
        public DateTimeOffset Timestamp { get; set; }
        public bool Success { get; set; }
        public Dictionary<string, double> Metrics { get; set; } = new();
        public string? Error { get; set; }

        public IterationSnapshot ToDomain()
        {
            return new IterationSnapshot
            {
                Iteration = Iteration,
                Fitness = Fitness,
                Cost = Cost,
                Timestamp = Timestamp,
                Success = Success,
                Metrics = Metrics,
                Error = Error
            };
        }

        public static IterationSnapshotData FromDomain(IterationSnapshot snapshot)
        {
            return new IterationSnapshotData
            {
                Iteration = snapshot.Iteration,
                Fitness = snapshot.Fitness,
                Cost = snapshot.Cost,
                Timestamp = snapshot.Timestamp,
                Success = snapshot.Success,
                Metrics = snapshot.Metrics,
                Error = snapshot.Error
            };
        }
    }
}
