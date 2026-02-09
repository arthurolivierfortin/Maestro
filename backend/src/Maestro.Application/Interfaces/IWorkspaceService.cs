using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Service for managing workspaces.
/// </summary>
public interface IWorkspaceService
{
    /// <summary>
    /// Create a new workspace.
    /// </summary>
    Task<Workspace> CreateWorkspaceAsync(
        string name,
        WorkspaceType type,
        string? description = null,
        bool isolated = false,
        WorkspaceIsolation? isolationConfig = null,
        string? repositoryPath = null,
        CancellationToken ct = default);

    /// <summary>
    /// Get a workspace by ID.
    /// </summary>
    Task<Workspace?> GetWorkspaceAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Get all workspaces.
    /// </summary>
    Task<IReadOnlyList<Workspace>> GetAllWorkspacesAsync(CancellationToken ct = default);

    /// <summary>
    /// Get workspaces by type.
    /// </summary>
    Task<IReadOnlyList<Workspace>> GetWorkspacesByTypeAsync(WorkspaceType type, CancellationToken ct = default);

    /// <summary>
    /// Update workspace settings.
    /// </summary>
    Task<Workspace> UpdateWorkspaceAsync(
        string id,
        string? name = null,
        string? description = null,
        WorkspaceSettings? settings = null,
        CancellationToken ct = default);

    /// <summary>
    /// Update workspace isolation configuration.
    /// </summary>
    Task<Workspace> UpdateIsolationAsync(
        string id,
        WorkspaceIsolation isolation,
        CancellationToken ct = default);

    /// <summary>
    /// Delete a workspace.
    /// </summary>
    Task DeleteWorkspaceAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Add a session to a workspace.
    /// </summary>
    Task<Workspace> AddSessionAsync(string workspaceId, string sessionId, CancellationToken ct = default);

    /// <summary>
    /// Remove a session from a workspace.
    /// </summary>
    Task<Workspace> RemoveSessionAsync(string workspaceId, string sessionId, CancellationToken ct = default);

    /// <summary>
    /// Add a project to a workspace.
    /// </summary>
    Task<Workspace> AddProjectAsync(string workspaceId, string projectId, CancellationToken ct = default);

    /// <summary>
    /// Remove a project from a workspace.
    /// </summary>
    Task<Workspace> RemoveProjectAsync(string workspaceId, string projectId, CancellationToken ct = default);

    /// <summary>
    /// Pause a workspace.
    /// </summary>
    Task<Workspace> PauseWorkspaceAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Resume a workspace.
    /// </summary>
    Task<Workspace> ResumeWorkspaceAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Archive a workspace.
    /// </summary>
    Task<Workspace> ArchiveWorkspaceAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Get workspace topology (relationships between workspaces).
    /// </summary>
    Task<WorkspaceTopology> GetTopologyAsync(CancellationToken ct = default);
}

/// <summary>
/// Workspace topology showing relationships and promotion paths.
/// </summary>
public class WorkspaceTopology
{
    public List<WorkspaceNode> Nodes { get; set; } = new();
    public List<WorkspaceEdge> Edges { get; set; } = new();
}

public class WorkspaceNode
{
    public string WorkspaceId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public WorkspaceType Type { get; set; }
    public int SessionCount { get; set; }
    public int ProjectCount { get; set; }
    public bool IsIsolated { get; set; }
}

public class WorkspaceEdge
{
    public string SourceWorkspaceId { get; set; } = string.Empty;
    public string TargetWorkspaceId { get; set; } = string.Empty;
    public string EdgeType { get; set; } = string.Empty; // "promotion", "read", "write"
}
