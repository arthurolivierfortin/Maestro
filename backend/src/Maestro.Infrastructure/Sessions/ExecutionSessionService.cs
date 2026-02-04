using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Sessions;

/// <summary>
/// Service for managing execution sessions.
/// </summary>
public class ExecutionSessionService : IExecutionSessionService
{
    private readonly IExecutionSessionRepository _repository;
    private readonly IWorkspaceService _workspaceService;
    private readonly ILogger<ExecutionSessionService> _logger;

    public ExecutionSessionService(
        IExecutionSessionRepository repository,
        IWorkspaceService workspaceService,
        ILogger<ExecutionSessionService> logger)
    {
        _repository = repository;
        _workspaceService = workspaceService;
        _logger = logger;
    }

    public async Task<ExecutionSession> CreateAsync(
        CreateExecutionSessionRequest request,
        CancellationToken ct = default)
    {
        // Validate workspace exists
        var workspace = await _workspaceService.GetWorkspaceAsync(request.ParentWorkspaceId, ct);
        if (workspace == null)
        {
            throw new ArgumentException($"Workspace not found: {request.ParentWorkspaceId}");
        }

        // Get parent permissions
        ContextPermissions parentPermissions;
        if (!string.IsNullOrEmpty(request.ParentSessionId))
        {
            // Nested session - inherit from parent session
            parentPermissions = await GetEffectivePermissionsAsync(request.ParentSessionId, ct);
        }
        else
        {
            // Top-level session - inherit from workspace
            parentPermissions = workspace.Permissions;
        }

        // Compute effective permissions (intersection with parent)
        var sessionPermissions = request.Permissions ?? parentPermissions;
        var effectivePermissions = parentPermissions.Intersect(sessionPermissions);

        // Create session
        var session = ExecutionSession.Create(
            name: request.Name,
            type: request.Type,
            parentWorkspaceId: request.ParentWorkspaceId,
            permissions: effectivePermissions,
            parentSessionId: request.ParentSessionId,
            createdByAgentId: request.CreatedByAgentId,
            logAllCommands: request.LogAllCommands,
            maxIterations: request.MaxIterations,
            maxDuration: request.MaxDuration
        );

        await _repository.CreateAsync(session, ct);

        _logger.LogInformation(
            "Created execution session {SessionId} of type {Type} in workspace {WorkspaceId}",
            session.Id, session.Type, session.ParentWorkspaceId);

        return session;
    }

    public async Task<ExecutionSession> CreateFromTemplateAsync(
        string workspaceId,
        string templateType,
        string? createdByAgentId = null,
        CancellationToken ct = default)
    {
        var workspace = await _workspaceService.GetWorkspaceAsync(workspaceId, ct);
        if (workspace == null)
        {
            throw new ArgumentException($"Workspace not found: {workspaceId}");
        }

        var template = workspace.GetSessionTemplate(templateType);
        if (template == null)
        {
            throw new ArgumentException($"Session template not found: {templateType}");
        }

        // Compute permissions (intersection with workspace)
        var effectivePermissions = workspace.Permissions.Intersect(template.Permissions);

        var session = ExecutionSession.Create(
            name: $"{template.Type}-{DateTime.UtcNow:yyyyMMdd-HHmmss}",
            type: template.Type,
            parentWorkspaceId: workspaceId,
            permissions: effectivePermissions,
            createdByAgentId: createdByAgentId,
            logAllCommands: template.LogAllCommands,
            maxIterations: template.MaxIterations,
            maxDuration: template.MaxDurationMinutes > 0
                ? TimeSpan.FromMinutes(template.MaxDurationMinutes)
                : null
        );

        await _repository.CreateAsync(session, ct);

        _logger.LogInformation(
            "Created session {SessionId} from template {Template} in workspace {WorkspaceId}",
            session.Id, templateType, workspaceId);

        return session;
    }

    public async Task<ExecutionSession?> GetAsync(string sessionId, CancellationToken ct = default)
    {
        var session = await _repository.GetByIdAsync(sessionId, ct);

        // Check expiration
        if (session != null && session.IsExpired())
        {
            await _repository.UpdateAsync(session, ct);
        }

        return session;
    }

    public async Task<IReadOnlyList<ExecutionSession>> ListByWorkspaceAsync(
        string workspaceId,
        ExecutionSessionStatus? status = null,
        CancellationToken ct = default)
    {
        return await _repository.ListByWorkspaceAsync(workspaceId, status, ct);
    }

    public async Task<IReadOnlyList<ExecutionSession>> ListByParentSessionAsync(
        string parentSessionId,
        CancellationToken ct = default)
    {
        return await _repository.ListByParentSessionAsync(parentSessionId, ct);
    }

    public async Task<ExecutionSession> AttachAgentAsync(
        string sessionId,
        string agentId,
        CancellationToken ct = default)
    {
        var session = await GetSessionOrThrow(sessionId, ct);

        session.AttachAgent(agentId);
        await _repository.UpdateAsync(session, ct);

        _logger.LogInformation(
            "Attached agent {AgentId} to session {SessionId}",
            agentId, sessionId);

        return session;
    }

    public async Task<ExecutionSession> DetachAgentAsync(
        string sessionId,
        CancellationToken ct = default)
    {
        var session = await GetSessionOrThrow(sessionId, ct);

        var previousAgent = session.CurrentAgentId;
        session.DetachAgent();
        await _repository.UpdateAsync(session, ct);

        _logger.LogInformation(
            "Detached agent {AgentId} from session {SessionId}",
            previousAgent, sessionId);

        return session;
    }

    public async Task<ExecutionSession> RecordCommandAsync(
        string sessionId,
        CancellationToken ct = default)
    {
        var session = await GetSessionOrThrow(sessionId, ct);

        session.IncrementCommandCount();
        await _repository.UpdateAsync(session, ct);

        return session;
    }

    public async Task<ExecutionSession> PauseAsync(string sessionId, CancellationToken ct = default)
    {
        var session = await GetSessionOrThrow(sessionId, ct);

        session.Pause();
        await _repository.UpdateAsync(session, ct);

        _logger.LogInformation("Paused session {SessionId}", sessionId);

        return session;
    }

    public async Task<ExecutionSession> ResumeAsync(string sessionId, CancellationToken ct = default)
    {
        var session = await GetSessionOrThrow(sessionId, ct);

        session.Resume();
        await _repository.UpdateAsync(session, ct);

        _logger.LogInformation("Resumed session {SessionId}", sessionId);

        return session;
    }

    public async Task<ExecutionSession> EndAsync(
        string sessionId,
        string? reason = null,
        CancellationToken ct = default)
    {
        var session = await GetSessionOrThrow(sessionId, ct);

        // End any nested sessions first
        var nestedSessions = await _repository.ListByParentSessionAsync(sessionId, ct);
        foreach (var nested in nestedSessions)
        {
            if (nested.Status == ExecutionSessionStatus.Active ||
                nested.Status == ExecutionSessionStatus.Paused)
            {
                nested.End("Parent session ended");
                await _repository.UpdateAsync(nested, ct);
            }
        }

        session.End(reason);
        await _repository.UpdateAsync(session, ct);

        _logger.LogInformation(
            "Ended session {SessionId} with reason: {Reason}",
            sessionId, reason ?? "none");

        return session;
    }

    public async Task<ContextPermissions> GetEffectivePermissionsAsync(
        string sessionId,
        CancellationToken ct = default)
    {
        var session = await GetSessionOrThrow(sessionId, ct);

        // Start with session's own permissions
        var permissions = session.Permissions;

        // If this is a nested session, get parent's effective permissions
        if (!string.IsNullOrEmpty(session.ParentSessionId))
        {
            var parentPermissions = await GetEffectivePermissionsAsync(session.ParentSessionId, ct);
            permissions = parentPermissions.Intersect(permissions);
        }
        else
        {
            // Top-level session - intersect with workspace
            var workspace = await _workspaceService.GetWorkspaceAsync(session.ParentWorkspaceId, ct);
            if (workspace != null)
            {
                permissions = workspace.Permissions.Intersect(permissions);
            }
        }

        return permissions;
    }

    public async Task DeleteAsync(string sessionId, CancellationToken ct = default)
    {
        var session = await GetSessionOrThrow(sessionId, ct);

        if (session.Status == ExecutionSessionStatus.Active ||
            session.Status == ExecutionSessionStatus.Paused)
        {
            throw new InvalidOperationException("Cannot delete active session. End it first.");
        }

        // Delete nested sessions first
        var nestedSessions = await _repository.ListByParentSessionAsync(sessionId, ct);
        foreach (var nested in nestedSessions)
        {
            await _repository.DeleteAsync(nested.Id, ct);
        }

        await _repository.DeleteAsync(sessionId, ct);

        _logger.LogInformation("Deleted session {SessionId}", sessionId);
    }

    private async Task<ExecutionSession> GetSessionOrThrow(string sessionId, CancellationToken ct)
    {
        var session = await _repository.GetByIdAsync(sessionId, ct);
        if (session == null)
        {
            throw new KeyNotFoundException($"Session not found: {sessionId}");
        }

        // Check expiration
        if (session.IsExpired())
        {
            await _repository.UpdateAsync(session, ct);
        }

        return session;
    }
}
