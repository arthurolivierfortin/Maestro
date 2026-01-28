using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository interface for Project persistence operations.
/// </summary>
public interface IProjectRepository
{
    /// <summary>
    /// Gets a project by its unique identifier.
    /// </summary>
    Task<Project?> GetByIdAsync(ProjectId id, CancellationToken ct = default);

    /// <summary>
    /// Gets a project by its root path.
    /// </summary>
    Task<Project?> GetByPathAsync(string rootPath, CancellationToken ct = default);

    /// <summary>
    /// Gets all discovered projects.
    /// </summary>
    Task<IEnumerable<Project>> GetAllAsync(CancellationToken ct = default);

    /// <summary>
    /// Saves a project (create or update).
    /// </summary>
    Task SaveAsync(Project project, CancellationToken ct = default);

    /// <summary>
    /// Deletes a project by ID.
    /// </summary>
    Task DeleteAsync(ProjectId id, CancellationToken ct = default);

    /// <summary>
    /// Scans for projects in the specified search paths.
    /// </summary>
    Task<IEnumerable<Project>> DiscoverProjectsAsync(string[] searchPaths, CancellationToken ct = default);
}
