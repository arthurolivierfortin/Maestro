namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Value object representing the current state of a project's container.
/// This is transient state, not persisted.
/// </summary>
public record ProjectContainerState
{
    /// <summary>
    /// The project ID this state belongs to.
    /// </summary>
    public required ProjectId ProjectId { get; init; }

    /// <summary>
    /// The container ID (if created).
    /// </summary>
    public string? ContainerId { get; init; }

    /// <summary>
    /// The current container status.
    /// </summary>
    public ProjectContainerStatus Status { get; init; } = ProjectContainerStatus.Stopped;

    /// <summary>
    /// When the container was started.
    /// </summary>
    public DateTime? StartedAt { get; init; }

    /// <summary>
    /// When the container was stopped.
    /// </summary>
    public DateTime? StoppedAt { get; init; }

    /// <summary>
    /// Error message if status is Error.
    /// </summary>
    public string? ErrorMessage { get; init; }

    /// <summary>
    /// Current CPU usage percentage.
    /// </summary>
    public double? CpuPercent { get; init; }

    /// <summary>
    /// Current memory usage in megabytes.
    /// </summary>
    public double? MemoryMb { get; init; }

    /// <summary>
    /// Creates a stopped state.
    /// </summary>
    public static ProjectContainerState Stopped(ProjectId projectId) =>
        new() { ProjectId = projectId, Status = ProjectContainerStatus.Stopped };

    /// <summary>
    /// Creates a starting state.
    /// </summary>
    public static ProjectContainerState Starting(ProjectId projectId) =>
        new() { ProjectId = projectId, Status = ProjectContainerStatus.Starting };

    /// <summary>
    /// Creates a running state.
    /// </summary>
    public static ProjectContainerState Running(ProjectId projectId, string containerId, DateTime startedAt) =>
        new()
        {
            ProjectId = projectId,
            ContainerId = containerId,
            Status = ProjectContainerStatus.Running,
            StartedAt = startedAt
        };

    /// <summary>
    /// Creates a stopping state.
    /// </summary>
    public static ProjectContainerState Stopping(ProjectId projectId, string? containerId) =>
        new() { ProjectId = projectId, ContainerId = containerId, Status = ProjectContainerStatus.Stopping };

    /// <summary>
    /// Creates an error state.
    /// </summary>
    public static ProjectContainerState Error(ProjectId projectId, string error) =>
        new() { ProjectId = projectId, Status = ProjectContainerStatus.Error, ErrorMessage = error };
}

/// <summary>
/// Possible container statuses for a project.
/// </summary>
public enum ProjectContainerStatus
{
    /// <summary>
    /// Container is not running.
    /// </summary>
    Stopped,

    /// <summary>
    /// Container is starting up.
    /// </summary>
    Starting,

    /// <summary>
    /// Container is running.
    /// </summary>
    Running,

    /// <summary>
    /// Container is shutting down.
    /// </summary>
    Stopping,

    /// <summary>
    /// Container encountered an error.
    /// </summary>
    Error
}
