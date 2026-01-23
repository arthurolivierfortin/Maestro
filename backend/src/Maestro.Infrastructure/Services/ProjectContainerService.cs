using System.Collections.Concurrent;
using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Services;

/// <summary>
/// Service for managing project container lifecycle.
/// Maintains in-memory state for active containers.
/// </summary>
public class ProjectContainerService : IProjectContainerService
{
    private readonly IProjectRepository _projectRepository;
    private readonly IContainerRuntimeFactory _runtimeFactory;
    private readonly ILogger<ProjectContainerService> _logger;
    private readonly ConcurrentDictionary<string, ProjectContainerState> _states = new();

    public event EventHandler<ContainerStateChangedEventArgs>? StateChanged;

    public ProjectContainerService(
        IProjectRepository projectRepository,
        IContainerRuntimeFactory runtimeFactory,
        ILogger<ProjectContainerService> logger)
    {
        _projectRepository = projectRepository;
        _runtimeFactory = runtimeFactory;
        _logger = logger;
    }

    public Task<ProjectContainerState> GetStateAsync(ProjectId projectId, CancellationToken ct = default)
    {
        var key = projectId.ToString();
        if (_states.TryGetValue(key, out var state))
        {
            return Task.FromResult(state);
        }

        return Task.FromResult(ProjectContainerState.Stopped(projectId));
    }

    public Task<IEnumerable<ProjectContainerState>> GetAllStatesAsync(CancellationToken ct = default)
    {
        return Task.FromResult(_states.Values.AsEnumerable());
    }

    public async Task<ProjectContainerState> StartAsync(ProjectId projectId, CancellationToken ct = default)
    {
        var key = projectId.ToString();

        // Check if already running
        if (_states.TryGetValue(key, out var currentState) &&
            (currentState.Status == ProjectContainerStatus.Running || currentState.Status == ProjectContainerStatus.Starting))
        {
            _logger.LogWarning("Project {ProjectId} container is already {Status}", projectId, currentState.Status);
            return currentState;
        }

        // Get project
        var project = await _projectRepository.GetByIdAsync(projectId, ct);
        if (project == null)
        {
            throw new InvalidOperationException($"Project {projectId} not found");
        }

        // Check runtime configuration
        if (project.Runtime.Type == "none")
        {
            _logger.LogWarning("Project {ProjectId} has no container runtime configured", projectId);
            return ProjectContainerState.Stopped(projectId);
        }

        // Update state to starting
        var startingState = ProjectContainerState.Starting(projectId);
        UpdateState(projectId, startingState);

        try
        {
            // Get runtime
            var runtime = _runtimeFactory.CreateRuntime(project.Runtime);
            if (!await runtime.IsAvailableAsync(ct))
            {
                throw new InvalidOperationException($"Runtime '{project.Runtime.Type}' is not available");
            }

            // Create and start container
            _logger.LogInformation("Creating container for project {ProjectId}", projectId);
            var containerId = await runtime.CreateContainerAsync(project.Runtime, ct);

            _logger.LogInformation("Starting container {ContainerId} for project {ProjectId}", containerId, projectId);
            await runtime.StartContainerAsync(containerId, ct);

            // Update state to running
            var runningState = ProjectContainerState.Running(projectId, containerId, DateTime.UtcNow);
            UpdateState(projectId, runningState);

            _logger.LogInformation("Container {ContainerId} started for project {ProjectId}", containerId, projectId);
            return runningState;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start container for project {ProjectId}", projectId);
            var errorState = ProjectContainerState.Error(projectId, ex.Message);
            UpdateState(projectId, errorState);
            throw;
        }
    }

    public async Task<ProjectContainerState> StopAsync(ProjectId projectId, CancellationToken ct = default)
    {
        var key = projectId.ToString();

        if (!_states.TryGetValue(key, out var currentState) ||
            currentState.Status == ProjectContainerStatus.Stopped)
        {
            _logger.LogWarning("Project {ProjectId} container is not running", projectId);
            return ProjectContainerState.Stopped(projectId);
        }

        if (string.IsNullOrEmpty(currentState.ContainerId))
        {
            var stoppedState = ProjectContainerState.Stopped(projectId);
            UpdateState(projectId, stoppedState);
            return stoppedState;
        }

        // Update state to stopping
        var stoppingState = ProjectContainerState.Stopping(projectId, currentState.ContainerId);
        UpdateState(projectId, stoppingState);

        try
        {
            // Get project for runtime type
            var project = await _projectRepository.GetByIdAsync(projectId, ct);
            if (project == null || project.Runtime.Type == "none")
            {
                var stoppedState = ProjectContainerState.Stopped(projectId);
                UpdateState(projectId, stoppedState);
                return stoppedState;
            }

            var runtime = _runtimeFactory.CreateRuntime(project.Runtime);

            // Stop and remove container
            _logger.LogInformation("Stopping container {ContainerId} for project {ProjectId}",
                currentState.ContainerId, projectId);

            await runtime.StopContainerAsync(currentState.ContainerId, 10, ct);
            await runtime.RemoveContainerAsync(currentState.ContainerId, force: true, ct);

            var finalState = new ProjectContainerState
            {
                ProjectId = projectId,
                Status = ProjectContainerStatus.Stopped,
                StoppedAt = DateTime.UtcNow
            };
            UpdateState(projectId, finalState);

            _logger.LogInformation("Container stopped for project {ProjectId}", projectId);
            return finalState;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to stop container for project {ProjectId}", projectId);
            var errorState = ProjectContainerState.Error(projectId, ex.Message);
            UpdateState(projectId, errorState);
            throw;
        }
    }

    public async Task<ProjectContainerState> RestartAsync(ProjectId projectId, CancellationToken ct = default)
    {
        await StopAsync(projectId, ct);
        return await StartAsync(projectId, ct);
    }

    public async Task<string> GetLogsAsync(ProjectId projectId, int? tailLines = null, CancellationToken ct = default)
    {
        var key = projectId.ToString();

        if (!_states.TryGetValue(key, out var state) || string.IsNullOrEmpty(state.ContainerId))
        {
            return string.Empty;
        }

        var project = await _projectRepository.GetByIdAsync(projectId, ct);
        if (project == null || project.Runtime.Type == "none")
        {
            return string.Empty;
        }

        var runtime = _runtimeFactory.CreateRuntime(project.Runtime);
        return await runtime.GetLogsAsync(state.ContainerId, tailLines, ct);
    }

    private void UpdateState(ProjectId projectId, ProjectContainerState newState)
    {
        var key = projectId.ToString();
        _states.TryGetValue(key, out var previousState);
        _states[key] = newState;

        StateChanged?.Invoke(this, new ContainerStateChangedEventArgs
        {
            State = newState,
            PreviousState = previousState
        });
    }
}
