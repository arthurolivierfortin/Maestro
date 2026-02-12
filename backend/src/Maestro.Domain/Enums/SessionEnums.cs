namespace Maestro.Domain.Enums;

/// <summary>
/// Type of session - Foundry for development/testing, Project for production execution.
/// </summary>
public enum SessionType
{
    /// <summary>
    /// Foundry session for forging, testing, and improving blocks in a sandbox.
    /// </summary>
    Foundry,

    /// <summary>
    /// Project session for executing workflows on real projects.
    /// </summary>
    Project
}

/// <summary>
/// Type of authority controlling a session.
/// </summary>
public enum AuthorityType
{
    /// <summary>
    /// Human interactive control (via CLI or UI).
    /// </summary>
    Human,

    /// <summary>
    /// Maestro agent as the controller.
    /// </summary>
    Agent,

    /// <summary>
    /// External AI system (Claude Code, Cursor, etc.).
    /// </summary>
    AI
}

/// <summary>
/// Status of a session throughout its lifecycle.
/// </summary>
public enum SessionStatus
{
    /// <summary>
    /// Session has been created but not started.
    /// </summary>
    Created,

    /// <summary>
    /// Session is currently running a workflow.
    /// </summary>
    Running,

    /// <summary>
    /// Session is started but no workflow is actively running.
    /// </summary>
    Idle,

    /// <summary>
    /// Session has been paused.
    /// </summary>
    Paused,

    /// <summary>
    /// Session completed successfully.
    /// </summary>
    Completed,

    /// <summary>
    /// Session failed with an error.
    /// </summary>
    Failed,

    /// <summary>
    /// Session was cancelled by user.
    /// </summary>
    Cancelled,

    /// <summary>
    /// Session was manually stopped.
    /// </summary>
    Stopped
}

/// <summary>
/// Type of event emitted by a session.
/// </summary>
public enum SessionEventType
{
    /// <summary>
    /// Session state changed (started, paused, resumed, etc.).
    /// </summary>
    StateChange,

    /// <summary>
    /// Command was submitted.
    /// </summary>
    CommandSubmitted,

    /// <summary>
    /// Command started executing.
    /// </summary>
    CommandStarted,

    /// <summary>
    /// Command output (partial or complete).
    /// </summary>
    CommandOutput,

    /// <summary>
    /// Command completed.
    /// </summary>
    CommandCompleted,

    /// <summary>
    /// Command failed.
    /// </summary>
    CommandFailed,

    /// <summary>
    /// Agent started execution.
    /// </summary>
    AgentStarted,

    /// <summary>
    /// Agent event (action, output, etc.).
    /// </summary>
    AgentEvent,

    /// <summary>
    /// Agent completed execution.
    /// </summary>
    AgentCompleted,

    /// <summary>
    /// Agent failed.
    /// </summary>
    AgentFailed,

    /// <summary>
    /// File was modified.
    /// </summary>
    FileChanged,

    /// <summary>
    /// Error occurred.
    /// </summary>
    Error,

    /// <summary>
    /// Information message.
    /// </summary>
    Info
}

/// <summary>
/// Type of command in a session.
/// </summary>
public enum SessionCommandType
{
    /// <summary>
    /// Shell command (ls, cd, git, etc.).
    /// </summary>
    Shell,

    /// <summary>
    /// Maestro command (blocks, agents, monitor, etc.).
    /// </summary>
    Maestro,

    /// <summary>
    /// Session control command (pause, resume, exit).
    /// </summary>
    Control
}

/// <summary>
/// Access level for project sessions controlling what operations are allowed.
/// </summary>
public enum AccessLevel
{
    /// <summary>
    /// Read-only access - can read files but not modify.
    /// </summary>
    ReadOnly,

    /// <summary>
    /// Sandbox access - modifications are made to a temporary copy.
    /// </summary>
    Sandbox,

    /// <summary>
    /// Controlled access - can modify files but requires validation before commit.
    /// </summary>
    Controlled,

    /// <summary>
    /// Full access - can modify and commit directly.
    /// </summary>
    Full
}
