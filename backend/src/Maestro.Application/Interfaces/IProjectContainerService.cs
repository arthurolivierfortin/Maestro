using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Service for managing project container lifecycle.
/// Tracks container state and provides start/stop operations.
/// </summary>
public interface IProjectContainerService
{
    /// <summary>
    /// Gets the current container state for a project.
    /// </summary>
    Task<ProjectContainerState> GetStateAsync(ProjectId projectId, CancellationToken ct = default);

    /// <summary>
    /// Gets all container states.
    /// </summary>
    Task<IEnumerable<ProjectContainerState>> GetAllStatesAsync(CancellationToken ct = default);

    /// <summary>
    /// Starts a container for the specified project.
    /// </summary>
    Task<ProjectContainerState> StartAsync(ProjectId projectId, CancellationToken ct = default);

    /// <summary>
    /// Stops the container for the specified project.
    /// </summary>
    Task<ProjectContainerState> StopAsync(ProjectId projectId, CancellationToken ct = default);

    /// <summary>
    /// Restarts the container for the specified project.
    /// </summary>
    Task<ProjectContainerState> RestartAsync(ProjectId projectId, CancellationToken ct = default);

    /// <summary>
    /// Gets container logs for the specified project.
    /// </summary>
    Task<string> GetLogsAsync(ProjectId projectId, int? tailLines = null, CancellationToken ct = default);

    /// <summary>
    /// Event raised when container state changes.
    /// </summary>
    event EventHandler<ContainerStateChangedEventArgs>? StateChanged;
}

/// <summary>
/// Event args for container state changes.
/// </summary>
public class ContainerStateChangedEventArgs : EventArgs
{
    public required ProjectContainerState State { get; init; }
    public ProjectContainerState? PreviousState { get; init; }
}
