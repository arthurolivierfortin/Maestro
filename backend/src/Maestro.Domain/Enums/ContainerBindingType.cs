namespace Maestro.Domain.Enums;

/// <summary>
/// Defines how a container session binds to the filesystem.
/// </summary>
public enum ContainerBindingType
{
    /// <summary>
    /// No container binding - runs directly on host (used by Workspace).
    /// </summary>
    None,

    /// <summary>
    /// Isolated sandbox container - temporary, no persistence.
    /// Used by FoundrySession for block development.
    /// </summary>
    Sandbox,

    /// <summary>
    /// Container bound to a repository via Docker volume mount.
    /// Used by ProjectSession for real project execution.
    /// </summary>
    Repository
}
