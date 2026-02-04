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
    private readonly IExecutionSessionService _sessionService;
    private readonly IWorkspaceService _workspaceService;
    private readonly ILogger<PermissionChecker> _logger;

    public PermissionChecker(
        IExecutionSessionService sessionService,
        IWorkspaceService workspaceService,
        ILogger<PermissionChecker> logger)
    {
        _sessionService = sessionService;
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
                var permissions = await _sessionService.GetEffectivePermissionsAsync(context.SessionId, ct);
                _logger.LogDebug(
                    "Resolved permissions from session {SessionId}",
                    context.SessionId);
                return permissions;
            }
            catch (KeyNotFoundException)
            {
                _logger.LogWarning(
                    "Session {SessionId} not found, falling back to workspace permissions",
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
                return workspace.Permissions;
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
