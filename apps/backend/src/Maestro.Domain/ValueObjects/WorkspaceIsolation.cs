using System;
using System.Collections.Generic;

namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Isolation configuration for a workspace.
/// Supports Docker-based network and resource isolation.
/// </summary>
public record WorkspaceIsolation
{
    /// <summary>Whether isolation is enabled.</summary>
    public bool Enabled { get; init; }

    /// <summary>Docker network configuration.</summary>
    public NetworkConfig? Network { get; init; }

    /// <summary>Resource limits (CPU, RAM, storage).</summary>
    public WorkspaceResourceLimits? Resources { get; init; }

    /// <summary>Cross-workspace permissions.</summary>
    public WorkspacePermissions Permissions { get; init; } = new();

    /// <summary>
    /// Creates an isolated workspace configuration.
    /// </summary>
    public static WorkspaceIsolation CreateIsolated(
        string networkName,
        WorkspaceResourceLimits? resources = null,
        WorkspacePermissions? permissions = null)
    {
        return new WorkspaceIsolation
        {
            Enabled = true,
            Network = new NetworkConfig { NetworkName = networkName },
            Resources = resources ?? WorkspaceResourceLimits.Default,
            Permissions = permissions ?? new WorkspacePermissions()
        };
    }

    /// <summary>
    /// Creates a non-isolated workspace configuration.
    /// </summary>
    public static WorkspaceIsolation CreateShared()
    {
        return new WorkspaceIsolation
        {
            Enabled = false
        };
    }
}

/// <summary>
/// Docker network configuration for workspace isolation.
/// </summary>
public record NetworkConfig
{
    /// <summary>Docker network name.</summary>
    public string NetworkName { get; init; } = string.Empty;

    /// <summary>Network subnet (e.g., "172.20.0.0/16").</summary>
    public string? Subnet { get; init; }

    /// <summary>Network gateway IP.</summary>
    public string? Gateway { get; init; }

    /// <summary>Whether to use internal network (no external access).</summary>
    public bool Internal { get; init; }

    /// <summary>Additional network labels.</summary>
    public Dictionary<string, string> Labels { get; init; } = new();
}

/// <summary>
/// Resource limits for an isolated workspace.
/// </summary>
public record WorkspaceResourceLimits
{
    /// <summary>CPU limit as percentage (0-100).</summary>
    public double CpuPercentage { get; init; } = 50;

    /// <summary>Memory limit in MB.</summary>
    public long MemoryMb { get; init; } = 4096;

    /// <summary>Storage limit in GB.</summary>
    public long StorageGb { get; init; } = 50;

    /// <summary>Maximum number of containers.</summary>
    public int MaxContainers { get; init; } = 10;

    /// <summary>
    /// Default resource limits.
    /// </summary>
    public static WorkspaceResourceLimits Default => new()
    {
        CpuPercentage = 50,
        MemoryMb = 4096,
        StorageGb = 50,
        MaxContainers = 10
    };

    /// <summary>
    /// Minimal resource limits for testing.
    /// </summary>
    public static WorkspaceResourceLimits Minimal => new()
    {
        CpuPercentage = 25,
        MemoryMb = 1024,
        StorageGb = 10,
        MaxContainers = 3
    };

    /// <summary>
    /// High resource limits for production.
    /// </summary>
    public static WorkspaceResourceLimits Production => new()
    {
        CpuPercentage = 100,
        MemoryMb = 16384,
        StorageGb = 200,
        MaxContainers = 50
    };
}

/// <summary>
/// Cross-workspace permission configuration.
/// </summary>
public record WorkspacePermissions
{
    /// <summary>Workspaces this workspace can read metrics from.</summary>
    public List<string> CanReadFrom { get; init; } = new();

    /// <summary>Workspaces this workspace can write/promote to.</summary>
    public List<string> CanWriteTo { get; init; } = new();

    /// <summary>Workspaces this workspace can promote agents to.</summary>
    public List<string> CanPromoteTo { get; init; } = new();

    /// <summary>Workspaces that can read from this workspace.</summary>
    public List<string> AllowReadFrom { get; init; } = new();

    /// <summary>Workspaces that can write to this workspace.</summary>
    public List<string> AllowWriteFrom { get; init; } = new();

    /// <summary>
    /// Check if this workspace can promote to target.
    /// </summary>
    public bool CanPromoteToWorkspace(string targetWorkspaceId)
    {
        return CanPromoteTo.Contains(targetWorkspaceId) || CanPromoteTo.Contains("*");
    }

    /// <summary>
    /// Check if this workspace can read from source.
    /// </summary>
    public bool CanReadFromWorkspace(string sourceWorkspaceId)
    {
        return CanReadFrom.Contains(sourceWorkspaceId) || CanReadFrom.Contains("*");
    }

    /// <summary>
    /// Creates permissions for a Research workspace.
    /// </summary>
    public static WorkspacePermissions ForResearch()
    {
        return new WorkspacePermissions
        {
            CanReadFrom = new List<string> { "*" }, // Can read from any
            CanWriteTo = new List<string>(), // Cannot write anywhere
            CanPromoteTo = new List<string> { "staging" } // Can promote to staging
        };
    }

    /// <summary>
    /// Creates permissions for a Staging workspace.
    /// </summary>
    public static WorkspacePermissions ForStaging()
    {
        return new WorkspacePermissions
        {
            CanReadFrom = new List<string> { "research" },
            CanWriteTo = new List<string>(),
            CanPromoteTo = new List<string> { "production" },
            AllowReadFrom = new List<string> { "production" }
        };
    }

    /// <summary>
    /// Creates permissions for a Production workspace.
    /// </summary>
    public static WorkspacePermissions ForProduction()
    {
        return new WorkspacePermissions
        {
            CanReadFrom = new List<string> { "staging" },
            CanWriteTo = new List<string>(),
            CanPromoteTo = new List<string>(), // Cannot promote anywhere
            AllowReadFrom = new List<string>() // No one can read
        };
    }
}
