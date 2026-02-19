using Maestro.Domain.Enums;
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
/// Workspace status - maps to ContainerSessionStatus subset.
/// Kept for backwards compatibility with existing code.
/// </summary>
public enum WorkspaceStatus
{
    Active,
    Paused,
    Archived
}

/// <summary>
/// Workspace entity for grouping sessions, projects, and catalogs.
/// Supports optional Docker-based isolation and agent permission management.
///
/// Inherits from ContainerSession to provide unified permission inheritance
/// and lifecycle management across the session hierarchy.
///
/// Workspace is the ROOT of the permission inheritance chain.
/// </summary>
public class Workspace : ContainerSession
{
    // ===== Workspace-Specific Properties =====

    /// <summary>Workspace type determining default behavior.</summary>
    public WorkspaceType Type { get; private set; }

    /// <summary>Filesystem path for file-based workspaces.</summary>
    public string? Path { get; private set; }

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

    /// <summary>Session templates for creating sessions with preset permissions.</summary>
    public Dictionary<string, SessionTemplate> SessionTemplates { get; private set; } = new();

    /// <summary>Named entry points (main workflow, dashboard, etc.).</summary>
    public Dictionary<string, string> EntryPoints { get; private set; } = new();

    // ===== Backwards Compatibility =====

    /// <summary>
    /// Gets the workspace status (mapped from ContainerSessionStatus).
    /// Provides backwards compatibility with existing code.
    /// </summary>
    public WorkspaceStatus WorkspaceStatus => Status switch
    {
        ContainerSessionStatus.Active => WorkspaceStatus.Active,
        ContainerSessionStatus.Paused => WorkspaceStatus.Paused,
        ContainerSessionStatus.Archived => WorkspaceStatus.Archived,
        ContainerSessionStatus.Created => WorkspaceStatus.Active, // Treat created as active for workspaces
        _ => WorkspaceStatus.Active
    };

    // ===== ContainerSession Implementation =====

    /// <summary>
    /// Workspace is the root of the permission hierarchy - no parent.
    /// </summary>
    public override ContainerSession? GetParentContext() => null;

    /// <summary>
    /// Storage extension for workspace files.
    /// </summary>
    public override string GetStorageExtension() => ".workspace.json";

    /// <summary>
    /// Validates workspace status transitions.
    /// </summary>
    protected override bool CanTransitionTo(ContainerSessionStatus newStatus)
    {
        return (Status, newStatus) switch
        {
            // From Created
            (ContainerSessionStatus.Created, ContainerSessionStatus.Active) => true,

            // From Active
            (ContainerSessionStatus.Active, ContainerSessionStatus.Paused) => true,
            (ContainerSessionStatus.Active, ContainerSessionStatus.Archived) => true,

            // From Paused
            (ContainerSessionStatus.Paused, ContainerSessionStatus.Active) => true,
            (ContainerSessionStatus.Paused, ContainerSessionStatus.Archived) => true,

            // Archived is terminal for workspaces
            _ => false
        };
    }

    // ===== Constructor =====

    private Workspace()
    {
        // Default: no container binding. Can be overridden via BindToRepository().
        Binding = ContainerBinding.None;
    }

    // ===== Factory Methods =====

    /// <summary>
    /// Creates a new workspace.
    /// </summary>
    public static Workspace Create(
        string name,
        WorkspaceType type,
        string? description = null,
        string? createdBy = null,
        string? repositoryPath = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Workspace name is required", nameof(name));

        var ws = new Workspace
        {
            Id = Guid.NewGuid().ToString(),
            Name = name,
            Description = description,
            Type = type,
            Status = ContainerSessionStatus.Created,
            Permissions = ContextPermissions.Full,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy,
            Settings = WorkspaceSettings.DefaultForType(type),
            Isolation = new WorkspaceIsolation()
        };

        if (repositoryPath != null)
        {
            ws.BindToRepository(repositoryPath, RepositoryAccessLevel.Full);
        }

        // Workspaces start as Active
        ws.Status = ContainerSessionStatus.Active;

        return ws;
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

    /// <summary>
    /// Creates a workspace with a filesystem path and full configuration.
    /// </summary>
    public static Workspace CreateWithPath(
        string name,
        string path,
        WorkspaceType type,
        string? description = null,
        string? createdBy = null,
        ContextPermissions? permissions = null,
        Dictionary<string, SessionTemplate>? sessionTemplates = null,
        Dictionary<string, string>? entryPoints = null)
    {
        var workspace = Create(name, type, description, createdBy);
        workspace.Path = path;
        workspace.Permissions = permissions ?? ContextPermissions.Full;
        workspace.SessionTemplates = sessionTemplates ?? new();
        workspace.EntryPoints = entryPoints ?? new();
        return workspace;
    }

    /// <summary>
    /// Reconstitutes a workspace from persisted data.
    /// Used by repositories during deserialization.
    /// </summary>
    public static Workspace Reconstitute(
        string id,
        string name,
        string? description,
        WorkspaceType type,
        ContainerSessionStatus status,
        string? path,
        List<string> sessionIds,
        List<string> projectIds,
        string? catalogRef,
        WorkspaceSettings settings,
        WorkspaceIsolation isolation,
        ContextPermissions permissions,
        Dictionary<string, SessionTemplate> sessionTemplates,
        Dictionary<string, string> entryPoints,
        DateTimeOffset createdAt,
        DateTimeOffset? updatedAt,
        string? createdBy,
        string? repositoryPath = null,
        ContainerBinding? binding = null)
    {
        var ws = new Workspace
        {
            Id = id,
            Name = name,
            Description = description,
            Type = type,
            Status = status,
            Path = path,
            SessionIds = sessionIds,
            ProjectIds = projectIds,
            CatalogRef = catalogRef,
            Settings = settings,
            Isolation = isolation,
            Permissions = permissions,
            SessionTemplates = sessionTemplates,
            EntryPoints = entryPoints,
            CreatedAt = createdAt,
            UpdatedAt = updatedAt,
            CreatedBy = createdBy
        };

        if (repositoryPath != null)
        {
            ws.RepositoryPath = repositoryPath;
            ws.Binding = binding ?? ContainerBinding.CreateRepositoryBound(repositoryPath);
        }
        else if (binding != null && binding.Type == ContainerBindingType.Repository)
        {
            ws.RepositoryPath = binding.RepositoryPath;
            ws.Binding = binding;
        }

        return ws;
    }

    // ===== Update Methods =====

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

    public void UpdatePath(string? path)
    {
        Path = path;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void SetSessionTemplate(string templateType, SessionTemplate template)
    {
        if (string.IsNullOrWhiteSpace(templateType))
            throw new ArgumentException("Template type is required", nameof(templateType));

        SessionTemplates[templateType] = template ?? throw new ArgumentNullException(nameof(template));
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void RemoveSessionTemplate(string templateType)
    {
        if (SessionTemplates.Remove(templateType))
        {
            UpdatedAt = DateTimeOffset.UtcNow;
        }
    }

    public void SetEntryPoint(string name, string blockId)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Entry point name is required", nameof(name));

        EntryPoints[name] = blockId ?? throw new ArgumentNullException(nameof(blockId));
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void RemoveEntryPoint(string name)
    {
        if (EntryPoints.Remove(name))
        {
            UpdatedAt = DateTimeOffset.UtcNow;
        }
    }

    /// <summary>
    /// Get a session template by type.
    /// </summary>
    public SessionTemplate? GetSessionTemplate(string templateType)
    {
        return SessionTemplates.TryGetValue(templateType, out var template) ? template : null;
    }

    /// <summary>
    /// Get an entry point block ID by name.
    /// </summary>
    public string? GetEntryPoint(string name)
    {
        return EntryPoints.TryGetValue(name, out var blockId) ? blockId : null;
    }

    // ===== Session/Project Management =====

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

    // ===== Lifecycle Methods =====

    /// <summary>
    /// Pauses the workspace.
    /// </summary>
    public void Pause()
    {
        TransitionTo(ContainerSessionStatus.Paused);
    }

    /// <summary>
    /// Resumes a paused workspace.
    /// </summary>
    public void Resume()
    {
        TransitionTo(ContainerSessionStatus.Active);
    }

    /// <summary>
    /// Archives the workspace (terminal state).
    /// </summary>
    public void Archive()
    {
        TransitionTo(ContainerSessionStatus.Archived);
    }

    /// <summary>
    /// Activates a newly created workspace.
    /// </summary>
    public void Activate()
    {
        if (Status == ContainerSessionStatus.Created)
        {
            TransitionTo(ContainerSessionStatus.Active);
        }
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
