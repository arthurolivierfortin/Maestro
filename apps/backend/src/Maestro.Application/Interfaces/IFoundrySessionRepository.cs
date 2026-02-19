using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository interface for FoundrySession persistence operations.
/// </summary>
public interface IFoundrySessionRepository
{
    /// <summary>
    /// Gets a session by its unique identifier.
    /// </summary>
    Task<FoundrySession?> GetByIdAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Gets all sessions for a specific draft.
    /// </summary>
    Task<IEnumerable<FoundrySession>> GetByDraftIdAsync(string draftId, CancellationToken ct = default);

    /// <summary>
    /// Gets all sessions with optional filtering.
    /// </summary>
    Task<IEnumerable<FoundrySession>> GetAllAsync(
        SessionStatus? status = null,
        string? draftId = null,
        int? limit = null,
        CancellationToken ct = default);

    /// <summary>
    /// Saves a session (create or update).
    /// </summary>
    Task SaveAsync(FoundrySession session, CancellationToken ct = default);

    /// <summary>
    /// Deletes a session by ID.
    /// </summary>
    Task DeleteAsync(SessionId id, CancellationToken ct = default);
}
