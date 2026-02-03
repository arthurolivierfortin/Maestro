using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository interface for unified Session persistence operations.
/// </summary>
public interface ISessionRepository
{
    /// <summary>
    /// Gets a session by its unique identifier.
    /// </summary>
    Task<Session?> GetByIdAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Gets all sessions with optional filtering.
    /// </summary>
    Task<IEnumerable<Session>> GetAllAsync(
        SessionStatus? status = null,
        EnvironmentMode? mode = null,
        string? categoryId = null,
        string? templateId = null,
        int? limit = null,
        CancellationToken ct = default);

    /// <summary>
    /// Gets all active (running or paused) sessions.
    /// </summary>
    Task<IEnumerable<Session>> GetActiveAsync(CancellationToken ct = default);

    /// <summary>
    /// Gets sessions by category.
    /// </summary>
    Task<IEnumerable<Session>> GetByCategoryAsync(
        string categoryId,
        SessionStatus? status = null,
        int? limit = null,
        CancellationToken ct = default);

    /// <summary>
    /// Saves a session (create or update).
    /// </summary>
    Task SaveAsync(Session session, CancellationToken ct = default);

    /// <summary>
    /// Deletes a session by ID.
    /// </summary>
    Task DeleteAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Checks if a session ID exists.
    /// </summary>
    Task<bool> ExistsAsync(SessionId id, CancellationToken ct = default);
}
