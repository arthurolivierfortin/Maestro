namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Value object representing container runtime configuration for a project.
/// </summary>
public record RuntimeConfiguration
{
    /// <summary>
    /// The container runtime type (e.g., "docker", "podman", "none").
    /// </summary>
    public string Type { get; init; } = "none";

    /// <summary>
    /// The container image to use (e.g., "node:20-alpine").
    /// </summary>
    public string? Image { get; init; }

    /// <summary>
    /// The working directory inside the container.
    /// </summary>
    public string WorkDir { get; init; } = "/app";

    /// <summary>
    /// Environment variables to set in the container.
    /// </summary>
    public IReadOnlyDictionary<string, string> Environment { get; init; } = 
        new Dictionary<string, string>();

    /// <summary>
    /// Resource limits for the container.
    /// </summary>
    public ResourceLimits? Resources { get; init; }

    /// <summary>
    /// Network mode for the container (e.g., "none", "bridge", "host").
    /// </summary>
    public string NetworkMode { get; init; } = "none";

    /// <summary>
    /// Volume mounts for the container (host_path:container_path[:mode]).
    /// Example: "/home/user/project:/app:rw"
    /// </summary>
    public IReadOnlyList<string> Volumes { get; init; } = Array.Empty<string>();

    /// <summary>
    /// Creates a default runtime configuration with no container isolation.
    /// </summary>
    public static RuntimeConfiguration Default => new();

    /// <summary>
    /// Creates a Docker runtime configuration with the specified image.
    /// </summary>
    public static RuntimeConfiguration Docker(string image) => new()
    {
        Type = "docker",
        Image = image
    };
}

/// <summary>
/// Resource limits for container execution.
/// </summary>
public record ResourceLimits
{
    /// <summary>
    /// CPU limit (e.g., "1.0" for 1 CPU, "0.5" for half CPU).
    /// </summary>
    public string? CpuLimit { get; init; }

    /// <summary>
    /// Memory limit (e.g., "512m", "1g").
    /// </summary>
    public string? MemoryLimit { get; init; }

    /// <summary>
    /// Maximum execution time in seconds.
    /// </summary>
    public int? TimeoutSeconds { get; init; }

    /// <summary>
    /// Default resource limits for sessions.
    /// </summary>
    public static ResourceLimits Default => new()
    {
        CpuLimit = "1.0",
        MemoryLimit = "512m",
        TimeoutSeconds = 3600
    };

    /// <summary>
    /// Minimal resource limits for lightweight tasks.
    /// </summary>
    public static ResourceLimits Minimal => new()
    {
        CpuLimit = "0.5",
        MemoryLimit = "256m",
        TimeoutSeconds = 1800
    };

    /// <summary>
    /// High resource limits for demanding tasks.
    /// </summary>
    public static ResourceLimits High => new()
    {
        CpuLimit = "2.0",
        MemoryLimit = "2g",
        TimeoutSeconds = 7200
    };
}
