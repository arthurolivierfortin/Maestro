using Maestro.Domain.ValueObjects;
using Maestro.Application.Interfaces;

namespace Maestro.Infrastructure.Monitoring;

/// <summary>
/// Placeholder execution monitor implementation.
/// In production, this would publish to SignalR hubs.
/// </summary>
public class ExecutionMonitor : IExecutionMonitor
{
    public Task PublishNodeStartedAsync(NodeId nodeId, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"Node started: {nodeId}");
        return Task.CompletedTask;
    }

    public Task PublishNodeCompletedAsync(NodeId nodeId, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"Node completed: {nodeId}");
        return Task.CompletedTask;
    }

    public Task PublishTerminalOutputAsync(string output, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"Terminal: {output}");
        return Task.CompletedTask;
    }
}
