using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.AspNetCore.Mvc;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for container runtime operations.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ContainersController : ControllerBase
{
    private readonly IContainerRuntimeFactory _runtimeFactory;
    private readonly IProjectRepository _projectRepository;
    private readonly ILogger<ContainersController> _logger;

    public ContainersController(
        IContainerRuntimeFactory runtimeFactory,
        IProjectRepository projectRepository,
        ILogger<ContainersController> logger)
    {
        _runtimeFactory = runtimeFactory;
        _projectRepository = projectRepository;
        _logger = logger;
    }

    /// <summary>
    /// Gets available runtime types.
    /// </summary>
    [HttpGet("runtimes")]
    [ProducesResponseType(typeof(RuntimeTypesResponse), StatusCodes.Status200OK)]
    public IActionResult GetRuntimeTypes()
    {
        return Ok(new RuntimeTypesResponse
        {
            Types = _runtimeFactory.AvailableRuntimeTypes.ToArray()
        });
    }

    /// <summary>
    /// Checks if a specific runtime is available.
    /// </summary>
    [HttpGet("runtimes/{type}/status")]
    [ProducesResponseType(typeof(RuntimeStatusResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRuntimeStatus(string type)
    {
        if (!_runtimeFactory.IsSupported(type))
        {
            return NotFound(new { error = $"Runtime type not supported: {type}" });
        }

        var runtime = _runtimeFactory.CreateRuntime(type);
        var available = await runtime.IsAvailableAsync();

        return Ok(new RuntimeStatusResponse
        {
            Type = type,
            Available = available
        });
    }

    /// <summary>
    /// Creates a new container for a project.
    /// </summary>
    [HttpPost("projects/{projectId}/container")]
    [ProducesResponseType(typeof(ContainerResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateProjectContainer(string projectId)
    {
        var project = await _projectRepository.GetByIdAsync(ProjectId.From(projectId));
        if (project == null)
        {
            return NotFound(new { error = "Project not found" });
        }

        if (project.Runtime == null || project.Runtime.Type == "none")
        {
            return BadRequest(new { error = "Project does not have a container runtime configured" });
        }

        var runtime = _runtimeFactory.CreateRuntime(project.Runtime);

        if (!await runtime.IsAvailableAsync())
        {
            return BadRequest(new { error = $"Runtime '{project.Runtime.Type}' is not available" });
        }

        try
        {
            var containerId = await runtime.CreateContainerAsync(project.Runtime);
            await runtime.StartContainerAsync(containerId);

            _logger.LogInformation("Created and started container {ContainerId} for project {ProjectId}", containerId, projectId);

            return CreatedAtAction(
                nameof(GetContainerStatus),
                new { containerId },
                new ContainerResponse
                {
                    ContainerId = containerId,
                    ProjectId = projectId,
                    RuntimeType = project.Runtime.Type,
                    Status = "running"
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create container for project {ProjectId}", projectId);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Gets the status of a container.
    /// </summary>
    [HttpGet("{containerId}")]
    [ProducesResponseType(typeof(ContainerStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetContainerStatus(string containerId, [FromQuery] string runtimeType = "docker")
    {
        if (!_runtimeFactory.IsSupported(runtimeType))
        {
            return NotFound(new { error = $"Runtime type not supported: {runtimeType}" });
        }

        var runtime = _runtimeFactory.CreateRuntime(runtimeType);
        var status = await runtime.GetStatusAsync(containerId);

        return Ok(new ContainerStatusResponse
        {
            ContainerId = status.ContainerId,
            State = status.State.ToString().ToLower(),
            Name = status.Name,
            Image = status.Image,
            CreatedAt = status.CreatedAt,
            StartedAt = status.StartedAt,
            FinishedAt = status.FinishedAt,
            ExitCode = status.ExitCode,
            Error = status.Error
        });
    }

    /// <summary>
    /// Executes a command in a container.
    /// </summary>
    [HttpPost("{containerId}/exec")]
    [ProducesResponseType(typeof(ExecResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ExecuteCommand(
        string containerId,
        [FromBody] ExecRequest request,
        [FromQuery] string runtimeType = "docker")
    {
        if (!_runtimeFactory.IsSupported(runtimeType))
        {
            return NotFound(new { error = $"Runtime type not supported: {runtimeType}" });
        }

        if (string.IsNullOrEmpty(request.Command))
        {
            return BadRequest(new { error = "Command is required" });
        }

        var runtime = _runtimeFactory.CreateRuntime(runtimeType);

        try
        {
            var execRequest = new ContainerExecRequest
            {
                Command = request.Command,
                Arguments = request.Arguments ?? [],
                WorkingDirectory = request.WorkingDirectory,
                Environment = request.Environment ?? new Dictionary<string, string>(),
                StandardInput = request.Stdin,
                Timeout = request.TimeoutSeconds.HasValue
                    ? TimeSpan.FromSeconds(request.TimeoutSeconds.Value)
                    : null
            };

            var result = await runtime.ExecuteAsync(containerId, execRequest);

            return Ok(new ExecResponse
            {
                ExitCode = result.ExitCode,
                Stdout = result.StandardOutput,
                Stderr = result.StandardError,
                DurationMs = (int)result.Duration.TotalMilliseconds,
                TimedOut = result.TimedOut
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to execute command in container {ContainerId}", containerId);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Gets logs from a container.
    /// </summary>
    [HttpGet("{containerId}/logs")]
    [ProducesResponseType(typeof(LogsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLogs(
        string containerId,
        [FromQuery] int? tail = null,
        [FromQuery] string runtimeType = "docker")
    {
        if (!_runtimeFactory.IsSupported(runtimeType))
        {
            return NotFound(new { error = $"Runtime type not supported: {runtimeType}" });
        }

        var runtime = _runtimeFactory.CreateRuntime(runtimeType);
        var logs = await runtime.GetLogsAsync(containerId, tail);

        return Ok(new LogsResponse { Logs = logs });
    }

    /// <summary>
    /// Stops a container.
    /// </summary>
    [HttpPost("{containerId}/stop")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> StopContainer(
        string containerId,
        [FromQuery] int timeoutSeconds = 10,
        [FromQuery] string runtimeType = "docker")
    {
        if (!_runtimeFactory.IsSupported(runtimeType))
        {
            return NotFound(new { error = $"Runtime type not supported: {runtimeType}" });
        }

        var runtime = _runtimeFactory.CreateRuntime(runtimeType);

        try
        {
            await runtime.StopContainerAsync(containerId, timeoutSeconds);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to stop container {ContainerId}", containerId);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Removes a container.
    /// </summary>
    [HttpDelete("{containerId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RemoveContainer(
        string containerId,
        [FromQuery] bool force = false,
        [FromQuery] string runtimeType = "docker")
    {
        if (!_runtimeFactory.IsSupported(runtimeType))
        {
            return NotFound(new { error = $"Runtime type not supported: {runtimeType}" });
        }

        var runtime = _runtimeFactory.CreateRuntime(runtimeType);

        try
        {
            await runtime.RemoveContainerAsync(containerId, force);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to remove container {ContainerId}", containerId);
            return BadRequest(new { error = ex.Message });
        }
    }
}

// Request/Response DTOs

public record RuntimeTypesResponse
{
    public required string[] Types { get; init; }
}

public record RuntimeStatusResponse
{
    public required string Type { get; init; }
    public required bool Available { get; init; }
}

public record ContainerResponse
{
    public required string ContainerId { get; init; }
    public required string ProjectId { get; init; }
    public string? RuntimeType { get; init; }
    public required string Status { get; init; }
}

public record ContainerStatusResponse
{
    public required string ContainerId { get; init; }
    public required string State { get; init; }
    public string? Name { get; init; }
    public string? Image { get; init; }
    public DateTime? CreatedAt { get; init; }
    public DateTime? StartedAt { get; init; }
    public DateTime? FinishedAt { get; init; }
    public int? ExitCode { get; init; }
    public string? Error { get; init; }
}

public record ExecRequest
{
    public required string Command { get; init; }
    public string[]? Arguments { get; init; }
    public string? WorkingDirectory { get; init; }
    public Dictionary<string, string>? Environment { get; init; }
    public string? Stdin { get; init; }
    public int? TimeoutSeconds { get; init; }
}

public record ExecResponse
{
    public required int ExitCode { get; init; }
    public required string Stdout { get; init; }
    public required string Stderr { get; init; }
    public required int DurationMs { get; init; }
    public required bool TimedOut { get; init; }
}

public record LogsResponse
{
    public required string Logs { get; init; }
}
