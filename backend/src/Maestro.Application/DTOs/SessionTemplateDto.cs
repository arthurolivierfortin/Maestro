using Maestro.Domain.Entities;
using Maestro.Domain.Enums;

namespace Maestro.Application.DTOs;

/// <summary>
/// Data Transfer Object for SessionTemplate.
/// </summary>
public record SessionTemplateDto
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string Source { get; init; } = "user-defined";
    public string Mode { get; init; } = "sandbox";
    public string SandboxImageId { get; init; } = string.Empty;
    public string? CategoryId { get; init; }
    public List<string> Tags { get; init; } = new();
    public ResourceLimitsConfigDto? ResourceLimits { get; init; }
    public AccessConfigOverrideDto? AccessConfig { get; init; }
    public Dictionary<string, string> DefaultEnvironment { get; init; } = new();
    public string WorkingDirectory { get; init; } = "/workspace";
    public string? Icon { get; init; }
    public int SortOrder { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }

    public static SessionTemplateDto FromDomain(SessionTemplate template)
    {
        return new SessionTemplateDto
        {
            Id = template.Id,
            Name = template.Name,
            Description = template.Description,
            Source = template.Source.ToString().ToLowerInvariant().Replace("userdefined", "user-defined").Replace("builtin", "built-in"),
            Mode = template.Mode.ToString().ToLowerInvariant(),
            SandboxImageId = template.SandboxImageId,
            CategoryId = template.CategoryId,
            Tags = template.Tags.ToList(),
            ResourceLimits = template.ResourceLimits != null
                ? ResourceLimitsConfigDto.FromDomain(template.ResourceLimits)
                : null,
            AccessConfig = template.AccessConfig != null
                ? AccessConfigOverrideDto.FromDomain(template.AccessConfig)
                : null,
            DefaultEnvironment = new Dictionary<string, string>(template.DefaultEnvironment),
            WorkingDirectory = template.WorkingDirectory,
            Icon = template.Icon,
            SortOrder = template.SortOrder,
            CreatedAt = template.CreatedAt,
            UpdatedAt = template.UpdatedAt
        };
    }
}

/// <summary>
/// DTO for resource limits configuration.
/// </summary>
public record ResourceLimitsConfigDto
{
    public string? CpuLimit { get; init; }
    public string? MemoryLimit { get; init; }
    public int? TimeoutSeconds { get; init; }

    public static ResourceLimitsConfigDto FromDomain(ResourceLimitsConfig config)
    {
        return new ResourceLimitsConfigDto
        {
            CpuLimit = config.CpuLimit,
            MemoryLimit = config.MemoryLimit,
            TimeoutSeconds = config.TimeoutSeconds
        };
    }

    public ResourceLimitsConfig ToDomain()
    {
        return new ResourceLimitsConfig
        {
            CpuLimit = CpuLimit,
            MemoryLimit = MemoryLimit,
            TimeoutSeconds = TimeoutSeconds
        };
    }
}

/// <summary>
/// DTO for access configuration override.
/// </summary>
public record AccessConfigOverrideDto
{
    public string? Level { get; init; }
    public List<string>? DeniedPaths { get; init; }
    public List<string>? DeniedCommands { get; init; }

    public static AccessConfigOverrideDto FromDomain(AccessConfigOverride config)
    {
        return new AccessConfigOverrideDto
        {
            Level = config.Level?.ToString().ToLowerInvariant(),
            DeniedPaths = config.DeniedPaths?.ToList(),
            DeniedCommands = config.DeniedCommands?.ToList()
        };
    }

    public AccessConfigOverride ToDomain()
    {
        return new AccessConfigOverride
        {
            Level = Level != null ? Enum.Parse<AccessLevel>(Level, ignoreCase: true) : null,
            DeniedPaths = DeniedPaths,
            DeniedCommands = DeniedCommands
        };
    }
}

/// <summary>
/// Request to create a new session template.
/// </summary>
public record CreateSessionTemplateRequest
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public string? Description { get; init; }
    public string Mode { get; init; } = "sandbox";
    public required string SandboxImageId { get; init; }
    public string? CategoryId { get; init; }
    public List<string>? Tags { get; init; }
    public ResourceLimitsConfigDto? ResourceLimits { get; init; }
    public AccessConfigOverrideDto? AccessConfig { get; init; }
    public Dictionary<string, string>? DefaultEnvironment { get; init; }
    public string? WorkingDirectory { get; init; }
    public string? Icon { get; init; }
    public int SortOrder { get; init; } = 100;

    public SessionTemplate ToDomain()
    {
        var template = SessionTemplate.Create(
            Id,
            Name,
            SandboxImageId,
            Enum.Parse<EnvironmentMode>(Mode, ignoreCase: true),
            CategoryId
        );

        if (Description != null) template.Description = Description;
        if (Tags != null) template.Tags = Tags;
        if (ResourceLimits != null) template.ResourceLimits = ResourceLimits.ToDomain();
        if (AccessConfig != null) template.AccessConfig = AccessConfig.ToDomain();
        if (DefaultEnvironment != null) template.DefaultEnvironment = DefaultEnvironment;
        if (WorkingDirectory != null) template.WorkingDirectory = WorkingDirectory;
        if (Icon != null) template.Icon = Icon;
        template.SortOrder = SortOrder;

        return template;
    }
}

/// <summary>
/// Request to update a session template.
/// </summary>
public record UpdateSessionTemplateRequest
{
    public string? Name { get; init; }
    public string? Description { get; init; }
    public string? Mode { get; init; }
    public string? SandboxImageId { get; init; }
    public string? CategoryId { get; init; }
    public List<string>? Tags { get; init; }
    public ResourceLimitsConfigDto? ResourceLimits { get; init; }
    public AccessConfigOverrideDto? AccessConfig { get; init; }
    public Dictionary<string, string>? DefaultEnvironment { get; init; }
    public string? WorkingDirectory { get; init; }
    public string? Icon { get; init; }
    public int? SortOrder { get; init; }
}
