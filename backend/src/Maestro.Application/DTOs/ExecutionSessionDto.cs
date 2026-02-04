using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.DTOs;

/// <summary>
/// DTO for execution session.
/// </summary>
public class ExecutionSessionDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string ParentWorkspaceId { get; set; } = string.Empty;
    public string? ParentSessionId { get; set; }
    public string? CreatedByAgentId { get; set; }
    public ContextPermissionsDto Permissions { get; set; } = new();
    public string Status { get; set; } = string.Empty;
    public string? CurrentAgentId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? EndedAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public bool LogAllCommands { get; set; }
    public int CommandCount { get; set; }
    public int MaxIterations { get; set; }
    public double? DurationSeconds { get; set; }

    public static ExecutionSessionDto FromDomain(ExecutionSession session)
    {
        return new ExecutionSessionDto
        {
            Id = session.Id,
            Name = session.Name,
            Type = session.Type,
            ParentWorkspaceId = session.ParentWorkspaceId,
            ParentSessionId = session.ParentSessionId,
            CreatedByAgentId = session.CreatedByAgentId,
            Permissions = ContextPermissionsDto.FromDomain(session.Permissions),
            Status = session.Status.ToString(),
            CurrentAgentId = session.CurrentAgentId,
            CreatedAt = session.CreatedAt,
            StartedAt = session.StartedAt,
            EndedAt = session.EndedAt,
            ExpiresAt = session.ExpiresAt,
            LogAllCommands = session.LogAllCommands,
            CommandCount = session.CommandCount,
            MaxIterations = session.MaxIterations,
            DurationSeconds = session.Duration?.TotalSeconds
        };
    }
}

/// <summary>
/// Request to create an execution session (API).
/// </summary>
public class CreateExecutionSessionRequestDto
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string ParentWorkspaceId { get; set; } = string.Empty;
    public string? ParentSessionId { get; set; }
    public string? CreatedByAgentId { get; set; }
    public ContextPermissionsDto? Permissions { get; set; }
    public bool LogAllCommands { get; set; } = true;
    public int MaxIterations { get; set; }
    public int? MaxDurationMinutes { get; set; }
}

/// <summary>
/// Request to create a session from template (API).
/// </summary>
public class CreateSessionFromTemplateRequestDto
{
    public string WorkspaceId { get; set; } = string.Empty;
    public string TemplateType { get; set; } = string.Empty;
    public string? CreatedByAgentId { get; set; }
}

/// <summary>
/// Request to attach an agent to a session.
/// </summary>
public class AttachAgentRequestDto
{
    public string AgentId { get; set; } = string.Empty;
}

/// <summary>
/// Request to end a session.
/// </summary>
public class EndSessionRequestDto
{
    public string? Reason { get; set; }
}
