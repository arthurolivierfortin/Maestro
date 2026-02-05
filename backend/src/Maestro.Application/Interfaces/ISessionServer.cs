using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Result of a command execution.
/// </summary>
public class CommandResult
{
    /// <summary>
    /// The command that was executed.
    /// </summary>
    public required SessionCommand Command { get; init; }

    /// <summary>
    /// Whether the command succeeded.
    /// </summary>
    public bool Success { get; init; }

    /// <summary>
    /// Output from the command.
    /// </summary>
    public string? Output { get; init; }

    /// <summary>
    /// Error message if the command failed.
    /// </summary>
    public string? Error { get; init; }

    /// <summary>
    /// Exit code (for shell commands).
    /// </summary>
    public int? ExitCode { get; init; }

    /// <summary>
    /// Additional data returned by the command.
    /// </summary>
    public object? Data { get; init; }
}

/// <summary>
/// Interface for command executors that handle specific command types.
/// </summary>
public interface ICommandExecutor
{
    /// <summary>
    /// Determines if this executor can handle the given command.
    /// </summary>
    bool CanHandle(SessionCommand command);

    /// <summary>
    /// Executes the command within the session context.
    /// </summary>
    Task<CommandResult> ExecuteAsync(
        SessionCommand command,
        ISessionContext context,
        CancellationToken ct = default);
}

/// <summary>
/// Context provided to command executors.
/// </summary>
public interface ISessionContext
{
    /// <summary>
    /// The session ID.
    /// </summary>
    string SessionId { get; }

    /// <summary>
    /// Session type (Project or Foundry).
    /// </summary>
    SessionType SessionType { get; }

    /// <summary>
    /// Current working directory (for Project sessions).
    /// </summary>
    string WorkingDirectory { get; }

    /// <summary>
    /// Project ID (for Project sessions).
    /// </summary>
    string? ProjectId { get; }

    /// <summary>
    /// Project root path (for Project sessions).
    /// </summary>
    string? ProjectPath { get; }

    /// <summary>
    /// Access configuration.
    /// </summary>
    AccessLevel AccessLevel { get; }

    /// <summary>
    /// Block registry for this session.
    /// </summary>
    SessionBlockRegistry BlockRegistry { get; }

    /// <summary>
    /// Emits an event to the session.
    /// </summary>
    void EmitEvent(SessionEvent evt);

    /// <summary>
    /// Changes the working directory.
    /// </summary>
    void SetWorkingDirectory(string path);

    /// <summary>
    /// Records a file change.
    /// </summary>
    void RecordFileChange(FileChange change);
}

/// <summary>
/// Server interface for managing Project sessions.
/// </summary>
public interface IProjectSessionServer
{
    /// <summary>
    /// Creates a new session.
    /// </summary>
    Task<ProjectSession> CreateAsync(
        string name,
        Authority authority,
        Domain.Configuration.ProjectSessionConfig config,
        CancellationToken ct = default);

    /// <summary>
    /// Gets a session by ID.
    /// </summary>
    Task<ProjectSession?> GetAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Gets all sessions with optional filtering.
    /// </summary>
    Task<IEnumerable<ProjectSession>> GetAllAsync(
        SessionStatus? status = null,
        string? projectId = null,
        int? limit = null,
        CancellationToken ct = default);

    /// <summary>
    /// Starts a session.
    /// </summary>
    Task<ProjectSession> StartAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Executes a command within the session.
    /// </summary>
    Task<CommandResult> ExecuteCommandAsync(
        SessionId id,
        string commandInput,
        CancellationToken ct = default);

    /// <summary>
    /// Subscribes to session events.
    /// </summary>
    IAsyncEnumerable<SessionEvent> SubscribeAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Pauses a session.
    /// </summary>
    Task<ProjectSession> PauseAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Resumes a paused session.
    /// </summary>
    Task<ProjectSession> ResumeAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Stops a session.
    /// </summary>
    Task<ProjectSession> StopAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Transfers control to a new authority.
    /// </summary>
    Task<ProjectSession> TakeControlAsync(
        SessionId id,
        Authority newAuthority,
        CancellationToken ct = default);

    /// <summary>
    /// Deletes a session.
    /// </summary>
    Task DeleteAsync(SessionId id, CancellationToken ct = default);
}

/// <summary>
/// Server interface for managing Foundry sessions.
/// </summary>
public interface IFoundrySessionServer
{
    /// <summary>
    /// Creates a new Foundry session.
    /// </summary>
    Task<FoundrySession> CreateAsync(
        string name,
        Authority authority,
        Domain.Configuration.FoundrySessionConfig? config = null,
        CancellationToken ct = default);

    /// <summary>
    /// Gets a session by ID.
    /// </summary>
    Task<FoundrySession?> GetAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Gets all Foundry sessions with optional filtering.
    /// </summary>
    Task<IEnumerable<FoundrySession>> GetAllAsync(
        SessionStatus? status = null,
        string? draftId = null,
        int? limit = null,
        CancellationToken ct = default);

    /// <summary>
    /// Starts a session.
    /// </summary>
    Task<FoundrySession> StartAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Executes a command within the session.
    /// </summary>
    Task<CommandResult> ExecuteCommandAsync(
        SessionId id,
        string commandInput,
        CancellationToken ct = default);

    /// <summary>
    /// Subscribes to session events.
    /// </summary>
    IAsyncEnumerable<SessionEvent> SubscribeAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Pauses a session.
    /// </summary>
    Task<FoundrySession> PauseAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Resumes a paused session.
    /// </summary>
    Task<FoundrySession> ResumeAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Stops a session.
    /// </summary>
    Task<FoundrySession> StopAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Deletes a session.
    /// </summary>
    Task DeleteAsync(SessionId id, CancellationToken ct = default);
}
