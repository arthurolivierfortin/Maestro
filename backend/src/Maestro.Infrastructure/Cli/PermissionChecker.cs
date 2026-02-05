using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Cli;

/// <summary>
/// Resolves permissions for a given execution context.
/// Uses session permissions if in a session, otherwise workspace permissions.
/// </summary>
public class PermissionChecker : IPermissionChecker
{
    private readonly IProjectSessionServer _sessionServer;
    private readonly IWorkspaceService _workspaceService;
    private readonly ILogger<PermissionChecker> _logger;

    public PermissionChecker(
        IProjectSessionServer sessionServer,
        IWorkspaceService workspaceService,
        ILogger<PermissionChecker> logger)
    {
        _sessionServer = sessionServer;
        _workspaceService = workspaceService;
        _logger = logger;
    }

    public async Task<ContextPermissions> GetPermissionsAsync(
        CliExecutionContext context,
        CancellationToken ct = default)
    {
        // If in a session, get session's effective permissions
        if (!string.IsNullOrEmpty(context.SessionId))
        {
            try
            {
                var sessionId = SessionId.From(context.SessionId);
                var session = await _sessionServer.GetAsync(sessionId);
                if (session != null)
                {
                    var permissions = session.GetEffectivePermissions();
                    _logger.LogDebug(
                        "Resolved permissions from session {SessionId}",
                        context.SessionId);
                    return permissions;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Session {SessionId} not found or invalid, falling back to workspace permissions",
                    context.SessionId);
                // Fall through to workspace check
            }
        }

        // If in a workspace, get workspace permissions
        if (!string.IsNullOrEmpty(context.WorkspaceId))
        {
            var workspace = await _workspaceService.GetWorkspaceAsync(context.WorkspaceId, ct);
            if (workspace != null)
            {
                _logger.LogDebug(
                    "Resolved permissions from workspace {WorkspaceId}",
                    context.WorkspaceId);
                return workspace.GetEffectivePermissions();
            }

            _logger.LogWarning(
                "Workspace {WorkspaceId} not found, returning no permissions",
                context.WorkspaceId);
        }

        // No context = no permissions
        _logger.LogDebug("No context provided, returning empty permissions");
        return ContextPermissions.None;
    }
}
