using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Cli.CommandHandlers;

/// <summary>
/// Handles the 'session' command for session management.
/// Usage: session <subcommand> [options]
/// Subcommands: create, list, attach, end, info
/// </summary>
public class SessionCommandHandler : ICommandHandler
{
    private readonly IExecutionSessionService _sessionService;
    private readonly ILogger<SessionCommandHandler> _logger;

    public string Verb => "session";

    public SessionCommandHandler(
        IExecutionSessionService sessionService,
        ILogger<SessionCommandHandler> logger)
    {
        _sessionService = sessionService;
        _logger = logger;
    }

    public async Task<CliResult> HandleAsync(
        ParsedCommand command,
        CliExecutionContext context,
        ContextPermissions permissions,
        CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(command.Target))
        {
            return CliResult.Failure("Usage: session <create|list|attach|end|info> [options]");
        }

        var subcommand = command.Target.ToLowerInvariant();

        // Check permission for session operations
        if (subcommand == "create" && !permissions.CanCreateSessions)
        {
            return CliResult.PermissionDenied("Session creation not allowed in this context");
        }

        return subcommand switch
        {
            "create" => await HandleCreate(command, context, ct),
            "list" => await HandleList(command, context, ct),
            "attach" => await HandleAttach(command, context, ct),
            "end" => await HandleEnd(command, context, ct),
            "info" => await HandleInfo(command, context, ct),
            _ => CliResult.Failure($"Unknown session subcommand: {subcommand}")
        };
    }

    private async Task<CliResult> HandleCreate(
        ParsedCommand command,
        CliExecutionContext context,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(context.WorkspaceId))
        {
            return CliResult.Failure("Session creation requires a workspace context");
        }

        var type = command.GetArgument("type") ?? "default";
        var name = command.GetArgument("name") ?? $"{type}-{DateTime.UtcNow:yyyyMMdd-HHmmss}";

        var request = new CreateExecutionSessionRequest
        {
            Name = name,
            Type = type,
            ParentWorkspaceId = context.WorkspaceId,
            ParentSessionId = context.SessionId,
            CreatedByAgentId = context.AgentId
        };

        var session = await _sessionService.CreateAsync(request, ct);

        _logger.LogInformation(
            "Created session {SessionId} of type {Type} in workspace {WorkspaceId}",
            session.Id, type, context.WorkspaceId);

        return CliResult.Ok(new
        {
            id = session.Id,
            name = session.Name,
            type = session.Type,
            workspaceId = session.ParentWorkspaceId,
            status = session.Status.ToString(),
            createdAt = session.CreatedAt
        });
    }

    private async Task<CliResult> HandleList(
        ParsedCommand command,
        CliExecutionContext context,
        CancellationToken ct)
    {
        IReadOnlyList<ExecutionSession> sessions;

        if (!string.IsNullOrEmpty(context.SessionId))
        {
            // List child sessions
            sessions = await _sessionService.ListByParentSessionAsync(context.SessionId, ct);
        }
        else if (!string.IsNullOrEmpty(context.WorkspaceId))
        {
            // List workspace sessions
            sessions = await _sessionService.ListByWorkspaceAsync(context.WorkspaceId, null, ct);
        }
        else
        {
            return CliResult.Failure("Session list requires a workspace or session context");
        }

        return CliResult.Ok(new
        {
            sessions = sessions.Select(s => new
            {
                id = s.Id,
                name = s.Name,
                type = s.Type,
                status = s.Status.ToString(),
                agentId = s.CurrentAgentId,
                createdAt = s.CreatedAt
            }),
            count = sessions.Count
        });
    }

    private async Task<CliResult> HandleAttach(
        ParsedCommand command,
        CliExecutionContext context,
        CancellationToken ct)
    {
        var sessionId = command.GetArgument("id") ?? command.PositionalArgs.FirstOrDefault();
        if (string.IsNullOrEmpty(sessionId))
        {
            return CliResult.Failure("Usage: session attach --id <session-id>");
        }

        var agentId = context.AgentId ?? "unknown";
        var session = await _sessionService.AttachAgentAsync(sessionId, agentId, ct);

        return CliResult.Ok(new
        {
            id = session.Id,
            status = session.Status.ToString(),
            agentId = session.CurrentAgentId,
            message = $"Agent '{agentId}' attached to session"
        });
    }

    private async Task<CliResult> HandleEnd(
        ParsedCommand command,
        CliExecutionContext context,
        CancellationToken ct)
    {
        var sessionId = command.GetArgument("id") ?? context.SessionId;
        if (string.IsNullOrEmpty(sessionId))
        {
            return CliResult.Failure("Usage: session end [--id <session-id>]");
        }

        var reason = command.GetArgument("reason") ?? "Ended by CLI command";
        var session = await _sessionService.EndAsync(sessionId, reason, ct);

        return CliResult.Ok(new
        {
            id = session.Id,
            status = session.Status.ToString(),
            endedAt = session.EndedAt,
            message = "Session ended"
        });
    }

    private async Task<CliResult> HandleInfo(
        ParsedCommand command,
        CliExecutionContext context,
        CancellationToken ct)
    {
        var sessionId = command.GetArgument("id") ?? context.SessionId;
        if (string.IsNullOrEmpty(sessionId))
        {
            return CliResult.Failure("Usage: session info [--id <session-id>]");
        }

        var session = await _sessionService.GetAsync(sessionId, ct);
        if (session == null)
        {
            return CliResult.Failure($"Session not found: {sessionId}");
        }

        var permissions = await _sessionService.GetEffectivePermissionsAsync(sessionId, ct);

        return CliResult.Ok(new
        {
            id = session.Id,
            name = session.Name,
            type = session.Type,
            status = session.Status.ToString(),
            workspaceId = session.ParentWorkspaceId,
            parentSessionId = session.ParentSessionId,
            agentId = session.CurrentAgentId,
            commandCount = session.CommandCount,
            createdAt = session.CreatedAt,
            startedAt = session.StartedAt,
            permissions = new
            {
                allowedCommands = permissions.AllowedCommands,
                allowedTools = permissions.AllowedTools,
                allowedBlocks = permissions.AllowedBlocks,
                canCreateBlocks = permissions.CanCreateBlocks,
                canCreateSessions = permissions.CanCreateSessions,
                dataCollections = permissions.DataCollections
            }
        });
    }
}
