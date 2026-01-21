using System.Text.Json;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.DTOs;

/// <summary>
/// Data Transfer Object for Project.
/// Used for API responses.
/// </summary>
public record ProjectDto
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string RootPath { get; init; } = string.Empty;
    public string Version { get; init; } = "1.0.0";
    public RuntimeConfigDto Runtime { get; init; } = new();
    public int BlocksCount { get; init; }
    public int WorkflowsCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }

    public static ProjectDto FromDomain(Project project, int blocksCount = 0, int workflowsCount = 0)
    {
        return new ProjectDto
        {
            Id = project.Id.ToString(),
            Name = project.Name,
            Description = project.Description,
            RootPath = project.RootPath,
            Version = project.Version,
            Runtime = RuntimeConfigDto.FromDomain(project.Runtime),
            BlocksCount = blocksCount,
            WorkflowsCount = workflowsCount,
            CreatedAt = project.CreatedAt,
            UpdatedAt = project.UpdatedAt
        };
    }
}

/// <summary>
/// Data Transfer Object for Runtime Configuration.
/// </summary>
public record RuntimeConfigDto
{
    public string Type { get; init; } = "none";
    public string? Image { get; init; }
    public string WorkDir { get; init; } = "/app";
    public Dictionary<string, string> Environment { get; init; } = new();
    public ResourceLimitsDto? Resources { get; init; }
    public string NetworkMode { get; init; } = "none";

    public static RuntimeConfigDto FromDomain(RuntimeConfiguration runtime)
    {
        return new RuntimeConfigDto
        {
            Type = runtime.Type,
            Image = runtime.Image,
            WorkDir = runtime.WorkDir,
            Environment = new Dictionary<string, string>(runtime.Environment),
            Resources = runtime.Resources != null ? ResourceLimitsDto.FromDomain(runtime.Resources) : null,
            NetworkMode = runtime.NetworkMode
        };
    }

    public RuntimeConfiguration ToDomain()
    {
        return new RuntimeConfiguration
        {
            Type = Type,
            Image = Image,
            WorkDir = WorkDir,
            Environment = Environment,
            Resources = Resources?.ToDomain(),
            NetworkMode = NetworkMode
        };
    }
}

/// <summary>
/// Data Transfer Object for Resource Limits.
/// </summary>
public record ResourceLimitsDto
{
    public string? CpuLimit { get; init; }
    public string? MemoryLimit { get; init; }
    public int? TimeoutSeconds { get; init; }

    public static ResourceLimitsDto FromDomain(ResourceLimits limits)
    {
        return new ResourceLimitsDto
        {
            CpuLimit = limits.CpuLimit,
            MemoryLimit = limits.MemoryLimit,
            TimeoutSeconds = limits.TimeoutSeconds
        };
    }

    public ResourceLimits ToDomain()
    {
        return new ResourceLimits
        {
            CpuLimit = CpuLimit,
            MemoryLimit = MemoryLimit,
            TimeoutSeconds = TimeoutSeconds
        };
    }
}
