using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Maestro.Api.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace Maestro.Infrastructure.Monitoring;

/// <summary>
/// SignalR-backed execution monitor that publishes execution events to connected clients.
/// This implementation requires `ExecutionHub` to be mapped in the API.
/// </summary>
public class SignalRExecutionMonitor : IExecutionMonitor
{
    private readonly IHubContext<ExecutionHub, IExecutionClient> _hub;

    public SignalRExecutionMonitor(IHubContext<ExecutionHub, IExecutionClient> hub)
    {
        _hub = hub;
    }

    public Task PublishExecutionStartedAsync(ExecutionId executionId, CancellationToken cancellationToken = default)
        => _hub.Clients.All.ExecutionStarted(executionId.Value);

    public Task PublishNodeStartedAsync(NodeId nodeId, CancellationToken cancellationToken = default)
        => _hub.Clients.All.BlockStarted("unknown", nodeId.Value);

    public Task PublishNodeCompletedAsync(NodeId nodeId, CancellationToken cancellationToken = default)
        => _hub.Clients.All.BlockCompleted("unknown", nodeId.Value);

    public Task PublishNodeFailedAsync(NodeId nodeId, string error, CancellationToken cancellationToken = default)
        => _hub.Clients.All.BlockFailed("unknown", nodeId.Value, error);

    public Task PublishExecutionCompletedAsync(ExecutionId executionId, CancellationToken cancellationToken = default)
        => _hub.Clients.All.ExecutionCompleted(executionId.Value);

    public Task PublishExecutionFailedAsync(ExecutionId executionId, string error, CancellationToken cancellationToken = default)
        => _hub.Clients.All.ExecutionFailed(executionId.Value, error);

    public Task PublishLogAddedAsync(ExecutionId executionId, string logLine, CancellationToken cancellationToken = default)
        => _hub.Clients.All.LogAdded(executionId.Value, logLine);

    public Task PublishTerminalOutputAsync(string output, CancellationToken cancellationToken = default)
        => _hub.Clients.All.LogAdded("unknown", output);
}
