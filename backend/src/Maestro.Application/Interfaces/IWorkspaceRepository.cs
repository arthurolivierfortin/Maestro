using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Domain.Entities;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository for workspace persistence.
/// </summary>
public interface IWorkspaceRepository
{
    /// <summary>
    /// Get a workspace by ID.
    /// </summary>
    Task<Workspace?> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Get all workspaces.
    /// </summary>
    Task<IReadOnlyList<Workspace>> GetAllAsync(CancellationToken ct = default);

    /// <summary>
    /// Get workspaces by type.
    /// </summary>
    Task<IReadOnlyList<Workspace>> GetByTypeAsync(WorkspaceType type, CancellationToken ct = default);

    /// <summary>
    /// Get workspaces containing a specific session.
    /// </summary>
    Task<IReadOnlyList<Workspace>> GetBySessionIdAsync(string sessionId, CancellationToken ct = default);

    /// <summary>
    /// Get workspaces containing a specific project.
    /// </summary>
    Task<IReadOnlyList<Workspace>> GetByProjectIdAsync(string projectId, CancellationToken ct = default);

    /// <summary>
    /// Save a workspace.
    /// </summary>
    Task SaveAsync(Workspace workspace, CancellationToken ct = default);

    /// <summary>
    /// Delete a workspace.
    /// </summary>
    Task DeleteAsync(string id, CancellationToken ct = default);
}
