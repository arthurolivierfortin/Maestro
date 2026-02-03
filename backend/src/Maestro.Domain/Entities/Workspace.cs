using System;
using System.Collections.Generic;
using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Workspace type determining the purpose and default settings.
/// </summary>
public enum WorkspaceType
{
    /// <summary>Research workspace for development and experimentation.</summary>
    Research,
    /// <summary>Training workspace for training runs and fitness evaluation.</summary>
    Training,
    /// <summary>Staging workspace for integration testing and validation.</summary>
    Staging,
    /// <summary>Production workspace for live workloads.</summary>
    Production,
    /// <summary>Custom workspace with user-defined settings.</summary>
    Custom
}

/// <summary>
/// Workspace status.
/// </summary>
public enum WorkspaceStatus
{
    Active,
    Paused,
    Archived
}

/// <summary>
/// Workspace entity for grouping sessions, projects, and catalogs.
/// Supports optional Docker-based isolation.
/// </summary>
public class Workspace
{
    public string Id { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public WorkspaceType Type { get; private set; }
    public WorkspaceStatus Status { get; private set; }

    /// <summary>Sessions assigned to this workspace.</summary>
    public List<string> SessionIds { get; private set; } = new();

    /// <summary>Projects assigned to this workspace.</summary>
    public List<string> ProjectIds { get; private set; } = new();

    /// <summary>Block catalog reference for this workspace.</summary>
    public string? CatalogRef { get; private set; }

    /// <summary>Workspace settings.</summary>
    public WorkspaceSettings Settings { get; private set; } = new();

    /// <summary>Isolation configuration for Docker-based separation.</summary>
    public WorkspaceIsolation Isolation { get; private set; } = new();

    /// <summary>Metadata about the workspace.</summary>
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public string? CreatedBy { get; private set; }

    private Workspace() { }

    /// <summary>
    /// Creates a new workspace.
    /// </summary>
    public static Workspace Create(
        string name,
        WorkspaceType type,
        string? description = null,
        string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Workspace name is required", nameof(name));

        return new Workspace
        {
            Id = Guid.NewGuid().ToString(),
            Name = name,
            Description = description,
            Type = type,
            Status = WorkspaceStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
            Settings = WorkspaceSettings.DefaultForType(type),
            Isolation = new WorkspaceIsolation()
        };
    }

    /// <summary>
    /// Creates a workspace with isolation enabled.
    /// </summary>
    public static Workspace CreateIsolated(
        string name,
        WorkspaceType type,
        WorkspaceIsolation isolation,
        string? description = null,
        string? createdBy = null)
    {
        var workspace = Create(name, type, description, createdBy);
        workspace.Isolation = isolation;
        return workspace;
    }

    public void UpdateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Workspace name is required", nameof(name));
        Name = name;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void UpdateDescription(string? description)
    {
        Description = description;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void UpdateSettings(WorkspaceSettings settings)
    {
        Settings = settings ?? throw new ArgumentNullException(nameof(settings));
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void UpdateIsolation(WorkspaceIsolation isolation)
    {
        Isolation = isolation ?? throw new ArgumentNullException(nameof(isolation));
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void AddSession(string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
            throw new ArgumentException("Session ID is required", nameof(sessionId));

        if (!SessionIds.Contains(sessionId))
        {
            SessionIds.Add(sessionId);
            UpdatedAt = DateTimeOffset.UtcNow;
        }
    }

    public void RemoveSession(string sessionId)
    {
        if (SessionIds.Remove(sessionId))
        {
            UpdatedAt = DateTimeOffset.UtcNow;
        }
    }

    public void AddProject(string projectId)
    {
        if (string.IsNullOrWhiteSpace(projectId))
            throw new ArgumentException("Project ID is required", nameof(projectId));

        if (!ProjectIds.Contains(projectId))
        {
            ProjectIds.Add(projectId);
            UpdatedAt = DateTimeOffset.UtcNow;
        }
    }

    public void RemoveProject(string projectId)
    {
        if (ProjectIds.Remove(projectId))
        {
            UpdatedAt = DateTimeOffset.UtcNow;
        }
    }

    public void SetCatalogRef(string? catalogRef)
    {
        CatalogRef = catalogRef;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Pause()
    {
        Status = WorkspaceStatus.Paused;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Resume()
    {
        Status = WorkspaceStatus.Active;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Archive()
    {
        Status = WorkspaceStatus.Archived;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}

/// <summary>
/// Workspace settings.
/// </summary>
public class WorkspaceSettings
{
    /// <summary>Default model for inference in this workspace.</summary>
    public string? DefaultModelId { get; set; }

    /// <summary>Maximum concurrent sessions allowed.</summary>
    public int MaxConcurrentSessions { get; set; } = 10;

    /// <summary>Maximum concurrent training runs.</summary>
    public int MaxConcurrentTrainingRuns { get; set; } = 3;

    /// <summary>Whether auto-promotion is enabled for this workspace.</summary>
    public bool AutoPromotionEnabled { get; set; }

    /// <summary>Minimum fitness required for auto-promotion.</summary>
    public double MinFitnessForPromotion { get; set; } = 0.7;

    /// <summary>Tags for organization.</summary>
    public List<string> Tags { get; set; } = new();

    /// <summary>
    /// Get default settings for a workspace type.
    /// </summary>
    public static WorkspaceSettings DefaultForType(WorkspaceType type)
    {
        return type switch
        {
            WorkspaceType.Research => new WorkspaceSettings
            {
                MaxConcurrentSessions = 20,
                MaxConcurrentTrainingRuns = 5,
                AutoPromotionEnabled = false
            },
            WorkspaceType.Training => new WorkspaceSettings
            {
                MaxConcurrentSessions = 10,
                MaxConcurrentTrainingRuns = 10,
                AutoPromotionEnabled = true,
                MinFitnessForPromotion = 0.7
            },
            WorkspaceType.Staging => new WorkspaceSettings
            {
                MaxConcurrentSessions = 5,
                MaxConcurrentTrainingRuns = 2,
                AutoPromotionEnabled = true,
                MinFitnessForPromotion = 0.85
            },
            WorkspaceType.Production => new WorkspaceSettings
            {
                MaxConcurrentSessions = 50,
                MaxConcurrentTrainingRuns = 0, // No training in production
                AutoPromotionEnabled = false
            },
            _ => new WorkspaceSettings()
        };
    }
}
