using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Defines the contract for container runtime operations.
/// Supports Docker and process-based execution environments.
/// </summary>
public interface IContainerRuntime
{
    /// <summary>
    /// Gets the runtime type identifier (e.g., "docker", "process").
    /// </summary>
    string RuntimeType { get; }

    /// <summary>
    /// Checks if the runtime is available and properly configured.
    /// </summary>
    Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a new container/environment for the given configuration.
    /// </summary>
    /// <param name="config">Runtime configuration</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Container identifier</returns>
    Task<string> CreateContainerAsync(
        RuntimeConfiguration config,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Starts a container/environment.
    /// </summary>
    /// <param name="containerId">Container identifier</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task StartContainerAsync(
        string containerId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Stops a running container/environment.
    /// </summary>
    /// <param name="containerId">Container identifier</param>
    /// <param name="timeoutSeconds">Graceful shutdown timeout</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task StopContainerAsync(
        string containerId,
        int timeoutSeconds = 10,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a container/environment.
    /// </summary>
    /// <param name="containerId">Container identifier</param>
    /// <param name="force">Force removal even if running</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task RemoveContainerAsync(
        string containerId,
        bool force = false,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Executes a command inside a container/environment.
    /// </summary>
    /// <param name="containerId">Container identifier</param>
    /// <param name="command">Command to execute</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Execution result</returns>
    Task<ContainerExecResult> ExecuteAsync(
        string containerId,
        ContainerExecRequest command,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the current status of a container/environment.
    /// </summary>
    /// <param name="containerId">Container identifier</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Container status</returns>
    Task<ContainerStatus> GetStatusAsync(
        string containerId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets logs from a container/environment.
    /// </summary>
    /// <param name="containerId">Container identifier</param>
    /// <param name="tail">Number of lines to retrieve (null for all)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Log content</returns>
    Task<string> GetLogsAsync(
        string containerId,
        int? tail = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Copies files into a container/environment.
    /// </summary>
    /// <param name="containerId">Container identifier</param>
    /// <param name="sourcePath">Local source path</param>
    /// <param name="destinationPath">Destination path in container</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task CopyToContainerAsync(
        string containerId,
        string sourcePath,
        string destinationPath,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Copies files from a container/environment.
    /// </summary>
    /// <param name="containerId">Container identifier</param>
    /// <param name="sourcePath">Source path in container</param>
    /// <param name="destinationPath">Local destination path</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task CopyFromContainerAsync(
        string containerId,
        string sourcePath,
        string destinationPath,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Request for executing a command in a container.
/// </summary>
public record ContainerExecRequest
{
    /// <summary>
    /// Command to execute (e.g., "python", "node").
    /// </summary>
    public required string Command { get; init; }

    /// <summary>
    /// Arguments for the command.
    /// </summary>
    public string[] Arguments { get; init; } = [];

    /// <summary>
    /// Working directory inside the container.
    /// </summary>
    public string? WorkingDirectory { get; init; }

    /// <summary>
    /// Environment variables for the command.
    /// </summary>
    public Dictionary<string, string> Environment { get; init; } = new();

    /// <summary>
    /// Standard input to provide to the command.
    /// </summary>
    public string? StandardInput { get; init; }

    /// <summary>
    /// Timeout for the command execution.
    /// </summary>
    public TimeSpan? Timeout { get; init; }
}

/// <summary>
/// Result of executing a command in a container.
/// </summary>
public record ContainerExecResult
{
    /// <summary>
    /// Exit code of the command.
    /// </summary>
    public int ExitCode { get; init; }

    /// <summary>
    /// Standard output from the command.
    /// </summary>
    public string StandardOutput { get; init; } = string.Empty;

    /// <summary>
    /// Standard error from the command.
    /// </summary>
    public string StandardError { get; init; } = string.Empty;

    /// <summary>
    /// Execution duration.
    /// </summary>
    public TimeSpan Duration { get; init; }

    /// <summary>
    /// Whether the command completed successfully (exit code 0).
    /// </summary>
    public bool Success => ExitCode == 0;

    /// <summary>
    /// Whether the command timed out.
    /// </summary>
    public bool TimedOut { get; init; }
}

/// <summary>
/// Status of a container/environment.
/// </summary>
public record ContainerStatus
{
    /// <summary>
    /// Container identifier.
    /// </summary>
    public required string ContainerId { get; init; }

    /// <summary>
    /// Current state of the container.
    /// </summary>
    public ContainerState State { get; init; }

    /// <summary>
    /// Container name.
    /// </summary>
    public string? Name { get; init; }

    /// <summary>
    /// Image used to create the container.
    /// </summary>
    public string? Image { get; init; }

    /// <summary>
    /// When the container was created.
    /// </summary>
    public DateTime? CreatedAt { get; init; }

    /// <summary>
    /// When the container was started.
    /// </summary>
    public DateTime? StartedAt { get; init; }

    /// <summary>
    /// When the container finished (if stopped).
    /// </summary>
    public DateTime? FinishedAt { get; init; }

    /// <summary>
    /// Exit code if container has stopped.
    /// </summary>
    public int? ExitCode { get; init; }

    /// <summary>
    /// Error message if container failed.
    /// </summary>
    public string? Error { get; init; }
}

/// <summary>
/// Possible states of a container.
/// </summary>
public enum ContainerState
{
    Unknown,
    Created,
    Running,
    Paused,
    Restarting,
    Exited,
    Dead,
    Removing
}
