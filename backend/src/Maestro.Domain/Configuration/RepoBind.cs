namespace Maestro.Domain.Configuration;

/// <summary>
/// Configuration for binding a host repository to a Docker container.
/// Used in Repo mode sessions.
/// </summary>
public class RepoBind
{
    /// <summary>
    /// The absolute path to the repository on the host machine.
    /// </summary>
    public required string HostPath { get; set; }

    /// <summary>
    /// The path where the repository will be mounted in the container.
    /// Defaults to /workspace.
    /// </summary>
    public string ContainerPath { get; set; } = "/workspace";

    /// <summary>
    /// Whether the bind mount is read-only.
    /// When true, the container cannot modify files in the repository.
    /// </summary>
    public bool ReadOnly { get; set; } = false;

    /// <summary>
    /// Creates a RepoBind configuration with default container path.
    /// </summary>
    /// <param name="hostPath">The absolute path to the repository on the host.</param>
    /// <returns>A new RepoBind configuration.</returns>
    public static RepoBind Create(string hostPath) => new()
    {
        HostPath = hostPath
    };

    /// <summary>
    /// Creates a read-only RepoBind configuration.
    /// </summary>
    /// <param name="hostPath">The absolute path to the repository on the host.</param>
    /// <returns>A new read-only RepoBind configuration.</returns>
    public static RepoBind CreateReadOnly(string hostPath) => new()
    {
        HostPath = hostPath,
        ReadOnly = true
    };
}
