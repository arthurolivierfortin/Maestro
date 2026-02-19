using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Interface for execution monitoring.
/// Publishes real-time events during workflow execution.
/// </summary>
public interface IExecutionMonitor
{
    Task PublishExecutionStartedAsync(ExecutionId executionId, CancellationToken cancellationToken = default);
    Task PublishNodeStartedAsync(NodeId nodeId, CancellationToken cancellationToken = default);
    Task PublishNodeCompletedAsync(NodeId nodeId, CancellationToken cancellationToken = default);
    Task PublishNodeFailedAsync(NodeId nodeId, string error, CancellationToken cancellationToken = default);
    Task PublishExecutionCompletedAsync(ExecutionId executionId, CancellationToken cancellationToken = default);
    Task PublishExecutionFailedAsync(ExecutionId executionId, string error, CancellationToken cancellationToken = default);
    Task PublishLogAddedAsync(ExecutionId executionId, string logLine, CancellationToken cancellationToken = default);
    Task PublishTerminalOutputAsync(string output, CancellationToken cancellationToken = default);
}
