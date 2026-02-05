using Maestro.Domain.Configuration;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a project session - an interactive server environment for managing a real project.
/// The authority (human, agent, or AI) can execute shell and Maestro commands within the session.
///
/// Inherits from Session to get common session functionality (command history, events, lifecycle).
/// ProjectSession adds project-specific features like file tracking, tests, linting, and commits.
/// </summary>
public class ProjectSession : Session
{
    private readonly Dictionary<string, AgentExecution> _runningAgents = new();

    // ===== Project-Specific Properties =====

    /// <summary>
    /// The type of session (always Project for this entity).
    /// </summary>
    public override SessionType SessionType => SessionType.Project;

    /// <summary>
    /// Configuration for this project session.
    /// </summary>
    public ProjectSessionConfig Config { get; private set; } = null!;

    /// <summary>
    /// Current working directory within the project.
    /// </summary>
    public string WorkingDirectory { get; private set; } = ".";

    /// <summary>
    /// Repository path for this session.
    /// </summary>
    public string? RepositoryPath { get; private set; }

    /// <summary>
    /// Currently running agent executions.
    /// </summary>
    public IReadOnlyDictionary<string, AgentExecution> RunningAgents => _runningAgents;

    /// <summary>
    /// Files modified during the session.
    /// </summary>
    public IList<FileChange> ModifiedFiles { get; private set; } = new List<FileChange>();

    /// <summary>
    /// Test results if tests were run.
    /// </summary>
    public TestResult? TestResult { get; private set; }

    /// <summary>
    /// Linter results if linter was run.
    /// </summary>
    public LinterResult? LinterResult { get; private set; }

    /// <summary>
    /// Commit information if changes were committed.
    /// </summary>
    public CommitInfo? CommitInfo { get; private set; }

    // ===== ContainerSession Implementation =====

    /// <summary>
    /// Returns the parent context for permission inheritance.
    /// Note: Full implementation with workspace lookup is done in the service layer.
    /// </summary>
    public override ContainerSession? GetParentContext()
    {
        // The parent workspace lookup is done at the service layer
        // because it requires repository access
        return null;
    }

    // ===== Constructor =====

    private ProjectSession() { }

    // ===== Factory Methods =====

    /// <summary>
    /// Creates a new project session.
    /// </summary>
    public static ProjectSession Create(
        string name,
        Authority authority,
        ProjectSessionConfig config,
        string? repositoryPath = null,
        ContextPermissions? permissions = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentNullException.ThrowIfNull(authority);
        ArgumentNullException.ThrowIfNull(config);

        var accessLevel = MapAccessLevel(config.Access.Level);

        var session = new ProjectSession
        {
            Id = Guid.NewGuid().ToString(),
            Name = name,
            Authority = authority,
            Config = config,
            RepositoryPath = repositoryPath,
            Status = ContainerSessionStatus.Created,
            Permissions = permissions ?? ContextPermissions.Full,
            Binding = repositoryPath != null
                ? ContainerBinding.CreateRepositoryBound(repositoryPath, accessLevel)
                : ContainerBinding.CreateSandbox(),
            CreatedAt = DateTimeOffset.UtcNow
        };

        session.EmitEvent(SessionEvent.Info(session.Id, $"Session created with authority: {authority}"));
        return session;
    }

    /// <summary>
    /// Creates a project session with a parent workspace.
    /// </summary>
    public static ProjectSession CreateInWorkspace(
        string name,
        Authority authority,
        ProjectSessionConfig config,
        string workspaceId,
        string? repositoryPath = null,
        ContextPermissions? permissions = null)
    {
        var session = Create(name, authority, config, repositoryPath, permissions);
        session.ParentWorkspaceId = workspaceId;
        return session;
    }

    /// <summary>
    /// Reconstitutes a project session from persisted data.
    /// </summary>
    public static ProjectSession Reconstitute(
        string id,
        string name,
        Authority authority,
        ProjectSessionConfig config,
        ContainerSessionStatus status,
        SessionTerminalReason terminalReason,
        string? repositoryPath,
        string? parentWorkspaceId,
        string? parentSessionId,
        string workingDirectory,
        ContextPermissions permissions,
        ContainerBinding binding,
        SessionBlockRegistry blockRegistry,
        IList<FileChange> modifiedFiles,
        TestResult? testResult,
        LinterResult? linterResult,
        CommitInfo? commitInfo,
        string? errorMessage,
        DateTimeOffset createdAt,
        DateTimeOffset? startedAt,
        DateTimeOffset? completedAt,
        DateTimeOffset? updatedAt,
        string? createdBy,
        IEnumerable<SessionCommand>? commandHistory = null,
        IEnumerable<SessionEvent>? eventHistory = null,
        Dictionary<string, object>? variables = null,
        Dictionary<string, string>? entryPoints = null,
        List<MonitorWidgetConfig>? monitorWidgets = null)
    {
        var session = new ProjectSession
        {
            Id = id,
            Name = name,
            Authority = authority,
            Config = config,
            Status = status,
            TerminalReason = terminalReason,
            RepositoryPath = repositoryPath,
            ParentWorkspaceId = parentWorkspaceId,
            ParentSessionId = parentSessionId,
            WorkingDirectory = workingDirectory,
            Permissions = permissions,
            Binding = binding,
            BlockRegistry = blockRegistry,
            ModifiedFiles = modifiedFiles,
            TestResult = testResult,
            LinterResult = linterResult,
            CommitInfo = commitInfo,
            ErrorMessage = errorMessage,
            CreatedAt = createdAt,
            StartedAt = startedAt,
            CompletedAt = completedAt,
            UpdatedAt = updatedAt,
            CreatedBy = createdBy,
            Variables = variables ?? new Dictionary<string, object>(),
            EntryPoints = entryPoints ?? new Dictionary<string, string>(),
            MonitorWidgets = monitorWidgets ?? new List<MonitorWidgetConfig>()
        };

        // Restore command and event history
        if (commandHistory != null)
        {
            foreach (var cmd in commandHistory)
            {
                session.AddCommandToHistory(cmd);
            }
        }

        if (eventHistory != null)
        {
            foreach (var evt in eventHistory)
            {
                session.AddEventToHistory(evt);
            }
        }

        return session;
    }

    // ===== Lifecycle Overrides =====

    /// <summary>
    /// Stops the session and cancels all running agents.
    /// </summary>
    public override void Stop()
    {
        // Cancel all running agents before stopping
        foreach (var agent in _runningAgents.Values.ToList())
        {
            agent.Cancel();
            EmitEvent(SessionEvent.AgentFailed(agent.ExecutionId, agent.AgentId, "Session stopped"));
        }
        _runningAgents.Clear();

        base.Stop();
    }

    // ===== Working Directory =====

    /// <summary>
    /// Changes the working directory.
    /// </summary>
    public void SetWorkingDirectory(string path)
    {
        WorkingDirectory = path;
        UpdatedAt = DateTimeOffset.UtcNow;
        EmitEvent(SessionEvent.Info(Id, $"Working directory changed to: {path}"));
    }

    // ===== Agent Management =====

    /// <summary>
    /// Records an agent execution starting.
    /// </summary>
    public AgentExecution StartAgent(string agentId, string task)
    {
        var execution = new AgentExecution
        {
            ExecutionId = Guid.NewGuid().ToString("N")[..12],
            AgentId = agentId,
            Task = task,
            StartedAt = DateTime.UtcNow,
            Status = AgentExecutionStatus.Running
        };

        _runningAgents[execution.ExecutionId] = execution;
        EmitEvent(SessionEvent.AgentStarted(execution.ExecutionId, agentId, task));

        return execution;
    }

    /// <summary>
    /// Records an agent action.
    /// </summary>
    public void RecordAgentAction(string executionId, string action, string? details = null)
    {
        EmitEvent(SessionEvent.AgentAction(executionId, action, details));
    }

    /// <summary>
    /// Records an agent completion.
    /// </summary>
    public void CompleteAgent(string executionId, object? result = null)
    {
        if (_runningAgents.TryGetValue(executionId, out var execution))
        {
            execution.Status = AgentExecutionStatus.Completed;
            execution.CompletedAt = DateTime.UtcNow;
            execution.Result = result;
            _runningAgents.Remove(executionId);

            EmitEvent(SessionEvent.AgentCompleted(executionId, execution.AgentId, result));
        }
    }

    /// <summary>
    /// Records an agent failure.
    /// </summary>
    public void FailAgent(string executionId, string error)
    {
        if (_runningAgents.TryGetValue(executionId, out var execution))
        {
            execution.Status = AgentExecutionStatus.Failed;
            execution.CompletedAt = DateTime.UtcNow;
            execution.Error = error;
            _runningAgents.Remove(executionId);

            EmitEvent(SessionEvent.AgentFailed(executionId, execution.AgentId, error));
        }
    }

    // ===== File Tracking =====

    /// <summary>
    /// Records a file modification.
    /// </summary>
    public void RecordFileChange(FileChange change)
    {
        ModifiedFiles.Add(change);
        EmitEvent(SessionEvent.FileChanged(Id, change.Path, change.ChangeType.ToString()));
    }

    // ===== Results =====

    /// <summary>
    /// Records test results.
    /// </summary>
    public void SetTestResult(TestResult result)
    {
        TestResult = result;
        UpdatedAt = DateTimeOffset.UtcNow;
        EmitEvent(SessionEvent.Info(Id, $"Tests {(result.Passed ? "passed" : "failed")}: {result.PassedTests}/{result.TotalTests}"));
    }

    /// <summary>
    /// Records linter results.
    /// </summary>
    public void SetLinterResult(LinterResult result)
    {
        LinterResult = result;
        UpdatedAt = DateTimeOffset.UtcNow;
        EmitEvent(SessionEvent.Info(Id, $"Linter: {result.ErrorCount} errors, {result.WarningCount} warnings"));
    }

    /// <summary>
    /// Records commit information.
    /// </summary>
    public void SetCommitInfo(CommitInfo info)
    {
        CommitInfo = info;
        UpdatedAt = DateTimeOffset.UtcNow;
        EmitEvent(SessionEvent.Info(Id, $"Committed: {info.CommitHash[..7]} - {info.Message}"));
    }

    // ===== Helpers =====

    /// <summary>
    /// Maps AccessLevel to RepositoryAccessLevel.
    /// </summary>
    private static ValueObjects.RepositoryAccessLevel MapAccessLevel(AccessLevel level)
    {
        return level switch
        {
            AccessLevel.ReadOnly => ValueObjects.RepositoryAccessLevel.ReadOnly,
            AccessLevel.Sandbox => ValueObjects.RepositoryAccessLevel.Controlled, // Sandbox uses controlled access
            AccessLevel.Controlled => ValueObjects.RepositoryAccessLevel.Controlled,
            AccessLevel.Full => ValueObjects.RepositoryAccessLevel.Full,
            _ => ValueObjects.RepositoryAccessLevel.Controlled
        };
    }
}

/// <summary>
/// Represents a file change during a session.
/// </summary>
public class FileChange
{
    /// <summary>
    /// Path to the file relative to project root.
    /// </summary>
    public required string Path { get; init; }

    /// <summary>
    /// Type of change: Created, Modified, Deleted.
    /// </summary>
    public required FileChangeType ChangeType { get; init; }

    /// <summary>
    /// Original content (for Modified and Deleted).
    /// </summary>
    public string? OriginalContent { get; init; }

    /// <summary>
    /// New content (for Created and Modified).
    /// </summary>
    public string? NewContent { get; init; }
}

/// <summary>
/// Type of file change.
/// </summary>
public enum FileChangeType
{
    Created,
    Modified,
    Deleted
}

/// <summary>
/// Represents a running agent execution within a session.
/// </summary>
public class AgentExecution
{
    /// <summary>
    /// Unique ID for this execution.
    /// </summary>
    public required string ExecutionId { get; init; }

    /// <summary>
    /// The agent being executed.
    /// </summary>
    public required string AgentId { get; init; }

    /// <summary>
    /// The task assigned to the agent.
    /// </summary>
    public required string Task { get; init; }

    /// <summary>
    /// When the execution started.
    /// </summary>
    public required DateTime StartedAt { get; init; }

    /// <summary>
    /// When the execution completed.
    /// </summary>
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// Status of the execution.
    /// </summary>
    public AgentExecutionStatus Status { get; set; }

    /// <summary>
    /// Result of the execution (if completed).
    /// </summary>
    public object? Result { get; set; }

    /// <summary>
    /// Error message (if failed).
    /// </summary>
    public string? Error { get; set; }

    /// <summary>
    /// Cancellation token source for stopping the agent.
    /// </summary>
    private CancellationTokenSource? _cts;

    /// <summary>
    /// Gets the cancellation token for this execution.
    /// </summary>
    public CancellationToken GetCancellationToken()
    {
        _cts ??= new CancellationTokenSource();
        return _cts.Token;
    }

    /// <summary>
    /// Cancels the execution.
    /// </summary>
    public void Cancel()
    {
        _cts?.Cancel();
        Status = AgentExecutionStatus.Cancelled;
        CompletedAt = DateTime.UtcNow;
    }
}

/// <summary>
/// Status of an agent execution.
/// </summary>
public enum AgentExecutionStatus
{
    Running,
    Completed,
    Failed,
    Cancelled
}

/// <summary>
/// Result of running tests.
/// </summary>
public class TestResult
{
    /// <summary>
    /// Whether all tests passed.
    /// </summary>
    public bool Passed { get; init; }

    /// <summary>
    /// Total number of tests run.
    /// </summary>
    public int TotalTests { get; init; }

    /// <summary>
    /// Number of tests that passed.
    /// </summary>
    public int PassedTests { get; init; }

    /// <summary>
    /// Number of tests that failed.
    /// </summary>
    public int FailedTests { get; init; }

    /// <summary>
    /// Raw output from the test command.
    /// </summary>
    public string? Output { get; init; }

    /// <summary>
    /// Duration of test run in milliseconds.
    /// </summary>
    public long DurationMs { get; init; }
}

/// <summary>
/// Result of running linter.
/// </summary>
public class LinterResult
{
    /// <summary>
    /// Whether the linter passed with no errors.
    /// </summary>
    public bool Clean { get; init; }

    /// <summary>
    /// Number of errors found.
    /// </summary>
    public int ErrorCount { get; init; }

    /// <summary>
    /// Number of warnings found.
    /// </summary>
    public int WarningCount { get; init; }

    /// <summary>
    /// Raw output from the linter command.
    /// </summary>
    public string? Output { get; init; }
}

/// <summary>
/// Information about a Git commit.
/// </summary>
public class CommitInfo
{
    /// <summary>
    /// The commit hash.
    /// </summary>
    public required string CommitHash { get; init; }

    /// <summary>
    /// The commit message.
    /// </summary>
    public required string Message { get; init; }

    /// <summary>
    /// The branch name.
    /// </summary>
    public required string Branch { get; init; }

    /// <summary>
    /// Whether the commit was pushed to remote.
    /// </summary>
    public bool Pushed { get; init; }

    /// <summary>
    /// When the commit was created.
    /// </summary>
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}
