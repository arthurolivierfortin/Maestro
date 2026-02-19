using System;
using System.Collections.Generic;
using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a training experiment.
/// Logic is in the strategy blocks; this entity is for persistence only.
/// </summary>
public class TrainingExperiment
{
    public string Id { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string WorkspaceId { get; private set; } = string.Empty;
    public string TargetAgentId { get; private set; } = string.Empty;
    public string StrategyBlockId { get; private set; } = string.Empty;
    public ExperimentStatus Status { get; private set; }
    public Dictionary<string, object> Config { get; private set; } = new();
    public List<string> SessionIds { get; private set; } = new();
    public ExperimentResults? Results { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? StartedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public string? Error { get; private set; }
    public int CurrentIteration { get; private set; }
    public double CurrentFitness { get; private set; }

    private TrainingExperiment() { }

    public static TrainingExperiment Create(
        string name,
        string workspaceId,
        string targetAgentId,
        string strategyBlockId,
        Dictionary<string, object>? config = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name is required", nameof(name));
        if (string.IsNullOrWhiteSpace(workspaceId))
            throw new ArgumentException("WorkspaceId is required", nameof(workspaceId));
        if (string.IsNullOrWhiteSpace(targetAgentId))
            throw new ArgumentException("TargetAgentId is required", nameof(targetAgentId));
        if (string.IsNullOrWhiteSpace(strategyBlockId))
            throw new ArgumentException("StrategyBlockId is required", nameof(strategyBlockId));

        return new TrainingExperiment
        {
            Id = $"exp-{Guid.NewGuid():N}",
            Name = name,
            WorkspaceId = workspaceId,
            TargetAgentId = targetAgentId,
            StrategyBlockId = strategyBlockId,
            Status = ExperimentStatus.Created,
            Config = config ?? new Dictionary<string, object>(),
            SessionIds = new List<string>(),
            CreatedAt = DateTimeOffset.UtcNow,
            CurrentIteration = 0,
            CurrentFitness = 0
        };
    }

    /// <summary>
    /// Reconstitute from persistence
    /// </summary>
    public static TrainingExperiment Reconstitute(
        string id,
        string name,
        string workspaceId,
        string targetAgentId,
        string strategyBlockId,
        ExperimentStatus status,
        Dictionary<string, object> config,
        List<string> sessionIds,
        ExperimentResults? results,
        DateTimeOffset createdAt,
        DateTimeOffset? startedAt,
        DateTimeOffset? completedAt,
        string? error,
        int currentIteration,
        double currentFitness)
    {
        return new TrainingExperiment
        {
            Id = id,
            Name = name,
            WorkspaceId = workspaceId,
            TargetAgentId = targetAgentId,
            StrategyBlockId = strategyBlockId,
            Status = status,
            Config = config,
            SessionIds = sessionIds,
            Results = results,
            CreatedAt = createdAt,
            StartedAt = startedAt,
            CompletedAt = completedAt,
            Error = error,
            CurrentIteration = currentIteration,
            CurrentFitness = currentFitness
        };
    }

    public void Start()
    {
        if (Status != ExperimentStatus.Created && Status != ExperimentStatus.Paused)
            throw new InvalidOperationException($"Cannot start experiment in status {Status}");

        Status = ExperimentStatus.Running;
        StartedAt ??= DateTimeOffset.UtcNow;
    }

    public void Pause()
    {
        if (Status != ExperimentStatus.Running)
            throw new InvalidOperationException($"Cannot pause experiment in status {Status}");

        Status = ExperimentStatus.Paused;
    }

    public void UpdateProgress(int iteration, double fitness)
    {
        if (Status != ExperimentStatus.Running)
            throw new InvalidOperationException($"Cannot update progress in status {Status}");

        CurrentIteration = iteration;
        CurrentFitness = fitness;
    }

    public void Complete(ExperimentResults results)
    {
        if (results == null)
            throw new ArgumentNullException(nameof(results));

        Status = ExperimentStatus.Completed;
        Results = results;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    public void Fail(string error)
    {
        if (string.IsNullOrWhiteSpace(error))
            throw new ArgumentException("Error message is required", nameof(error));

        Status = ExperimentStatus.Failed;
        Error = error;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    public void Cancel()
    {
        Status = ExperimentStatus.Cancelled;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    public void AddSession(string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
            throw new ArgumentException("SessionId is required", nameof(sessionId));

        SessionIds.Add(sessionId);
    }

    public void UpdateConfig(Dictionary<string, object> newConfig)
    {
        if (Status == ExperimentStatus.Running)
            throw new InvalidOperationException("Cannot update config while experiment is running");

        foreach (var kvp in newConfig)
        {
            Config[kvp.Key] = kvp.Value;
        }
    }
}

public enum ExperimentStatus
{
    Created,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled
}
