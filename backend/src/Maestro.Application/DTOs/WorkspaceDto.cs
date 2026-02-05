using System;
using System.Collections.Generic;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.DTOs;

/// <summary>
/// DTO for workspace.
/// </summary>
public class WorkspaceDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Path { get; set; }
    public List<string> SessionIds { get; set; } = new();
    public List<string> ProjectIds { get; set; } = new();
    public string? CatalogRef { get; set; }
    public WorkspaceSettingsDto Settings { get; set; } = new();
    public WorkspaceIsolationDto Isolation { get; set; } = new();
    public ContextPermissionsDto Permissions { get; set; } = new();
    public Dictionary<string, SessionTemplateDto> SessionTemplates { get; set; } = new();
    public Dictionary<string, string> EntryPoints { get; set; } = new();
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public string? CreatedBy { get; set; }

    public static WorkspaceDto FromDomain(Workspace workspace)
    {
        return new WorkspaceDto
        {
            Id = workspace.Id,
            Name = workspace.Name,
            Description = workspace.Description,
            Type = workspace.Type.ToString(),
            Status = workspace.Status.ToString(),
            Path = workspace.Path,
            SessionIds = workspace.SessionIds,
            ProjectIds = workspace.ProjectIds,
            CatalogRef = workspace.CatalogRef,
            Settings = WorkspaceSettingsDto.FromDomain(workspace.Settings),
            Isolation = WorkspaceIsolationDto.FromDomain(workspace.Isolation),
            Permissions = ContextPermissionsDto.FromDomain(workspace.Permissions),
            SessionTemplates = workspace.SessionTemplates.ToDictionary(
                kvp => kvp.Key,
                kvp => SessionTemplateDto.FromDomain(kvp.Value)),
            EntryPoints = new Dictionary<string, string>(workspace.EntryPoints),
            CreatedAt = workspace.CreatedAt,
            UpdatedAt = workspace.UpdatedAt,
            CreatedBy = workspace.CreatedBy
        };
    }
}

/// <summary>
/// DTO for workspace settings.
/// </summary>
public class WorkspaceSettingsDto
{
    public string? DefaultModelId { get; set; }
    public int MaxConcurrentSessions { get; set; }
    public int MaxConcurrentTrainingRuns { get; set; }
    public bool AutoPromotionEnabled { get; set; }
    public double MinFitnessForPromotion { get; set; }
    public List<string> Tags { get; set; } = new();

    public static WorkspaceSettingsDto FromDomain(WorkspaceSettings settings)
    {
        return new WorkspaceSettingsDto
        {
            DefaultModelId = settings.DefaultModelId,
            MaxConcurrentSessions = settings.MaxConcurrentSessions,
            MaxConcurrentTrainingRuns = settings.MaxConcurrentTrainingRuns,
            AutoPromotionEnabled = settings.AutoPromotionEnabled,
            MinFitnessForPromotion = settings.MinFitnessForPromotion,
            Tags = settings.Tags
        };
    }

    public WorkspaceSettings ToDomain()
    {
        return new WorkspaceSettings
        {
            DefaultModelId = DefaultModelId,
            MaxConcurrentSessions = MaxConcurrentSessions,
            MaxConcurrentTrainingRuns = MaxConcurrentTrainingRuns,
            AutoPromotionEnabled = AutoPromotionEnabled,
            MinFitnessForPromotion = MinFitnessForPromotion,
            Tags = Tags
        };
    }
}

/// <summary>
/// DTO for workspace isolation.
/// </summary>
public class WorkspaceIsolationDto
{
    public bool Enabled { get; set; }
    public NetworkConfigDto? Network { get; set; }
    public WorkspaceResourceLimitsDto? Resources { get; set; }
    public WorkspacePermissionsDto Permissions { get; set; } = new();

    public static WorkspaceIsolationDto FromDomain(WorkspaceIsolation isolation)
    {
        return new WorkspaceIsolationDto
        {
            Enabled = isolation.Enabled,
            Network = isolation.Network != null ? NetworkConfigDto.FromDomain(isolation.Network) : null,
            Resources = isolation.Resources != null ? WorkspaceResourceLimitsDto.FromDomain(isolation.Resources) : null,
            Permissions = WorkspacePermissionsDto.FromDomain(isolation.Permissions)
        };
    }

    public WorkspaceIsolation ToDomain()
    {
        return new WorkspaceIsolation
        {
            Enabled = Enabled,
            Network = Network?.ToDomain(),
            Resources = Resources?.ToDomain(),
            Permissions = Permissions.ToDomain()
        };
    }
}

/// <summary>
/// DTO for network configuration.
/// </summary>
public class NetworkConfigDto
{
    public string NetworkName { get; set; } = string.Empty;
    public string? Subnet { get; set; }
    public string? Gateway { get; set; }
    public bool Internal { get; set; }
    public Dictionary<string, string> Labels { get; set; } = new();

    public static NetworkConfigDto FromDomain(NetworkConfig config)
    {
        return new NetworkConfigDto
        {
            NetworkName = config.NetworkName,
            Subnet = config.Subnet,
            Gateway = config.Gateway,
            Internal = config.Internal,
            Labels = config.Labels
        };
    }

    public NetworkConfig ToDomain()
    {
        return new NetworkConfig
        {
            NetworkName = NetworkName,
            Subnet = Subnet,
            Gateway = Gateway,
            Internal = Internal,
            Labels = Labels
        };
    }
}

/// <summary>
/// DTO for resource limits.
/// </summary>
public class WorkspaceResourceLimitsDto
{
    public double CpuPercentage { get; set; }
    public long MemoryMb { get; set; }
    public long StorageGb { get; set; }
    public int MaxContainers { get; set; }

    public static WorkspaceResourceLimitsDto FromDomain(WorkspaceResourceLimits limits)
    {
        return new WorkspaceResourceLimitsDto
        {
            CpuPercentage = limits.CpuPercentage,
            MemoryMb = limits.MemoryMb,
            StorageGb = limits.StorageGb,
            MaxContainers = limits.MaxContainers
        };
    }

    public WorkspaceResourceLimits ToDomain()
    {
        return new WorkspaceResourceLimits
        {
            CpuPercentage = CpuPercentage,
            MemoryMb = MemoryMb,
            StorageGb = StorageGb,
            MaxContainers = MaxContainers
        };
    }
}

/// <summary>
/// DTO for workspace permissions.
/// </summary>
public class WorkspacePermissionsDto
{
    public List<string> CanReadFrom { get; set; } = new();
    public List<string> CanWriteTo { get; set; } = new();
    public List<string> CanPromoteTo { get; set; } = new();
    public List<string> AllowReadFrom { get; set; } = new();
    public List<string> AllowWriteFrom { get; set; } = new();

    public static WorkspacePermissionsDto FromDomain(WorkspacePermissions permissions)
    {
        return new WorkspacePermissionsDto
        {
            CanReadFrom = permissions.CanReadFrom,
            CanWriteTo = permissions.CanWriteTo,
            CanPromoteTo = permissions.CanPromoteTo,
            AllowReadFrom = permissions.AllowReadFrom,
            AllowWriteFrom = permissions.AllowWriteFrom
        };
    }

    public WorkspacePermissions ToDomain()
    {
        return new WorkspacePermissions
        {
            CanReadFrom = CanReadFrom,
            CanWriteTo = CanWriteTo,
            CanPromoteTo = CanPromoteTo,
            AllowReadFrom = AllowReadFrom,
            AllowWriteFrom = AllowWriteFrom
        };
    }
}

/// <summary>
/// Request to create a workspace.
/// </summary>
public class CreateWorkspaceRequest
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "Custom";
    public string? Description { get; set; }
    public string? Path { get; set; }
    public bool Isolated { get; set; }
    public WorkspaceIsolationDto? IsolationConfig { get; set; }
    public WorkspaceSettingsDto? Settings { get; set; }
    public ContextPermissionsDto? Permissions { get; set; }
    public Dictionary<string, SessionTemplateDto>? SessionTemplates { get; set; }
    public Dictionary<string, string>? EntryPoints { get; set; }
}

/// <summary>
/// Request to update a workspace.
/// </summary>
public class UpdateWorkspaceRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public WorkspaceSettingsDto? Settings { get; set; }
    public WorkspaceIsolationDto? Isolation { get; set; }
}

/// <summary>
/// DTO for workspace topology.
/// </summary>
public class WorkspaceTopologyDto
{
    public List<WorkspaceNodeDto> Nodes { get; set; } = new();
    public List<WorkspaceEdgeDto> Edges { get; set; } = new();
}

public class WorkspaceNodeDto
{
    public string WorkspaceId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int SessionCount { get; set; }
    public int ProjectCount { get; set; }
    public bool IsIsolated { get; set; }
}

public class WorkspaceEdgeDto
{
    public string SourceWorkspaceId { get; set; } = string.Empty;
    public string TargetWorkspaceId { get; set; } = string.Empty;
    public string EdgeType { get; set; } = string.Empty;
}
