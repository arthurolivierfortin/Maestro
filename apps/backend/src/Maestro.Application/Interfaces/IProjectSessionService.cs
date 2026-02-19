using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Service interface for project session operations.
/// </summary>
public interface IProjectSessionService
{
    /// <summary>
    /// Creates a new project session.
    /// </summary>
    Task<ProjectSession> CreateAsync(
        string name,
        ProjectSessionConfig config,
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
        string? workflowId = null,
        int? limit = null,
        CancellationToken ct = default);

    /// <summary>
    /// Starts a session execution.
    /// </summary>
    Task<ProjectSession> StartAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Gets the diff of changes made during the session.
    /// </summary>
    Task<SessionDiff> GetDiffAsync(SessionId id, CancellationToken ct = default);

    /// <summary>
    /// Runs tests for the session's project.
    /// </summary>
    Task<TestResult> RunTestsAsync(SessionId id, string? testCommand = null, CancellationToken ct = default);

    /// <summary>
    /// Commits the changes made during the session.
    /// </summary>
    Task<CommitInfo> CommitAsync(
        SessionId id,
        string message,
        string? branch = null,
        bool push = false,
        CancellationToken ct = default);

    /// <summary>
    /// Cancels a running or pending session.
    /// </summary>
    Task<ProjectSession> CancelAsync(SessionId id, bool discardChanges = true, CancellationToken ct = default);
}

/// <summary>
/// Represents the diff of changes in a session.
/// </summary>
public class SessionDiff
{
    /// <summary>
    /// List of file changes.
    /// </summary>
    public IList<FileDiff> Files { get; init; } = new List<FileDiff>();

    /// <summary>
    /// Total number of files modified.
    /// </summary>
    public int TotalFiles => Files.Count;

    /// <summary>
    /// Total lines added.
    /// </summary>
    public int LinesAdded { get; init; }

    /// <summary>
    /// Total lines removed.
    /// </summary>
    public int LinesRemoved { get; init; }
}

/// <summary>
/// Represents a file diff.
/// </summary>
public class FileDiff
{
    /// <summary>
    /// Path to the file.
    /// </summary>
    public required string Path { get; init; }

    /// <summary>
    /// Type of change.
    /// </summary>
    public required FileChangeType ChangeType { get; init; }

    /// <summary>
    /// Unified diff content.
    /// </summary>
    public string? Diff { get; init; }

    /// <summary>
    /// Lines added in this file.
    /// </summary>
    public int LinesAdded { get; init; }

    /// <summary>
    /// Lines removed in this file.
    /// </summary>
    public int LinesRemoved { get; init; }
}
