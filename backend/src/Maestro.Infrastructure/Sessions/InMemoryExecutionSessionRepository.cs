using System.Collections.Concurrent;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.Sessions;

/// <summary>
/// In-memory repository for execution sessions.
/// </summary>
public class InMemoryExecutionSessionRepository : IExecutionSessionRepository
{
    private readonly ConcurrentDictionary<string, ExecutionSession> _sessions = new();

    public Task<ExecutionSession> CreateAsync(ExecutionSession session, CancellationToken ct = default)
    {
        if (!_sessions.TryAdd(session.Id, session))
        {
            throw new InvalidOperationException($"Session already exists: {session.Id}");
        }
        return Task.FromResult(session);
    }

    public Task<ExecutionSession?> GetByIdAsync(string sessionId, CancellationToken ct = default)
    {
        _sessions.TryGetValue(sessionId, out var session);
        return Task.FromResult(session);
    }

    public Task<ExecutionSession> UpdateAsync(ExecutionSession session, CancellationToken ct = default)
    {
        _sessions[session.Id] = session;
        return Task.FromResult(session);
    }

    public Task DeleteAsync(string sessionId, CancellationToken ct = default)
    {
        _sessions.TryRemove(sessionId, out _);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<ExecutionSession>> ListByWorkspaceAsync(
        string workspaceId,
        ExecutionSessionStatus? status = null,
        CancellationToken ct = default)
    {
        var query = _sessions.Values
            .Where(s => s.ParentWorkspaceId == workspaceId);

        if (status.HasValue)
        {
            query = query.Where(s => s.Status == status.Value);
        }

        var result = query
            .OrderByDescending(s => s.CreatedAt)
            .ToList() as IReadOnlyList<ExecutionSession>;

        return Task.FromResult(result);
    }

    public Task<IReadOnlyList<ExecutionSession>> ListByParentSessionAsync(
        string parentSessionId,
        CancellationToken ct = default)
    {
        var result = _sessions.Values
            .Where(s => s.ParentSessionId == parentSessionId)
            .OrderByDescending(s => s.CreatedAt)
            .ToList() as IReadOnlyList<ExecutionSession>;

        return Task.FromResult(result);
    }

    public Task<IReadOnlyList<ExecutionSession>> ListActiveAsync(CancellationToken ct = default)
    {
        var result = _sessions.Values
            .Where(s => s.Status == ExecutionSessionStatus.Active ||
                        s.Status == ExecutionSessionStatus.Paused)
            .ToList() as IReadOnlyList<ExecutionSession>;

        return Task.FromResult(result);
    }
}
