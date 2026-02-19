namespace Maestro.Api.Hubs;

/// <summary>
/// Interface for workspace event client callbacks.
/// Used by WorkspaceHub for real-time workspace visualization.
/// </summary>
public interface IWorkspaceClient
{
    /// <summary>
    /// Called when client successfully joins a workspace.
    /// </summary>
    Task OnWorkspaceJoined(WorkspaceJoinedMessage message);

    /// <summary>
    /// Receives session state changes within the workspace.
    /// </summary>
    Task OnSessionStateChange(WorkspaceSessionStateMessage message);

    /// <summary>
    /// Receives session events (logs, block completions, etc.).
    /// </summary>
    Task OnSessionEvent(WorkspaceSessionEventMessage message);

    /// <summary>
    /// Receives agent activity events.
    /// </summary>
    Task OnAgentEvent(WorkspaceAgentEventMessage message);

    /// <summary>
    /// Receives workspace-level metrics updates.
    /// </summary>
    Task OnMetricsUpdate(WorkspaceMetricsMessage message);

    /// <summary>
    /// Receives promotion events between workspaces.
    /// </summary>
    Task OnPromotionEvent(WorkspacePromotionMessage message);

    /// <summary>
    /// Receives console log entries.
    /// </summary>
    Task OnConsoleLog(WorkspaceConsoleLogMessage message);
}

/// <summary>
/// Message sent when client joins a workspace.
/// </summary>
public record WorkspaceJoinedMessage
{
    public string WorkspaceId { get; init; } = string.Empty;
    public string WorkspaceName { get; init; } = string.Empty;
    public int ActiveSessionCount { get; init; }
    public DateTime Timestamp { get; init; }
}

/// <summary>
/// Session state change within a workspace.
/// </summary>
public record WorkspaceSessionStateMessage
{
    public string WorkspaceId { get; init; } = string.Empty;
    public string SessionId { get; init; } = string.Empty;
    public string SessionType { get; init; } = string.Empty;
    public string NewStatus { get; init; } = string.Empty;
    public string? PreviousStatus { get; init; }
    public int BlocksCompleted { get; init; }
    public int BlocksTotal { get; init; }
    public string? CurrentBlockName { get; init; }
    public DateTime Timestamp { get; init; }
}

/// <summary>
/// Session event within a workspace (logs, block completions).
/// </summary>
public record WorkspaceSessionEventMessage
{
    public string WorkspaceId { get; init; } = string.Empty;
    public string SessionId { get; init; } = string.Empty;
    public string EventType { get; init; } = string.Empty;
    public string Source { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string Level { get; init; } = "info";
    public DateTime Timestamp { get; init; }
    public Dictionary<string, object>? Data { get; init; }
}

/// <summary>
/// Agent activity event within a workspace.
/// </summary>
public record WorkspaceAgentEventMessage
{
    public string WorkspaceId { get; init; } = string.Empty;
    public string SessionId { get; init; } = string.Empty;
    public string AgentId { get; init; } = string.Empty;
    public string AgentName { get; init; } = string.Empty;
    public string EventType { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public DateTime Timestamp { get; init; }
    public Dictionary<string, object>? Data { get; init; }
}

/// <summary>
/// Workspace metrics update.
/// </summary>
public record WorkspaceMetricsMessage
{
    public string WorkspaceId { get; init; } = string.Empty;
    public int ActiveSessionCount { get; init; }
    public int TotalBlockExecutions { get; init; }
    public int ErrorCount { get; init; }
    public double AverageLatencyMs { get; init; }
    public DateTime Timestamp { get; init; }
}

/// <summary>
/// Promotion event between workspaces.
/// </summary>
public record WorkspacePromotionMessage
{
    public string SourceWorkspaceId { get; init; } = string.Empty;
    public string TargetWorkspaceId { get; init; } = string.Empty;
    public string PromotionType { get; init; } = string.Empty;
    public string? BlockId { get; init; }
    public string? BlockName { get; init; }
    public string Message { get; init; } = string.Empty;
    public DateTime Timestamp { get; init; }
}

/// <summary>
/// Console log entry for the workspace console panel.
/// </summary>
public record WorkspaceConsoleLogMessage
{
    public string Id { get; init; } = string.Empty;
    public string WorkspaceId { get; init; } = string.Empty;
    public string SessionId { get; init; } = string.Empty;
    public string SessionName { get; init; } = string.Empty;
    public string? BlockId { get; init; }
    public string? BlockName { get; init; }
    public string Level { get; init; } = "info";
    public string Message { get; init; } = string.Empty;
    public DateTime Timestamp { get; init; }
    public Dictionary<string, object>? Data { get; init; }
}
