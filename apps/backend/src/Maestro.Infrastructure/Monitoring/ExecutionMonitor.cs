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

    public Task PublishExecutionStartedAsync(Maestro.Domain.ValueObjects.ExecutionId executionId, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"Execution started: {executionId}");
        return Task.CompletedTask;
    }

    public Task PublishNodeFailedAsync(Maestro.Domain.ValueObjects.NodeId nodeId, string error, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"Node failed: {nodeId} - {error}");
        return Task.CompletedTask;
    }

    public Task PublishExecutionCompletedAsync(Maestro.Domain.ValueObjects.ExecutionId executionId, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"Execution completed: {executionId}");
        return Task.CompletedTask;
    }

    public Task PublishExecutionFailedAsync(Maestro.Domain.ValueObjects.ExecutionId executionId, string error, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"Execution failed: {executionId} - {error}");
        return Task.CompletedTask;
    }

    public Task PublishLogAddedAsync(Maestro.Domain.ValueObjects.ExecutionId executionId, string logLine, CancellationToken cancellationToken = default)
    {
        Console.WriteLine($"Log [{executionId}]: {logLine}");
        return Task.CompletedTask;
    }
}
