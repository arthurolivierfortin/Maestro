using Maestro.Domain.Configuration;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Unified session entity that represents any interactive Docker-based session.
/// Replaces the separate ProjectSession, FoundrySession, and TrainingSession types.
/// Sessions always run in Docker containers with configurable environment modes (Sandbox/Repo).
/// </summary>
public class Session
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
    /// Current status of the session.
    /// </summary>
    public SessionStatus Status { get; private set; } = SessionStatus.Created;

    /// <summary>
    /// The authority controlling this session.
    /// </summary>
    public required Authority Authority { get; set; }

    /// <summary>
    /// Composable configuration for this session.
    /// </summary>
    public required SessionConfig Config { get; init; }

    /// <summary>
    /// The Docker container ID when running.
    /// </summary>
    public string? ContainerId { get; private set; }

    /// <summary>
    /// Block registry for this session.
    /// </summary>
    public SessionBlockRegistry BlockRegistry { get; private set; } = SessionBlockRegistry.Empty();

    /// <summary>
    /// Current working directory within the container.
    /// </summary>
    public string WorkingDirectory { get; private set; } = "/workspace";

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
    /// Files modified during the session (for Repo mode).
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
    /// Commit information if changes were committed (Repo mode).
    /// </summary>
    public CommitInfo? CommitInfo { get; private set; }

    /// <summary>
    /// Event raised when a new event is emitted.
    /// </summary>
    public event EventHandler<SessionEvent>? OnEvent;

    private Session() { }

    /// <summary>
    /// Creates a new session with the specified configuration.
    /// </summary>
    public static Session Create(string name, Authority authority, SessionConfig config)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentNullException.ThrowIfNull(authority);
        ArgumentNullException.ThrowIfNull(config);

        // Validate config
        var errors = config.Validate();
        if (errors.Count > 0)
        {
            throw new ArgumentException($"Invalid session configuration: {string.Join(", ", errors)}");
        }

        var session = new Session
        {
            Id = SessionId.New(),
            Name = name,
            Authority = authority,
            Config = config,
            WorkingDirectory = config.WorkingDirectory
        };

        session.EmitEvent(SessionEvent.Info(
            session.Id.Value,
            $"Session created: {config.Mode} mode, category: {config.CategoryId ?? "uncategorized"}, image: {config.SandboxImageId}"));

        return session;
    }

    /// <summary>
    /// Creates a session from a template.
    /// </summary>
    public static Session CreateFromTemplate(
        string name,
        Authority authority,
        SessionTemplate template,
        RepoBind? repoBind = null)
    {
        var config = template.ToSessionConfig(repoBind);
        var session = Create(name, authority, config);
        session.EmitEvent(SessionEvent.Info(session.Id.Value, $"Created from template: {template.Id}"));
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
    /// Sets the container ID when the Docker container is created.
    /// </summary>
    public void SetContainerId(string containerId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(containerId);
        ContainerId = containerId;
        EmitEvent(SessionEvent.Info(Id.Value, $"Container created: {containerId[..12]}"));
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
    /// Records a file modification (primarily for Repo mode).
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
    /// Records commit information (Repo mode).
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
