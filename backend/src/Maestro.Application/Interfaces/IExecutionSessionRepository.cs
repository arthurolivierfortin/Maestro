using Maestro.Domain.Entities;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository for execution sessions.
/// </summary>
public interface IExecutionSessionRepository
{
    /// <summary>
    /// Creates a new session.
    /// </summary>
    Task<ExecutionSession> CreateAsync(ExecutionSession session, CancellationToken ct = default);

    /// <summary>
    /// Gets a session by ID.
    /// </summary>
    Task<ExecutionSession?> GetByIdAsync(string sessionId, CancellationToken ct = default);

    /// <summary>
    /// Updates a session.
    /// </summary>
    Task<ExecutionSession> UpdateAsync(ExecutionSession session, CancellationToken ct = default);

    /// <summary>
    /// Deletes a session.
    /// </summary>
    Task DeleteAsync(string sessionId, CancellationToken ct = default);

    /// <summary>
    /// Lists sessions by workspace.
    /// </summary>
    Task<IReadOnlyList<ExecutionSession>> ListByWorkspaceAsync(
        string workspaceId,
        ExecutionSessionStatus? status = null,
        CancellationToken ct = default);

    /// <summary>
    /// Lists sessions by parent session.
    /// </summary>
    Task<IReadOnlyList<ExecutionSession>> ListByParentSessionAsync(
        string parentSessionId,
        CancellationToken ct = default);

    /// <summary>
    /// Lists all active sessions (for expiration checking).
    /// </summary>
    Task<IReadOnlyList<ExecutionSession>> ListActiveAsync(CancellationToken ct = default);
}
