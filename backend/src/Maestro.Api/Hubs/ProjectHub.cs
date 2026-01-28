using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace Maestro.Api.Hubs;

/// <summary>
/// SignalR hub for real-time project and container status updates.
/// </summary>
public class ProjectHub : Hub
{
    private readonly IProjectContainerService _containerService;
    private readonly ILogger<ProjectHub> _logger;

    public ProjectHub(
        IProjectContainerService containerService,
        ILogger<ProjectHub> logger)
    {
        _containerService = containerService;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client connected to ProjectHub: {ConnectionId}", Context.ConnectionId);

        // Send current states to newly connected client
        var states = await _containerService.GetAllStatesAsync();
        foreach (var state in states)
        {
            await Clients.Caller.SendAsync("ContainerStateChanged", ContainerStateDto.FromDomain(state));
        }

        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client disconnected from ProjectHub: {ConnectionId}", Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Subscribes to updates for a specific project.
    /// </summary>
    public async Task SubscribeToProject(string projectId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"project-{projectId}");
        _logger.LogDebug("Client {ConnectionId} subscribed to project {ProjectId}", Context.ConnectionId, projectId);
    }

    /// <summary>
    /// Unsubscribes from updates for a specific project.
    /// </summary>
    public async Task UnsubscribeFromProject(string projectId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"project-{projectId}");
        _logger.LogDebug("Client {ConnectionId} unsubscribed from project {ProjectId}", Context.ConnectionId, projectId);
    }
}

/// <summary>
/// Service for publishing project state changes to SignalR clients.
/// </summary>
public class SignalRProjectStatePublisher : IDisposable
{
    private readonly IHubContext<ProjectHub> _hubContext;
    private readonly IProjectContainerService _containerService;
    private readonly ILogger<SignalRProjectStatePublisher> _logger;

    public SignalRProjectStatePublisher(
        IHubContext<ProjectHub> hubContext,
        IProjectContainerService containerService,
        ILogger<SignalRProjectStatePublisher> logger)
    {
        _hubContext = hubContext;
        _containerService = containerService;
        _logger = logger;

        // Subscribe to state changes
        _containerService.StateChanged += OnStateChanged;
    }

    private async void OnStateChanged(object? sender, ContainerStateChangedEventArgs e)
    {
        try
        {
            var dto = ContainerStateDto.FromDomain(e.State);

            // Broadcast to all clients
            await _hubContext.Clients.All.SendAsync("ContainerStateChanged", dto);

            // Also send to project-specific group
            await _hubContext.Clients.Group($"project-{e.State.ProjectId}")
                .SendAsync("ContainerStateChanged", dto);

            _logger.LogDebug("Published state change for project {ProjectId}: {Status}",
                e.State.ProjectId, e.State.Status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish container state change");
        }
    }

    public void Dispose()
    {
        _containerService.StateChanged -= OnStateChanged;
    }
}
