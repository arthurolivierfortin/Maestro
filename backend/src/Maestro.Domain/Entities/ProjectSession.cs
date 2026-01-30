using Maestro.Domain.Configuration;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a project session - an interactive server environment for managing a real project.
/// The authority (human, agent, or AI) can execute shell and Maestro commands within the session.
/// </summary>
public class ProjectSession
{
    private readonly List<SessionCommand> _commandHistory = new();
    private readonly List<SessionEvent> _eventHistory = new();
    private readonly Dictionary<string, AgentExecution> _runningAgents = new();

    public required SessionId Id { get; init; }

    /// <summary>
    /// Display name for the session.
    /// </summary>
    public required string Name { get; set; }

    /// <summary>
    /// The type of session (always Project for this entity).
    /// </summary>
    public SessionType Type => SessionType.Project;

    /// <summary>
    /// Current status of the session.
    /// </summary>
    public SessionStatus Status { get; private set; } = SessionStatus.Created;

    /// <summary>
    /// The authority controlling this session.
    /// </summary>
    public required Authority Authority { get; set; }

    /// <summary>
    /// Configuration for this project session.
    /// </summary>
    public required ProjectSessionConfig Config { get; init; }

    /// <summary>
    /// Block registry for this session.
    /// </summary>
    public SessionBlockRegistry BlockRegistry { get; private set; } = SessionBlockRegistry.Empty();

    /// <summary>
    /// Current working directory within the project.
    /// </summary>
    public string WorkingDirectory { get; private set; } = ".";

    /// <summary>
    /// When the session was created.
    /// </summary>
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    /// <summary>
    /// When the session was started.
    /// </summary>
    public DateTime? StartedAt { get; private set; }

    /// <summary>
    /// When the session completed (success, failure, or cancellation).
    /// </summary>
    public DateTime? CompletedAt { get; private set; }

    /// <summary>
    /// Duration of the session in milliseconds.
    /// </summary>
    public long? DurationMs => StartedAt.HasValue && CompletedAt.HasValue
        ? (long)(CompletedAt.Value - StartedAt.Value).TotalMilliseconds
        : null;

    /// <summary>
    /// Total commands executed.
    /// </summary>
    public int CommandCount => _commandHistory.Count;

    /// <summary>
    /// Command history for this session.
    /// </summary>
    public IReadOnlyList<SessionCommand> CommandHistory => _commandHistory.AsReadOnly();

    /// <summary>
    /// Event history for this session.
    /// </summary>
    public IReadOnlyList<SessionEvent> EventHistory => _eventHistory.AsReadOnly();

    /// <summary>
    /// Currently running agent executions.
    /// </summary>
    public IReadOnlyDictionary<string, AgentExecution> RunningAgents => _runningAgents;

    /// <summary>
    /// Files modified during the session.
    /// </summary>
    public IList<FileChange> ModifiedFiles { get; private set; } = new List<FileChange>();

    /// <summary>
    /// Error message if the session failed.
    /// </summary>
    public string? ErrorMessage { get; private set; }

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

    /// <summary>
    /// Event raised when a new event is emitted.
    /// </summary>
    public event EventHandler<SessionEvent>? OnEvent;

    private ProjectSession() { }

    /// <summary>
    /// Creates a new project session.
    /// </summary>
    public static ProjectSession Create(string name, Authority authority, ProjectSessionConfig config)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentNullException.ThrowIfNull(authority);
        ArgumentNullException.ThrowIfNull(config);

        var session = new ProjectSession
        {
            Id = SessionId.New(),
            Name = name,
            Authority = authority,
            Config = config
        };

        session.EmitEvent(SessionEvent.Info(session.Id.Value, $"Session created with authority: {authority}"));
        return session;
    }

    /// <summary>
    /// Initializes the block registry with available blocks.
    /// </summary>
    public void InitializeBlockRegistry(IEnumerable<string> blockIds)
    {
        BlockRegistry = SessionBlockRegistry.From(blockIds);
        EmitEvent(SessionEvent.Info(Id.Value, $"Block registry initialized with {BlockRegistry.Count} blocks"));
    }

    /// <summary>
    /// Starts the session.
    /// </summary>
    public void Start()
    {
        if (Status != SessionStatus.Created)
            throw new InvalidOperationException($"Cannot start session in status {Status}");

        var previousStatus = Status;
        Status = SessionStatus.Running;
        StartedAt = DateTime.UtcNow;

        EmitEvent(SessionEvent.StateChange(Id.Value, Status, previousStatus));
    }

    /// <summary>
    /// Pauses the session.
    /// </summary>
    public void Pause()
    {
        if (Status != SessionStatus.Running)
            throw new InvalidOperationException($"Cannot pause session in status {Status}");

        var previousStatus = Status;
        Status = SessionStatus.Paused;

        EmitEvent(SessionEvent.StateChange(Id.Value, Status, previousStatus));
    }

    /// <summary>
    /// Resumes a paused session.
    /// </summary>
    public void Resume()
    {
        if (Status != SessionStatus.Paused)
            throw new InvalidOperationException($"Cannot resume session in status {Status}");

        var previousStatus = Status;
        Status = SessionStatus.Running;

        EmitEvent(SessionEvent.StateChange(Id.Value, Status, previousStatus));
    }

    /// <summary>
    /// Stops the session.
    /// </summary>
    public void Stop()
    {
        if (Status == SessionStatus.Completed || Status == SessionStatus.Failed ||
            Status == SessionStatus.Cancelled || Status == SessionStatus.Stopped)
            throw new InvalidOperationException($"Cannot stop session in status {Status}");

        var previousStatus = Status;
        Status = SessionStatus.Stopped;
        CompletedAt = DateTime.UtcNow;

        // Stop all running agents
        foreach (var agent in _runningAgents.Values.ToList())
        {
            agent.Cancel();
            EmitEvent(SessionEvent.AgentFailed(agent.ExecutionId, agent.AgentId, "Session stopped"));
        }
        _runningAgents.Clear();

        EmitEvent(SessionEvent.StateChange(Id.Value, Status, previousStatus));
    }

    /// <summary>
    /// Submits a command for execution.
    /// </summary>
    public SessionCommand SubmitCommand(string input)
    {
        if (Status != SessionStatus.Running)
            throw new InvalidOperationException($"Cannot execute commands in session status {Status}");

        var command = SessionCommand.Parse(input);
        _commandHistory.Add(command);

        EmitEvent(SessionEvent.CommandSubmitted(Id.Value, command));
        return command;
    }

    /// <summary>
    /// Records a command result.
    /// </summary>
    public void RecordCommandResult(SessionCommand command, bool success, string? output = null, string? error = null, int? exitCode = null)
    {
        if (success)
        {
            command.MarkCompleted(output, exitCode);
            EmitEvent(SessionEvent.CommandCompleted(command.Id, output, exitCode));
        }
        else
        {
            command.MarkFailed(error ?? "Unknown error", exitCode);
            EmitEvent(SessionEvent.CommandFailed(command.Id, error ?? "Unknown error", exitCode));
        }
    }

    /// <summary>
    /// Changes the working directory.
    /// </summary>
    public void SetWorkingDirectory(string path)
    {
        WorkingDirectory = path;
        EmitEvent(SessionEvent.Info(Id.Value, $"Working directory changed to: {path}"));
    }

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

    /// <summary>
    /// Records a file modification.
    /// </summary>
    public void RecordFileChange(FileChange change)
    {
        ModifiedFiles.Add(change);
        EmitEvent(SessionEvent.FileChanged(Id.Value, change.Path, change.ChangeType.ToString()));
    }

    /// <summary>
    /// Completes the session successfully.
    /// </summary>
    public void Complete()
    {
        if (Status != SessionStatus.Running && Status != SessionStatus.Paused)
            throw new InvalidOperationException($"Cannot complete session in status {Status}");

        var previousStatus = Status;
        Status = SessionStatus.Completed;
        CompletedAt = DateTime.UtcNow;

        EmitEvent(SessionEvent.StateChange(Id.Value, Status, previousStatus));
    }

    /// <summary>
    /// Fails the session with an error.
    /// </summary>
    public void Fail(string errorMessage)
    {
        if (Status != SessionStatus.Running && Status != SessionStatus.Paused && Status != SessionStatus.Created)
            throw new InvalidOperationException($"Cannot fail session in status {Status}");

        var previousStatus = Status;
        Status = SessionStatus.Failed;
        CompletedAt = DateTime.UtcNow;
        ErrorMessage = errorMessage;

        EmitEvent(SessionEvent.Error(Id.Value, errorMessage));
        EmitEvent(SessionEvent.StateChange(Id.Value, Status, previousStatus));
    }

    /// <summary>
    /// Cancels the session.
    /// </summary>
    public void Cancel()
    {
        if (Status == SessionStatus.Completed || Status == SessionStatus.Failed ||
            Status == SessionStatus.Cancelled || Status == SessionStatus.Stopped)
            throw new InvalidOperationException($"Cannot cancel session in status {Status}");

        var previousStatus = Status;
        Status = SessionStatus.Cancelled;
        CompletedAt = DateTime.UtcNow;

        EmitEvent(SessionEvent.StateChange(Id.Value, Status, previousStatus));
    }

    /// <summary>
    /// Transfers control to a new authority.
    /// </summary>
    public void TransferControl(Authority newAuthority)
    {
        var oldAuthority = Authority;
        Authority = newAuthority;

        EmitEvent(SessionEvent.Info(Id.Value, $"Control transferred from {oldAuthority} to {newAuthority}"));
    }

    /// <summary>
    /// Records test results.
    /// </summary>
    public void SetTestResult(TestResult result)
    {
        TestResult = result;
        EmitEvent(SessionEvent.Info(Id.Value, $"Tests {(result.Passed ? "passed" : "failed")}: {result.PassedTests}/{result.TotalTests}"));
    }

    /// <summary>
    /// Records linter results.
    /// </summary>
    public void SetLinterResult(LinterResult result)
    {
        LinterResult = result;
        EmitEvent(SessionEvent.Info(Id.Value, $"Linter: {result.ErrorCount} errors, {result.WarningCount} warnings"));
    }

    /// <summary>
    /// Records commit information.
    /// </summary>
    public void SetCommitInfo(CommitInfo info)
    {
        CommitInfo = info;
        EmitEvent(SessionEvent.Info(Id.Value, $"Committed: {info.CommitHash[..7]} - {info.Message}"));
    }

    /// <summary>
    /// Emits an event and records it in history.
    /// </summary>
    private void EmitEvent(SessionEvent evt)
    {
        _eventHistory.Add(evt);
        OnEvent?.Invoke(this, evt);
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
