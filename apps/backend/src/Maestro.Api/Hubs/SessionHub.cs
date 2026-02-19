using Microsoft.AspNetCore.SignalR;
using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;

namespace Maestro.Api.Hubs;

/// <summary>
/// SignalR hub for real-time session events.
/// </summary>
public class SessionHub : Hub<ISessionClient>
{
    private readonly IProjectSessionServer _sessionServer;
    private readonly ILogger<SessionHub> _logger;

    // Track which sessions each connection is subscribed to
    private static readonly Dictionary<string, HashSet<string>> _connectionSessions = new();
    private static readonly object _lock = new();

    public SessionHub(
        IProjectSessionServer sessionServer,
        ILogger<SessionHub> logger)
    {
        _sessionServer = sessionServer;
        _logger = logger;
    }

    /// <summary>
    /// Join a session to receive events.
    /// </summary>
    public async Task JoinSession(string sessionId)
    {
        var session = await _sessionServer.GetAsync(SessionId.From(sessionId));
        if (session == null)
        {
            throw new HubException($"Session '{sessionId}' not found");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);

        lock (_lock)
        {
            if (!_connectionSessions.ContainsKey(Context.ConnectionId))
            {
                _connectionSessions[Context.ConnectionId] = new HashSet<string>();
            }
            _connectionSessions[Context.ConnectionId].Add(sessionId);
        }

        _logger.LogInformation("Connection {ConnectionId} joined session {SessionId}",
            Context.ConnectionId, sessionId);

        // Send current session state
        await Clients.Caller.OnStateChange(new StateChangeMessage
        {
            SessionId = sessionId,
            NewStatus = session.Status.ToString().ToLowerInvariant(),
            Timestamp = DateTime.UtcNow
        });

        // Send recent events (last 50)
        foreach (var evt in session.EventHistory.TakeLast(50))
        {
            await Clients.Caller.OnEvent(new SessionEventMessage
            {
                Id = evt.Id,
                Type = evt.Type.ToString().ToLowerInvariant(),
                Source = evt.Source,
                Message = evt.Message,
                Timestamp = evt.Timestamp,
                Sequence = evt.Sequence,
                Data = evt.Data.ToDictionary(k => k.Key, k => k.Value)
            });
        }
    }

    /// <summary>
    /// Leave a session (stop receiving events).
    /// </summary>
    public async Task LeaveSession(string sessionId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, sessionId);

        lock (_lock)
        {
            if (_connectionSessions.ContainsKey(Context.ConnectionId))
            {
                _connectionSessions[Context.ConnectionId].Remove(sessionId);
            }
        }

        _logger.LogInformation("Connection {ConnectionId} left session {SessionId}",
            Context.ConnectionId, sessionId);
    }

    /// <summary>
    /// Execute a command in the session.
    /// </summary>
    public async Task<CommandResultMessage> ExecuteCommand(string sessionId, string command)
    {
        try
        {
            var result = await _sessionServer.ExecuteCommandAsync(SessionId.From(sessionId), command);

            return new CommandResultMessage
            {
                CommandId = result.Command.Id,
                Success = result.Success,
                Output = result.Output,
                Error = result.Error,
                ExitCode = result.ExitCode
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing command in session {SessionId}", sessionId);
            throw new HubException(ex.Message);
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        lock (_lock)
        {
            if (_connectionSessions.TryGetValue(Context.ConnectionId, out var sessions))
            {
                _connectionSessions.Remove(Context.ConnectionId);
            }
        }

        _logger.LogInformation("Connection {ConnectionId} disconnected", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Broadcast an event to all clients subscribed to a session.
    /// Called by the session server when events occur.
    /// </summary>
    public static async Task BroadcastEvent(
        IHubContext<SessionHub, ISessionClient> hubContext,
        string sessionId,
        SessionEventMessage evt)
    {
        await hubContext.Clients.Group(sessionId).OnEvent(evt);
    }

    /// <summary>
    /// Broadcast a state change to all clients subscribed to a session.
    /// </summary>
    public static async Task BroadcastStateChange(
        IHubContext<SessionHub, ISessionClient> hubContext,
        string sessionId,
        StateChangeMessage state)
    {
        await hubContext.Clients.Group(sessionId).OnStateChange(state);
    }

    /// <summary>
    /// Broadcast command output to all clients subscribed to a session.
    /// </summary>
    public static async Task BroadcastCommandOutput(
        IHubContext<SessionHub, ISessionClient> hubContext,
        string sessionId,
        CommandOutputMessage output)
    {
        await hubContext.Clients.Group(sessionId).OnCommandOutput(output);
    }

    /// <summary>
    /// Broadcast an agent event to all clients subscribed to a session.
    /// </summary>
    public static async Task BroadcastAgentEvent(
        IHubContext<SessionHub, ISessionClient> hubContext,
        string sessionId,
        AgentEventMessage evt)
    {
        await hubContext.Clients.Group(sessionId).OnAgentEvent(evt);
    }
}

/// <summary>
/// Command result message for hub responses.
/// </summary>
public record CommandResultMessage
{
    public string CommandId { get; init; } = string.Empty;
    public bool Success { get; init; }
    public string? Output { get; init; }
    public string? Error { get; init; }
    public int? ExitCode { get; init; }
}
