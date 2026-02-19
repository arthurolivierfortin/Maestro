using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository interface for ProjectSession persistence operations.
/// </summary>
public interface IProjectSessionRepository
{
    /// <summary>
    /// Gets a session by its unique identifier.
    /// </summary>
    Task<ProjectSession?> GetByIdAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Gets all sessions for a specific project.
    /// </summary>
    Task<IEnumerable<ProjectSession>> GetByProjectIdAsync(string projectId, CancellationToken ct = default);

    /// <summary>
    /// Gets all sessions with optional filtering.
    /// </summary>
    Task<IEnumerable<ProjectSession>> GetAllAsync(
        SessionStatus? status = null,
        string? projectId = null,
        string? workflowId = null,
        int? limit = null,
        CancellationToken ct = default);

    /// <summary>
    /// Saves a session (create or update).
    /// </summary>
    Task SaveAsync(ProjectSession session, CancellationToken ct = default);

    /// <summary>
    /// Deletes a session by ID.
    /// </summary>
    Task DeleteAsync(SessionId id, CancellationToken ct = default);
}
