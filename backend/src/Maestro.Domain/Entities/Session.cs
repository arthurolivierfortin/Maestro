using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Reason why a session ended (for terminal states).
/// </summary>
public enum SessionTerminalReason
{
    /// <summary>Session is not in a terminal state.</summary>
    None,
    /// <summary>Session completed successfully.</summary>
    Completed,
    /// <summary>Session failed with an error.</summary>
    Failed,
    /// <summary>Session was cancelled by user.</summary>
    Cancelled,
    /// <summary>Session was manually stopped.</summary>
    Stopped
}

/// <summary>
/// Abstract base class for all sessions (ProjectSession, FoundrySession).
/// Extends ContainerSession with session-specific functionality like
/// command execution, event streaming, and authority management.
///
/// Inheritance hierarchy:
/// - ContainerSession (abstract)
///   - Workspace : ContainerSession
///   - Session : ContainerSession (abstract)
///     - ProjectSession : Session
///     - FoundrySession : Session
/// </summary>
public abstract class Session : ContainerSession
{
    // ===== Command and Event History =====

    private readonly List<SessionCommand> _commandHistory = new();
    private readonly List<SessionEvent> _eventHistory = new();

    /// <summary>
    /// Command history for this session.
    /// </summary>
    public IReadOnlyList<SessionCommand> CommandHistory => _commandHistory.AsReadOnly();

    /// <summary>
    /// Event history for this session.
    /// </summary>
    public IReadOnlyList<SessionEvent> EventHistory => _eventHistory.AsReadOnly();

    /// <summary>
    /// Total commands executed.
    /// </summary>
    public int CommandCount => _commandHistory.Count;

    // ===== Session-Specific Properties =====

    /// <summary>
    /// The authority controlling this session.
    /// </summary>
    public Authority Authority { get; protected set; } = Authority.Human();

    /// <summary>
    /// Block registry for this session.
    /// </summary>
    public SessionBlockRegistry BlockRegistry { get; protected set; } = SessionBlockRegistry.Empty();

    /// <summary>
    /// ID of the parent workspace (if any).
    /// </summary>
    public string? ParentWorkspaceId { get; protected set; }

    /// <summary>
    /// ID of the parent session (for nested sessions).
    /// </summary>
    public string? ParentSessionId { get; protected set; }

    /// <summary>
    /// Entry points mapping names to workflow IDs.
    /// Sessions define their own entry points (e.g., "start" -> "workflow:main").
    /// </summary>
    public Dictionary<string, string> EntryPoints { get; protected set; } = new();

    /// <summary>
    /// Monitor widget configurations for this session.
    /// Sessions register their own widgets using generic types.
    /// </summary>
    public List<MonitorWidgetConfig> MonitorWidgets { get; protected set; } = new();

    /// <summary>
    /// Type of session (Project, Foundry).
    /// </summary>
    public abstract SessionType SessionType { get; }

    // ===== Lifecycle Timestamps =====

    /// <summary>
    /// When the session was started.
    /// </summary>
    public DateTimeOffset? StartedAt { get; protected set; }

    /// <summary>
    /// When the session completed (success, failure, or cancellation).
    /// </summary>
    public DateTimeOffset? CompletedAt { get; protected set; }

    /// <summary>
    /// Duration of the session in milliseconds.
    /// </summary>
    public long? DurationMs => StartedAt.HasValue && CompletedAt.HasValue
        ? (long)(CompletedAt.Value - StartedAt.Value).TotalMilliseconds
        : null;

    // ===== Terminal State =====

    /// <summary>
    /// Reason for session termination (when Status == Ended).
    /// </summary>
    public SessionTerminalReason TerminalReason { get; protected set; } = SessionTerminalReason.None;

    /// <summary>
    /// Error message if the session failed.
    /// </summary>
    public string? ErrorMessage { get; protected set; }

    // ===== Events =====

    /// <summary>
    /// Event raised when a new event is emitted.
    /// </summary>
    public event EventHandler<SessionEvent>? OnEvent;

    // ===== ContainerSession Implementation =====

    /// <summary>
    /// Returns the file extension used for storage.
    /// </summary>
    public override string GetStorageExtension() => ".session.json";

    /// <summary>
    /// Validates session status transitions.
    /// </summary>
    protected override bool CanTransitionTo(ContainerSessionStatus newStatus)
    {
        return (Status, newStatus) switch
        {
            // From Created
            (ContainerSessionStatus.Created, ContainerSessionStatus.Active) => true,

            // From Active
            (ContainerSessionStatus.Active, ContainerSessionStatus.Paused) => true,
            (ContainerSessionStatus.Active, ContainerSessionStatus.Ended) => true,

            // From Paused
            (ContainerSessionStatus.Paused, ContainerSessionStatus.Active) => true,
            (ContainerSessionStatus.Paused, ContainerSessionStatus.Ended) => true,

            // Any state can expire (except Ended/Archived)
            (ContainerSessionStatus.Created, ContainerSessionStatus.Expired) => true,
            (ContainerSessionStatus.Active, ContainerSessionStatus.Expired) => true,
            (ContainerSessionStatus.Paused, ContainerSessionStatus.Expired) => true,

            // Ended is terminal
            _ => false
        };
    }

    // ===== Lifecycle Methods =====

    /// <summary>
    /// Starts the session.
    /// </summary>
    public virtual void Start()
    {
        if (Status != ContainerSessionStatus.Created)
            throw new InvalidOperationException($"Cannot start session in status {Status}");

        var previousStatus = Status;
        TransitionTo(ContainerSessionStatus.Active);
        StartedAt = DateTimeOffset.UtcNow;

        EmitEvent(SessionEvent.StateChange(Id, SessionStatus.Running, SessionStatus.Created));
    }

    /// <summary>
    /// Pauses the session.
    /// </summary>
    public virtual void Pause()
    {
        if (Status != ContainerSessionStatus.Active)
            throw new InvalidOperationException($"Cannot pause session in status {Status}");

        var previousStatus = Status;
        TransitionTo(ContainerSessionStatus.Paused);

        EmitEvent(SessionEvent.StateChange(Id, SessionStatus.Paused, SessionStatus.Running));
    }

    /// <summary>
    /// Resumes a paused session.
    /// </summary>
    public virtual void Resume()
    {
        if (Status != ContainerSessionStatus.Paused)
            throw new InvalidOperationException($"Cannot resume session in status {Status}");

        TransitionTo(ContainerSessionStatus.Active);

        EmitEvent(SessionEvent.StateChange(Id, SessionStatus.Running, SessionStatus.Paused));
    }

    /// <summary>
    /// Stops the session.
    /// </summary>
    public virtual void Stop()
    {
        if (Status == ContainerSessionStatus.Ended || Status == ContainerSessionStatus.Expired)
            throw new InvalidOperationException($"Cannot stop session in status {Status}");

        var previousStatus = Status;
        TransitionTo(ContainerSessionStatus.Ended);
        TerminalReason = SessionTerminalReason.Stopped;
        CompletedAt = DateTimeOffset.UtcNow;

        EmitEvent(SessionEvent.StateChange(Id, SessionStatus.Stopped, MapStatusToSessionStatus(previousStatus)));
    }

    /// <summary>
    /// Completes the session successfully.
    /// </summary>
    public virtual void Complete()
    {
        if (Status != ContainerSessionStatus.Active && Status != ContainerSessionStatus.Paused)
            throw new InvalidOperationException($"Cannot complete session in status {Status}");

        var previousStatus = Status;
        TransitionTo(ContainerSessionStatus.Ended);
        TerminalReason = SessionTerminalReason.Completed;
        CompletedAt = DateTimeOffset.UtcNow;

        EmitEvent(SessionEvent.StateChange(Id, SessionStatus.Completed, MapStatusToSessionStatus(previousStatus)));
    }

    /// <summary>
    /// Fails the session with an error.
    /// </summary>
    public virtual void Fail(string errorMessage)
    {
        if (Status != ContainerSessionStatus.Active &&
            Status != ContainerSessionStatus.Paused &&
            Status != ContainerSessionStatus.Created)
            throw new InvalidOperationException($"Cannot fail session in status {Status}");

        var previousStatus = Status;
        TransitionTo(ContainerSessionStatus.Ended);
        TerminalReason = SessionTerminalReason.Failed;
        ErrorMessage = errorMessage;
        CompletedAt = DateTimeOffset.UtcNow;

        EmitEvent(SessionEvent.Error(Id, errorMessage));
        EmitEvent(SessionEvent.StateChange(Id, SessionStatus.Failed, MapStatusToSessionStatus(previousStatus)));
    }

    /// <summary>
    /// Cancels the session.
    /// </summary>
    public virtual void Cancel()
    {
        if (Status == ContainerSessionStatus.Ended || Status == ContainerSessionStatus.Expired)
            throw new InvalidOperationException($"Cannot cancel session in status {Status}");

        var previousStatus = Status;
        TransitionTo(ContainerSessionStatus.Ended);
        TerminalReason = SessionTerminalReason.Cancelled;
        CompletedAt = DateTimeOffset.UtcNow;

        EmitEvent(SessionEvent.StateChange(Id, SessionStatus.Cancelled, MapStatusToSessionStatus(previousStatus)));
    }

    /// <summary>
    /// Marks the session as expired.
    /// </summary>
    public virtual void Expire()
    {
        if (Status == ContainerSessionStatus.Ended || Status == ContainerSessionStatus.Expired)
            throw new InvalidOperationException($"Cannot expire session in status {Status}");

        TransitionTo(ContainerSessionStatus.Expired);
        CompletedAt = DateTimeOffset.UtcNow;
    }

    // ===== Command Methods =====

    /// <summary>
    /// Submits a command for execution.
    /// </summary>
    public virtual SessionCommand SubmitCommand(string input)
    {
        if (Status != ContainerSessionStatus.Active)
            throw new InvalidOperationException($"Cannot execute commands in session status {Status}");

        var command = SessionCommand.Parse(input);
        _commandHistory.Add(command);

        EmitEvent(SessionEvent.CommandSubmitted(Id, command));
        return command;
    }

    /// <summary>
    /// Records a command result.
    /// </summary>
    public virtual void RecordCommandResult(SessionCommand command, bool success, string? output = null, string? error = null, int? exitCode = null)
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

    // ===== Authority Methods =====

    /// <summary>
    /// Transfers control to a new authority.
    /// </summary>
    public virtual void TransferControl(Authority newAuthority)
    {
        var oldAuthority = Authority;
        Authority = newAuthority ?? throw new ArgumentNullException(nameof(newAuthority));

        EmitEvent(SessionEvent.Info(Id, $"Control transferred from {oldAuthority} to {newAuthority}"));
    }

    // ===== Block Registry Methods =====

    /// <summary>
    /// Initializes the block registry with available blocks.
    /// </summary>
    public virtual void InitializeBlockRegistry(IEnumerable<string> blockIds)
    {
        BlockRegistry = SessionBlockRegistry.From(blockIds);
        EmitEvent(SessionEvent.Info(Id, $"Block registry initialized with {BlockRegistry.Count} blocks"));
    }

    // ===== Event Methods =====

    /// <summary>
    /// Emits an event and records it in history.
    /// </summary>
    protected void EmitEvent(SessionEvent evt)
    {
        _eventHistory.Add(evt);
        OnEvent?.Invoke(this, evt);
    }

    // ===== Status Mapping Helpers =====

    /// <summary>
    /// Maps ContainerSessionStatus to SessionStatus for event compatibility.
    /// </summary>
    protected static SessionStatus MapStatusToSessionStatus(ContainerSessionStatus status)
    {
        return status switch
        {
            ContainerSessionStatus.Created => SessionStatus.Created,
            ContainerSessionStatus.Active => SessionStatus.Running,
            ContainerSessionStatus.Paused => SessionStatus.Paused,
            ContainerSessionStatus.Ended => SessionStatus.Completed, // May be overridden by TerminalReason
            ContainerSessionStatus.Expired => SessionStatus.Stopped,
            _ => SessionStatus.Created
        };
    }

    /// <summary>
    /// Gets the effective SessionStatus (accounts for TerminalReason).
    /// </summary>
    public SessionStatus GetSessionStatus()
    {
        if (Status == ContainerSessionStatus.Ended)
        {
            return TerminalReason switch
            {
                SessionTerminalReason.Completed => SessionStatus.Completed,
                SessionTerminalReason.Failed => SessionStatus.Failed,
                SessionTerminalReason.Cancelled => SessionStatus.Cancelled,
                SessionTerminalReason.Stopped => SessionStatus.Stopped,
                _ => SessionStatus.Completed
            };
        }

        // When session is Active, distinguish between Running (workflow executing)
        // and Idle (started but no workflow running)
        if (Status == ContainerSessionStatus.Active)
        {
            var activeWorkflow = GetVariable<string>("_activeWorkflow", "");
            if (string.IsNullOrEmpty(activeWorkflow))
            {
                return SessionStatus.Idle;
            }
            return SessionStatus.Running;
        }

        return MapStatusToSessionStatus(Status);
    }

    // ===== Entry Point Methods =====

    /// <summary>
    /// Registers an entry point mapping.
    /// </summary>
    /// <param name="name">The entry point name (e.g., "start", "custom").</param>
    /// <param name="workflowId">The workflow ID to invoke.</param>
    public virtual void RegisterEntryPoint(string name, string workflowId)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Entry point name cannot be empty", nameof(name));
        if (string.IsNullOrWhiteSpace(workflowId))
            throw new ArgumentException("Workflow ID cannot be empty", nameof(workflowId));

        EntryPoints[name] = workflowId;
        UpdatedAt = DateTimeOffset.UtcNow;
        EmitEvent(SessionEvent.Info(Id, $"Entry point registered: {name} -> {workflowId}"));
    }

    /// <summary>
    /// Gets the workflow ID for an entry point.
    /// </summary>
    /// <param name="name">The entry point name.</param>
    /// <returns>The workflow ID or null if not found.</returns>
    public virtual string? GetEntryPoint(string name)
    {
        return EntryPoints.TryGetValue(name, out var workflowId) ? workflowId : null;
    }

    /// <summary>
    /// Removes an entry point mapping.
    /// </summary>
    /// <param name="name">The entry point name.</param>
    /// <returns>True if the entry point was removed.</returns>
    public virtual bool RemoveEntryPoint(string name)
    {
        if (EntryPoints.Remove(name))
        {
            UpdatedAt = DateTimeOffset.UtcNow;
            EmitEvent(SessionEvent.Info(Id, $"Entry point removed: {name}"));
            return true;
        }
        return false;
    }

    // ===== Widget Methods =====

    /// <summary>
    /// Registers a monitor widget configuration.
    /// </summary>
    /// <param name="widget">The widget configuration.</param>
    public virtual void RegisterWidget(MonitorWidgetConfig widget)
    {
        ArgumentNullException.ThrowIfNull(widget);
        if (string.IsNullOrWhiteSpace(widget.Id))
            throw new ArgumentException("Widget ID cannot be empty");
        if (string.IsNullOrWhiteSpace(widget.Type))
            throw new ArgumentException("Widget type cannot be empty");

        // Remove existing widget with same ID
        MonitorWidgets.RemoveAll(w => w.Id == widget.Id);
        MonitorWidgets.Add(widget);
        UpdatedAt = DateTimeOffset.UtcNow;
        EmitEvent(SessionEvent.Info(Id, $"Widget registered: {widget.Id} ({widget.Type})"));
    }

    /// <summary>
    /// Removes a monitor widget.
    /// </summary>
    /// <param name="widgetId">The widget ID.</param>
    /// <returns>True if the widget was removed.</returns>
    public virtual bool RemoveWidget(string widgetId)
    {
        var removed = MonitorWidgets.RemoveAll(w => w.Id == widgetId);
        if (removed > 0)
        {
            UpdatedAt = DateTimeOffset.UtcNow;
            EmitEvent(SessionEvent.Info(Id, $"Widget removed: {widgetId}"));
            return true;
        }
        return false;
    }

    // ===== Utility Properties =====

    /// <summary>
    /// Whether the session is in a terminal state.
    /// </summary>
    public bool IsTerminal => Status == ContainerSessionStatus.Ended || Status == ContainerSessionStatus.Expired;

    /// <summary>
    /// Whether the session completed successfully.
    /// </summary>
    public bool IsCompleted => Status == ContainerSessionStatus.Ended && TerminalReason == SessionTerminalReason.Completed;

    /// <summary>
    /// Whether the session failed.
    /// </summary>
    public bool IsFailed => Status == ContainerSessionStatus.Ended && TerminalReason == SessionTerminalReason.Failed;

    /// <summary>
    /// Whether the session is currently running.
    /// </summary>
    public bool IsRunning => Status == ContainerSessionStatus.Active;

    /// <summary>
    /// Whether the session is paused.
    /// </summary>
    public bool IsPaused => Status == ContainerSessionStatus.Paused;

    // ===== Reconstitution Support =====

    /// <summary>
    /// Adds a command directly to history (for reconstitution from storage).
    /// </summary>
    protected void AddCommandToHistory(SessionCommand command)
    {
        _commandHistory.Add(command);
    }

    /// <summary>
    /// Adds an event directly to history (for reconstitution from storage).
    /// </summary>
    protected void AddEventToHistory(SessionEvent evt)
    {
        _eventHistory.Add(evt);
    }
}
