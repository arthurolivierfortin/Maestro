namespace Maestro.Domain.Enums;

/// <summary>
/// Unified status enum for all container sessions (Workspace and Session subtypes).
/// Provides a consistent lifecycle model across the hierarchy.
/// </summary>
public enum ContainerSessionStatus
{
    /// <summary>
    /// Initial state - session/workspace has been created but not activated.
    /// Valid for: All types.
    /// </summary>
    Created,

    /// <summary>
    /// Active and operational - accepting commands and executing.
    /// Valid for: All types.
    /// </summary>
    Active,

    /// <summary>
    /// Temporarily suspended - can be resumed.
    /// Valid for: All types.
    /// </summary>
    Paused,

    /// <summary>
    /// Terminated/completed - final state for sessions.
    /// Valid for: Session types (not Workspace).
    /// </summary>
    Ended,

    /// <summary>
    /// Long-term storage - final state for workspaces.
    /// Valid for: Workspace only.
    /// </summary>
    Archived,

    /// <summary>
    /// Timed out due to inactivity or max duration reached.
    /// Valid for: Session types (not Workspace).
    /// </summary>
    Expired
}
