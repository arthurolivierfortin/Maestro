using Maestro.Domain.ValueObjects;

namespace Maestro.Application.DTOs;

/// <summary>
/// DTO for context permissions.
/// Represents what can be done within a workspace or session context.
/// </summary>
public class ContextPermissionsDto
{
    public List<string> AllowedCommands { get; set; } = new();
    public List<string> AllowedTools { get; set; } = new();
    public List<string> AllowedBlocks { get; set; } = new();
    public bool CanCreateBlocks { get; set; }
    public bool CanCreateSessions { get; set; }
    public List<string> DataCollections { get; set; } = new();
    public List<string> AllowedPaths { get; set; } = new();

    public static ContextPermissionsDto FromDomain(ContextPermissions permissions)
    {
        return new ContextPermissionsDto
        {
            AllowedCommands = permissions.AllowedCommands.ToList(),
            AllowedTools = permissions.AllowedTools.ToList(),
            AllowedBlocks = permissions.AllowedBlocks.ToList(),
            CanCreateBlocks = permissions.CanCreateBlocks,
            CanCreateSessions = permissions.CanCreateSessions,
            DataCollections = permissions.DataCollections.ToList(),
            AllowedPaths = permissions.AllowedPaths.ToList()
        };
    }

    public ContextPermissions ToDomain()
    {
        return new ContextPermissions
        {
            AllowedCommands = AllowedCommands ?? new(),
            AllowedTools = AllowedTools ?? new(),
            AllowedBlocks = AllowedBlocks ?? new(),
            CanCreateBlocks = CanCreateBlocks,
            CanCreateSessions = CanCreateSessions,
            DataCollections = DataCollections ?? new(),
            AllowedPaths = AllowedPaths ?? new()
        };
    }

    /// <summary>
    /// Create a DTO for full access permissions.
    /// </summary>
    public static ContextPermissionsDto Full => FromDomain(ContextPermissions.Full);

    /// <summary>
    /// Create a DTO for no permissions.
    /// </summary>
    public static ContextPermissionsDto None => FromDomain(ContextPermissions.None);
}

/// <summary>
/// DTO for session template.
/// </summary>
public class SessionTemplateDto
{
    public string Type { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ContextPermissionsDto Permissions { get; set; } = new();
    public bool LogAllCommands { get; set; }
    public int MaxDurationMinutes { get; set; }
    public int MaxIterations { get; set; }
    public bool AllowNestedSessions { get; set; }
    public string? DefaultModelId { get; set; }

    public static SessionTemplateDto FromDomain(SessionTemplate template)
    {
        return new SessionTemplateDto
        {
            Type = template.Type,
            Description = template.Description,
            Permissions = ContextPermissionsDto.FromDomain(template.Permissions),
            LogAllCommands = template.LogAllCommands,
            MaxDurationMinutes = template.MaxDurationMinutes,
            MaxIterations = template.MaxIterations,
            AllowNestedSessions = template.AllowNestedSessions,
            DefaultModelId = template.DefaultModelId
        };
    }

    public SessionTemplate ToDomain()
    {
        return new SessionTemplate
        {
            Type = Type ?? string.Empty,
            Description = Description,
            Permissions = Permissions?.ToDomain() ?? ContextPermissions.None,
            LogAllCommands = LogAllCommands,
            MaxDurationMinutes = MaxDurationMinutes,
            MaxIterations = MaxIterations,
            AllowNestedSessions = AllowNestedSessions,
            DefaultModelId = DefaultModelId
        };
    }
}

/// <summary>
/// Request to load a workspace from a filesystem path.
/// </summary>
public class LoadWorkspaceRequest
{
    public string Path { get; set; } = string.Empty;
}

/// <summary>
/// Result of workspace validation.
/// </summary>
public class WorkspaceValidationResult
{
    public bool IsValid { get; set; }
    public List<string> Errors { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
    public Dictionary<string, object>? Details { get; set; }
}
