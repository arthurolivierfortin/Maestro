using Maestro.Domain.Enums;

namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Represents an event emitted by a session for streaming to clients.
/// </summary>
public sealed class SessionEvent
{
    /// <summary>
    /// Unique identifier for this event.
    /// </summary>
    public string Id { get; }

    /// <summary>
    /// Type of event.
    /// </summary>
    public SessionEventType Type { get; }

    /// <summary>
    /// Source of the event (session, command-id, agent-id, etc.).
    /// </summary>
    public string Source { get; }

    /// <summary>
    /// Human-readable message describing the event.
    /// </summary>
    public string Message { get; }

    /// <summary>
    /// Additional data associated with the event.
    /// </summary>
    public IReadOnlyDictionary<string, object> Data { get; }

    /// <summary>
    /// When the event occurred.
    /// </summary>
    public DateTime Timestamp { get; }

    /// <summary>
    /// Sequence number for ordering events.
    /// </summary>
    public long Sequence { get; }

    private static long _sequenceCounter = 0;

    private SessionEvent(SessionEventType type, string source, string message, IDictionary<string, object>? data = null)
    {
        Id = Guid.NewGuid().ToString("N")[..16];
        Type = type;
        Source = source ?? throw new ArgumentNullException(nameof(source));
        Message = message ?? throw new ArgumentNullException(nameof(message));
        Data = data != null ? new Dictionary<string, object>(data) : new Dictionary<string, object>();
        Timestamp = DateTime.UtcNow;
        Sequence = Interlocked.Increment(ref _sequenceCounter);
    }

    /// <summary>
    /// Creates a state change event.
    /// </summary>
    public static SessionEvent StateChange(string sessionId, SessionStatus newStatus, SessionStatus? previousStatus = null) =>
        new(SessionEventType.StateChange, sessionId, $"Session state changed to {newStatus}",
            new Dictionary<string, object>
            {
                ["newStatus"] = newStatus.ToString(),
                ["previousStatus"] = previousStatus?.ToString() ?? ""
            });

    /// <summary>
    /// Creates a command submitted event.
    /// </summary>
    public static SessionEvent CommandSubmitted(string sessionId, SessionCommand command) =>
        new(SessionEventType.CommandSubmitted, command.Id, $"Command submitted: {command.Command}",
            new Dictionary<string, object>
            {
                ["commandId"] = command.Id,
                ["commandType"] = command.Type.ToString(),
                ["command"] = command.Command
            });

    /// <summary>
    /// Creates a command started event.
    /// </summary>
    public static SessionEvent CommandStarted(string commandId, string command) =>
        new(SessionEventType.CommandStarted, commandId, $"Executing: {command}",
            new Dictionary<string, object>
            {
                ["commandId"] = commandId,
                ["command"] = command
            });

    /// <summary>
    /// Creates a command output event.
    /// </summary>
    public static SessionEvent CommandOutput(string commandId, string output, bool isPartial = false) =>
        new(SessionEventType.CommandOutput, commandId, output,
            new Dictionary<string, object>
            {
                ["commandId"] = commandId,
                ["output"] = output,
                ["isPartial"] = isPartial
            });

    /// <summary>
    /// Creates a command completed event.
    /// </summary>
    public static SessionEvent CommandCompleted(string commandId, string? output = null, int? exitCode = null) =>
        new(SessionEventType.CommandCompleted, commandId, "Command completed",
            new Dictionary<string, object>
            {
                ["commandId"] = commandId,
                ["output"] = output ?? "",
                ["exitCode"] = exitCode ?? 0
            });

    /// <summary>
    /// Creates a command failed event.
    /// </summary>
    public static SessionEvent CommandFailed(string commandId, string error, int? exitCode = null) =>
        new(SessionEventType.CommandFailed, commandId, $"Command failed: {error}",
            new Dictionary<string, object>
            {
                ["commandId"] = commandId,
                ["error"] = error,
                ["exitCode"] = exitCode ?? -1
            });

    /// <summary>
    /// Creates an agent started event.
    /// </summary>
    public static SessionEvent AgentStarted(string executionId, string agentId, string task) =>
        new(SessionEventType.AgentStarted, executionId, $"Agent {agentId} started: {task}",
            new Dictionary<string, object>
            {
                ["executionId"] = executionId,
                ["agentId"] = agentId,
                ["task"] = task
            });

    /// <summary>
    /// Creates an agent event (action, output, etc.).
    /// </summary>
    public static SessionEvent AgentAction(string executionId, string action, string? details = null) =>
        new(SessionEventType.AgentEvent, executionId, details ?? action,
            new Dictionary<string, object>
            {
                ["executionId"] = executionId,
                ["action"] = action,
                ["details"] = details ?? ""
            });

    /// <summary>
    /// Creates an agent completed event.
    /// </summary>
    public static SessionEvent AgentCompleted(string executionId, string agentId, object? result = null) =>
        new(SessionEventType.AgentCompleted, executionId, $"Agent {agentId} completed",
            new Dictionary<string, object>
            {
                ["executionId"] = executionId,
                ["agentId"] = agentId,
                ["result"] = result ?? new { }
            });

    /// <summary>
    /// Creates an agent failed event.
    /// </summary>
    public static SessionEvent AgentFailed(string executionId, string agentId, string error) =>
        new(SessionEventType.AgentFailed, executionId, $"Agent {agentId} failed: {error}",
            new Dictionary<string, object>
            {
                ["executionId"] = executionId,
                ["agentId"] = agentId,
                ["error"] = error
            });

    /// <summary>
    /// Creates a file changed event.
    /// </summary>
    public static SessionEvent FileChanged(string sessionId, string path, string changeType) =>
        new(SessionEventType.FileChanged, sessionId, $"File {changeType}: {path}",
            new Dictionary<string, object>
            {
                ["path"] = path,
                ["changeType"] = changeType
            });

    /// <summary>
    /// Creates an error event.
    /// </summary>
    public static SessionEvent Error(string source, string error) =>
        new(SessionEventType.Error, source, error,
            new Dictionary<string, object> { ["error"] = error });

    /// <summary>
    /// Creates an info event.
    /// </summary>
    public static SessionEvent Info(string source, string message) =>
        new(SessionEventType.Info, source, message);
}
