namespace Maestro.Api.Hubs;

/// <summary>
/// Interface for session event client callbacks.
/// </summary>
public interface ISessionClient
{
    /// <summary>
    /// Receives a session event.
    /// </summary>
    Task OnEvent(SessionEventMessage evt);

    /// <summary>
    /// Receives a command output (partial or complete).
    /// </summary>
    Task OnCommandOutput(CommandOutputMessage output);

    /// <summary>
    /// Receives session state change notification.
    /// </summary>
    Task OnStateChange(StateChangeMessage state);

    /// <summary>
    /// Receives agent event notification.
    /// </summary>
    Task OnAgentEvent(AgentEventMessage evt);
}

/// <summary>
/// Session event message.
/// </summary>
public record SessionEventMessage
{
    public string Id { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Source { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public DateTime Timestamp { get; init; }
    public long Sequence { get; init; }
    public Dictionary<string, object> Data { get; init; } = new();
}

/// <summary>
/// Command output message.
/// </summary>
public record CommandOutputMessage
{
    public string CommandId { get; init; } = string.Empty;
    public string Output { get; init; } = string.Empty;
    public bool IsPartial { get; init; }
    public bool IsError { get; init; }
}

/// <summary>
/// State change message.
/// </summary>
public record StateChangeMessage
{
    public string SessionId { get; init; } = string.Empty;
    public string NewStatus { get; init; } = string.Empty;
    public string? PreviousStatus { get; init; }
    public DateTime Timestamp { get; init; }
}

/// <summary>
/// Agent event message.
/// </summary>
public record AgentEventMessage
{
    public string ExecutionId { get; init; } = string.Empty;
    public string AgentId { get; init; } = string.Empty;
    public string EventType { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public DateTime Timestamp { get; init; }
    public Dictionary<string, object>? Data { get; init; }
}
