using Microsoft.AspNetCore.SignalR;

namespace Maestro.Api.Hubs;

/// <summary>
/// SignalR hub for bidirectional terminal I/O streaming.
/// Phase 8 implementation - placeholder for full PTY integration.
/// </summary>
public class TerminalHub : Hub
{
    private readonly ILogger<TerminalHub> _logger;

    public TerminalHub(ILogger<TerminalHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Connect to a project's terminal session.
    /// </summary>
    public async Task ConnectToProject(string projectId)
    {
        _logger.LogInformation("Terminal connection requested for project {ProjectId}", projectId);

        // Add to group for this project
        await Groups.AddToGroupAsync(Context.ConnectionId, $"terminal-{projectId}");

        // Send welcome message
        await Clients.Caller.SendAsync("Output", $"\r\nConnected to project: {projectId}\r\n");
        await Clients.Caller.SendAsync("Output", "$ ");

        _logger.LogInformation("Terminal connected for project {ProjectId}, connection {ConnectionId}",
            projectId, Context.ConnectionId);
    }

    /// <summary>
    /// Send input to the terminal.
    /// </summary>
    public async Task SendInput(string projectId, string input)
    {
        _logger.LogDebug("Terminal input received for project {ProjectId}: {Input}",
            projectId, input.Replace("\r", "\\r").Replace("\n", "\\n"));

        // TODO: Send input to actual PTY/shell process
        // For now, just echo back
        await Clients.Caller.SendAsync("Output", input);

        // Handle special characters
        if (input == "\r")
        {
            // Enter key - execute command
            await Clients.Caller.SendAsync("Output", "\r\nCommand execution not yet implemented.\r\n$ ");
        }
    }

    /// <summary>
    /// Resize the terminal.
    /// </summary>
    public Task Resize(string projectId, int rows, int cols)
    {
        _logger.LogDebug("Terminal resize requested for project {ProjectId}: {Rows}x{Cols}",
            projectId, rows, cols);

        // TODO: Resize PTY

        return Task.CompletedTask;
    }

    /// <summary>
    /// Disconnect from terminal.
    /// </summary>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Terminal connection {ConnectionId} disconnected", Context.ConnectionId);

        if (exception != null)
        {
            _logger.LogError(exception, "Terminal connection error");
        }

        await base.OnDisconnectedAsync(exception);
    }
}
