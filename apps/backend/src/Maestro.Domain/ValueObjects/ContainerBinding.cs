using Maestro.Domain.Enums;

namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Value object that defines how a container session binds to the filesystem.
/// Unifies sandbox and repository binding patterns into a single abstraction.
/// </summary>
public record ContainerBinding
{
    /// <summary>
    /// The type of container binding.
    /// </summary>
    public ContainerBindingType Type { get; init; }

    // ===== Sandbox Properties =====

    /// <summary>
    /// Docker image for sandbox containers (e.g., "maestro/sandbox:latest").
    /// Only applicable when Type = Sandbox.
    /// </summary>
    public string? SandboxImage { get; init; }

    // ===== Repository Properties =====

    /// <summary>
    /// Host filesystem path to the repository.
    /// Only applicable when Type = Repository.
    /// </summary>
    public string? RepositoryPath { get; init; }

    /// <summary>
    /// Mount point inside the container (default: "/workspace").
    /// Only applicable when Type = Repository.
    /// </summary>
    public string DockerBindPath { get; init; } = "/workspace";

    /// <summary>
    /// Access level for repository operations.
    /// Only applicable when Type = Repository.
    /// </summary>
    public RepositoryAccessLevel AccessLevel { get; init; } = RepositoryAccessLevel.Controlled;

    /// <summary>
    /// Patterns for files/directories to exclude from container access.
    /// Security-sensitive patterns (e.g., ".env", "*.key") are excluded by default.
    /// </summary>
    public IReadOnlyList<string> ExcludePatterns { get; init; } = Array.Empty<string>();

    // ===== Runtime Configuration =====

    /// <summary>
    /// Optional runtime configuration for the container.
    /// </summary>
    public RuntimeConfiguration? RuntimeConfig { get; init; }

    // ===== Factory Methods =====

    /// <summary>
    /// Creates a sandbox binding for isolated, temporary execution.
    /// </summary>
    /// <param name="image">Docker image to use (default: maestro/sandbox:latest).</param>
    /// <param name="runtimeConfig">Optional runtime configuration.</param>
    public static ContainerBinding CreateSandbox(
        string? image = null,
        RuntimeConfiguration? runtimeConfig = null)
    {
        return new ContainerBinding
        {
            Type = ContainerBindingType.Sandbox,
            SandboxImage = image ?? DefaultSandboxImage,
            ExcludePatterns = Array.Empty<string>(),
            RuntimeConfig = runtimeConfig ?? RuntimeConfiguration.Docker(image ?? DefaultSandboxImage)
        };
    }

    /// <summary>
    /// Creates a repository binding for real project execution.
    /// </summary>
    /// <param name="repositoryPath">Host path to the repository.</param>
    /// <param name="accessLevel">Access level for file operations.</param>
    /// <param name="dockerBindPath">Mount point inside container (default: /workspace).</param>
    /// <param name="runtimeConfig">Optional runtime configuration.</param>
    public static ContainerBinding CreateRepositoryBound(
        string repositoryPath,
        RepositoryAccessLevel accessLevel = RepositoryAccessLevel.Controlled,
        string dockerBindPath = "/workspace",
        RuntimeConfiguration? runtimeConfig = null)
    {
        if (string.IsNullOrWhiteSpace(repositoryPath))
            throw new ArgumentException("Repository path cannot be empty", nameof(repositoryPath));

        return new ContainerBinding
        {
            Type = ContainerBindingType.Repository,
            RepositoryPath = repositoryPath,
            DockerBindPath = dockerBindPath,
            AccessLevel = accessLevel,
            ExcludePatterns = DefaultSecurityExcludePatterns,
            RuntimeConfig = runtimeConfig
        };
    }

    /// <summary>
    /// No container binding - used by Workspace which doesn't bind directly.
    /// </summary>
    public static ContainerBinding None => new()
    {
        Type = ContainerBindingType.None,
        ExcludePatterns = Array.Empty<string>()
    };

    // ===== Computed Properties =====

    /// <summary>
    /// Returns true if this binding uses a container.
    /// </summary>
    public bool UsesContainer => Type != ContainerBindingType.None;

    /// <summary>
    /// Returns true if this binding has persistent storage.
    /// </summary>
    public bool HasPersistentStorage => Type == ContainerBindingType.Repository;

    /// <summary>
    /// Returns true if this binding is isolated (sandbox).
    /// </summary>
    public bool IsIsolated => Type == ContainerBindingType.Sandbox;

    /// <summary>
    /// Generates Docker volume mount string for repository bindings.
    /// Returns null for non-repository bindings.
    /// </summary>
    public string? GetVolumeMountString()
    {
        if (Type != ContainerBindingType.Repository || string.IsNullOrEmpty(RepositoryPath))
            return null;

        var mode = AccessLevel == RepositoryAccessLevel.ReadOnly ? "ro" : "rw";
        return $"{RepositoryPath}:{DockerBindPath}:{mode}";
    }

    // ===== Constants =====

    /// <summary>
    /// Default sandbox image for isolated sessions.
    /// </summary>
    public const string DefaultSandboxImage = "maestro/sandbox:latest";

    /// <summary>
    /// Default security patterns to exclude from container access.
    /// </summary>
    public static readonly IReadOnlyList<string> DefaultSecurityExcludePatterns = new[]
    {
        ".env",
        ".env.*",
        "*.pem",
        "*.key",
        "*.p12",
        "*.pfx",
        "secrets/",
        ".secrets/",
        "credentials/",
        ".credentials/",
        "*.secret",
        ".git/config"  // May contain credentials
    };
}

/// <summary>
/// Access level for repository-bound containers.
/// Determines what file operations are allowed.
/// </summary>
public enum RepositoryAccessLevel
{
    /// <summary>
    /// Read-only access - can read files but not modify.
    /// Container mount: :ro
    /// </summary>
    ReadOnly,

    /// <summary>
    /// Controlled access - can modify files with restrictions.
    /// Changes require review before commit.
    /// Container mount: :rw
    /// </summary>
    Controlled,

    /// <summary>
    /// Full access - unrestricted read/write operations.
    /// Use with caution.
    /// Container mount: :rw
    /// </summary>
    Full
}
