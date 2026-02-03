namespace Maestro.Domain.Enums;

/// <summary>
/// Environment mode for sessions - determines how the container interacts with the host.
/// </summary>
public enum EnvironmentMode
{
    /// <summary>
    /// Sandbox mode: Container runs isolated with no bind mounts.
    /// Data is ephemeral and destroyed when the session ends.
    /// Use for testing, experimentation, and safe execution.
    /// </summary>
    Sandbox,

    /// <summary>
    /// Repo mode: Container is bound to a host repository.
    /// Changes made in the container are persisted to the host filesystem.
    /// Use for real project work and development.
    /// </summary>
    Repo
}
