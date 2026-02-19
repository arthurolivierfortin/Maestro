using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;

namespace Maestro.Infrastructure.Containers;

/// <summary>
/// Null container runtime for projects that don't need isolation.
/// All operations are no-ops or throw NotSupportedException.
/// </summary>
public class NullContainerRuntime : IContainerRuntime
{
    public string RuntimeType => "none";

    public Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default)
    {
        return Task.FromResult(true);
    }

    public Task<string> CreateContainerAsync(
        RuntimeConfiguration config,
        CancellationToken cancellationToken = default)
    {
        throw new NotSupportedException("Container operations not supported with 'none' runtime");
    }

    public Task StartContainerAsync(
        string containerId,
        CancellationToken cancellationToken = default)
    {
        throw new NotSupportedException("Container operations not supported with 'none' runtime");
    }

    public Task StopContainerAsync(
        string containerId,
        int timeoutSeconds = 10,
        CancellationToken cancellationToken = default)
    {
        throw new NotSupportedException("Container operations not supported with 'none' runtime");
    }

    public Task RemoveContainerAsync(
        string containerId,
        bool force = false,
        CancellationToken cancellationToken = default)
    {
        throw new NotSupportedException("Container operations not supported with 'none' runtime");
    }

    public Task<ContainerExecResult> ExecuteAsync(
        string containerId,
        ContainerExecRequest command,
        CancellationToken cancellationToken = default)
    {
        throw new NotSupportedException("Container operations not supported with 'none' runtime");
    }

    public Task<ContainerStatus> GetStatusAsync(
        string containerId,
        CancellationToken cancellationToken = default)
    {
        throw new NotSupportedException("Container operations not supported with 'none' runtime");
    }

    public Task<string> GetLogsAsync(
        string containerId,
        int? tail = null,
        CancellationToken cancellationToken = default)
    {
        throw new NotSupportedException("Container operations not supported with 'none' runtime");
    }

    public Task CopyToContainerAsync(
        string containerId,
        string sourcePath,
        string destinationPath,
        CancellationToken cancellationToken = default)
    {
        throw new NotSupportedException("Container operations not supported with 'none' runtime");
    }

    public Task CopyFromContainerAsync(
        string containerId,
        string sourcePath,
        string destinationPath,
        CancellationToken cancellationToken = default)
    {
        throw new NotSupportedException("Container operations not supported with 'none' runtime");
    }

    public Task<ContainerResourceStats?> GetResourceStatsAsync(
        string containerId,
        CancellationToken cancellationToken = default)
    {
        // No container, no stats
        return Task.FromResult<ContainerResourceStats?>(null);
    }
}
