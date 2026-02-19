using Microsoft.AspNetCore.SignalR;
using Maestro.Application.Interfaces;

namespace Maestro.Api.Hubs;

/// <summary>
/// SignalR hub for real-time workspace visualization events.
/// Provides workspace-level events for the Vivado-inspired canvas view.
/// </summary>
public class WorkspaceHub : Hub<IWorkspaceClient>
{
    private readonly IWorkspaceService _workspaceService;
    private readonly ILogger<WorkspaceHub> _logger;

    // Track which workspaces each connection is subscribed to
    private static readonly Dictionary<string, HashSet<string>> _connectionWorkspaces = new();
    private static readonly object _lock = new();

    public WorkspaceHub(
        IWorkspaceService workspaceService,
        ILogger<WorkspaceHub> logger)
    {
        _workspaceService = workspaceService;
        _logger = logger;
    }

    /// <summary>
    /// Join a workspace to receive real-time events.
    /// </summary>
    public async Task JoinWorkspace(string workspaceId)
    {
        var workspace = await _workspaceService.GetWorkspaceAsync(workspaceId);
        if (workspace == null)
        {
            throw new HubException($"Workspace '{workspaceId}' not found");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, workspaceId);

        lock (_lock)
        {
            if (!_connectionWorkspaces.ContainsKey(Context.ConnectionId))
            {
                _connectionWorkspaces[Context.ConnectionId] = new HashSet<string>();
            }
            _connectionWorkspaces[Context.ConnectionId].Add(workspaceId);
        }

        _logger.LogInformation("Connection {ConnectionId} joined workspace {WorkspaceId}",
            Context.ConnectionId, workspaceId);

        // Send initial workspace state
        await Clients.Caller.OnWorkspaceJoined(new WorkspaceJoinedMessage
        {
            WorkspaceId = workspaceId,
            WorkspaceName = workspace.Name,
            ActiveSessionCount = workspace.SessionIds.Count,
            Timestamp = DateTime.UtcNow
        });

        // Send initial metrics
        await Clients.Caller.OnMetricsUpdate(new WorkspaceMetricsMessage
        {
            WorkspaceId = workspaceId,
            ActiveSessionCount = workspace.SessionIds.Count,
            TotalBlockExecutions = 0,
            ErrorCount = 0,
            AverageLatencyMs = 0,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Leave a workspace (stop receiving events).
    /// </summary>
    public async Task LeaveWorkspace(string workspaceId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, workspaceId);

        lock (_lock)
        {
            if (_connectionWorkspaces.ContainsKey(Context.ConnectionId))
            {
                _connectionWorkspaces[Context.ConnectionId].Remove(workspaceId);
            }
        }

        _logger.LogInformation("Connection {ConnectionId} left workspace {WorkspaceId}",
            Context.ConnectionId, workspaceId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        lock (_lock)
        {
            if (_connectionWorkspaces.TryGetValue(Context.ConnectionId, out var workspaces))
            {
                _connectionWorkspaces.Remove(Context.ConnectionId);
            }
        }

        _logger.LogInformation("Connection {ConnectionId} disconnected", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    // ============= Static Broadcast Methods =============
    // Called by other services to broadcast events to workspace subscribers

    /// <summary>
    /// Broadcast a session state change to all workspace subscribers.
    /// </summary>
    public static async Task BroadcastSessionStateChange(
        IHubContext<WorkspaceHub, IWorkspaceClient> hubContext,
        WorkspaceSessionStateMessage message)
    {
        await hubContext.Clients.Group(message.WorkspaceId).OnSessionStateChange(message);
    }

    /// <summary>
    /// Broadcast a session event to all workspace subscribers.
    /// </summary>
    public static async Task BroadcastSessionEvent(
        IHubContext<WorkspaceHub, IWorkspaceClient> hubContext,
        WorkspaceSessionEventMessage message)
    {
        await hubContext.Clients.Group(message.WorkspaceId).OnSessionEvent(message);
    }

    /// <summary>
    /// Broadcast an agent event to all workspace subscribers.
    /// </summary>
    public static async Task BroadcastAgentEvent(
        IHubContext<WorkspaceHub, IWorkspaceClient> hubContext,
        WorkspaceAgentEventMessage message)
    {
        await hubContext.Clients.Group(message.WorkspaceId).OnAgentEvent(message);
    }

    /// <summary>
    /// Broadcast metrics update to all workspace subscribers.
    /// </summary>
    public static async Task BroadcastMetricsUpdate(
        IHubContext<WorkspaceHub, IWorkspaceClient> hubContext,
        WorkspaceMetricsMessage message)
    {
        await hubContext.Clients.Group(message.WorkspaceId).OnMetricsUpdate(message);
    }

    /// <summary>
    /// Broadcast a promotion event to all workspace subscribers.
    /// </summary>
    public static async Task BroadcastPromotionEvent(
        IHubContext<WorkspaceHub, IWorkspaceClient> hubContext,
        WorkspacePromotionMessage message)
    {
        // Broadcast to both source and target workspaces
        await hubContext.Clients.Group(message.SourceWorkspaceId).OnPromotionEvent(message);
        if (message.SourceWorkspaceId != message.TargetWorkspaceId)
        {
            await hubContext.Clients.Group(message.TargetWorkspaceId).OnPromotionEvent(message);
        }
    }

    /// <summary>
    /// Broadcast a console log entry to all workspace subscribers.
    /// </summary>
    public static async Task BroadcastConsoleLog(
        IHubContext<WorkspaceHub, IWorkspaceClient> hubContext,
        WorkspaceConsoleLogMessage message)
    {
        await hubContext.Clients.Group(message.WorkspaceId).OnConsoleLog(message);
    }
}
