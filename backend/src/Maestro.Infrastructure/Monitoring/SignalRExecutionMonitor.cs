using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;

namespace Maestro.Infrastructure.Monitoring;

/// <summary>
/// Lightweight console-based execution monitor used as a scaffold.
/// Later this will be replaced by a SignalR-backed implementation.
/// </summary>
public class SignalRExecutionMonitor : IExecutionMonitor
{
    public Task PublishNodeStartedAsync(NodeId nodeId, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[Monitor] NodeStarted: {nodeId}");
        return Task.CompletedTask;
    }

    public Task PublishNodeCompletedAsync(NodeId nodeId, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[Monitor] NodeCompleted: {nodeId}");
        return Task.CompletedTask;
    }

    public Task PublishTerminalOutputAsync(string output, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"[Monitor] Terminal: {output}");
        return Task.CompletedTask;
    }
}
