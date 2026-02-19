using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Domain.Configuration;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for project session operations.
/// Manages workflow execution sessions on real projects.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ProjectSessionsController : ControllerBase
{
    private readonly IProjectSessionService _sessionService;
    private readonly ILogger<ProjectSessionsController> _logger;

    public ProjectSessionsController(
        IProjectSessionService sessionService,
        ILogger<ProjectSessionsController> logger)
    {
        _sessionService = sessionService;
        _logger = logger;
    }

    /// <summary>
    /// List all project sessions with optional filtering.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<ProjectSessionDto>>> GetSessions(
        [FromQuery] string? status = null,
        [FromQuery] string? projectId = null,
        [FromQuery] string? workflowId = null,
        [FromQuery] int? limit = null)
    {
        SessionStatus? statusFilter = null;
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<SessionStatus>(status, ignoreCase: true, out var parsed))
        {
            statusFilter = parsed;
        }

        var sessions = await _sessionService.GetAllAsync(statusFilter, projectId, workflowId, limit);
        var dtos = sessions.Select(s => ProjectSessionDto.FromDomain(s)).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Get a session by ID.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ProjectSessionDto>> GetById(string id)
    {
        var sessionId = SessionId.From(id);
        var session = await _sessionService.GetAsync(sessionId);

        if (session == null)
            return NotFound(new { error = $"Session '{id}' not found" });

        return Ok(ProjectSessionDto.FromDomain(session));
    }

    /// <summary>
    /// Create a new project session.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ProjectSessionDto>> Create([FromBody] CreateProjectSessionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId))
            return BadRequest(new { error = "ProjectId is required" });

        if (string.IsNullOrWhiteSpace(request.WorkflowId))
            return BadRequest(new { error = "WorkflowId is required" });

        if (string.IsNullOrWhiteSpace(request.Task))
            return BadRequest(new { error = "Task is required" });

        try
        {
            var config = new ProjectSessionConfig
            {
                ProjectId = request.ProjectId,
                WorkflowId = request.WorkflowId,
                Task = request.Task,
                Context = request.Context,
                Access = new AccessConfig
                {
                    Level = Enum.TryParse<AccessLevel>(request.Access, ignoreCase: true, out var level)
                        ? level
                        : AccessLevel.Controlled,
                    AllowedPaths = request.AllowedPaths ?? new List<string>(),
                    DeniedPaths = request.DeniedPaths ?? new List<string>()
                },
                Validation = new ValidationConfig
                {
                    RunTests = request.RunTests,
                    TestCommand = request.TestCommand,
                    RunLinter = request.RunLinter,
                    LinterCommand = request.LinterCommand,
                    MaxSteps = request.MaxSteps,
                    TimeoutMs = request.TimeoutMs
                },
                Inputs = request.Inputs ?? new Dictionary<string, object>()
            };

            var sessionName = request.Name ?? $"Session-{DateTime.UtcNow:yyyyMMdd-HHmmss}";
            var session = await _sessionService.CreateAsync(sessionName, config);

            _logger.LogInformation("Created session {SessionId} for project {ProjectId}",
                session.Id, request.ProjectId);

            var dto = ProjectSessionDto.FromDomain(session);
            return CreatedAtAction(nameof(GetById), new { id = session.Id }, dto);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to create session");
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Start a session execution.
    /// </summary>
    [HttpPost("{id}/start")]
    public async Task<ActionResult<ProjectSessionDto>> Start(string id)
    {
        var sessionId = SessionId.From(id);

        try
        {
            var session = await _sessionService.StartAsync(sessionId);
            _logger.LogInformation("Started session {SessionId}", id);
            return Ok(ProjectSessionDto.FromDomain(session));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to start session {SessionId}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get the diff of changes made during the session.
    /// </summary>
    [HttpGet("{id}/diff")]
    public async Task<ActionResult<SessionDiffDto>> GetDiff(string id)
    {
        var sessionId = SessionId.From(id);

        try
        {
            var diff = await _sessionService.GetDiffAsync(sessionId);
            var dto = new SessionDiffDto
            {
                Files = diff.Files.Select(f => new FileDiffDto
                {
                    Path = f.Path,
                    ChangeType = f.ChangeType.ToString().ToLowerInvariant(),
                    Diff = f.Diff,
                    LinesAdded = f.LinesAdded,
                    LinesRemoved = f.LinesRemoved
                }).ToList(),
                TotalFiles = diff.TotalFiles,
                LinesAdded = diff.LinesAdded,
                LinesRemoved = diff.LinesRemoved
            };
            return Ok(dto);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to get diff for session {SessionId}", id);
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Run tests for the session's project.
    /// </summary>
    [HttpPost("{id}/test")]
    public async Task<ActionResult<TestResultDto>> RunTests(string id, [FromBody] RunTestsRequest? request = null)
    {
        var sessionId = SessionId.From(id);

        try
        {
            var result = await _sessionService.RunTestsAsync(sessionId, request?.TestCommand);
            var dto = TestResultDto.FromDomain(result);
            return Ok(dto);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to run tests for session {SessionId}", id);
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Commit the changes made during the session.
    /// </summary>
    [HttpPost("{id}/commit")]
    public async Task<ActionResult<CommitInfoDto>> Commit(string id, [FromBody] CommitSessionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { error = "Commit message is required" });

        var sessionId = SessionId.From(id);

        try
        {
            // Format commit message with type and scope if provided
            var message = request.Message;
            if (!string.IsNullOrEmpty(request.Type))
            {
                var scope = !string.IsNullOrEmpty(request.Scope) ? $"({request.Scope})" : "";
                message = $"{request.Type}{scope}: {request.Message}";
            }

            var commitInfo = await _sessionService.CommitAsync(
                sessionId,
                message,
                request.Branch,
                request.Push);

            _logger.LogInformation("Committed changes for session {SessionId}: {CommitHash}",
                id, commitInfo.CommitHash);

            return Ok(CommitInfoDto.FromDomain(commitInfo));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to commit for session {SessionId}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Cancel a running or pending session.
    /// </summary>
    [HttpPost("{id}/cancel")]
    public async Task<ActionResult<ProjectSessionDto>> Cancel(string id, [FromQuery] bool discardChanges = true)
    {
        var sessionId = SessionId.From(id);

        try
        {
            var session = await _sessionService.CancelAsync(sessionId, discardChanges);
            _logger.LogInformation("Cancelled session {SessionId}", id);
            return Ok(ProjectSessionDto.FromDomain(session));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to cancel session {SessionId}", id);
            return BadRequest(new { error = ex.Message });
        }
    }
}

/// <summary>
/// Request to run tests.
/// </summary>
public record RunTestsRequest
{
    public string? TestCommand { get; init; }
}
