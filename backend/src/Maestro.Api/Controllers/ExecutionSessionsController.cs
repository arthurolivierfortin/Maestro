using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Domain.Entities;

namespace Maestro.Api.Controllers;

/// <summary>
/// Controller for managing execution sessions.
/// </summary>
[ApiController]
[Route("api/sessions")]
public class ExecutionSessionsController : ControllerBase
{
    private readonly IExecutionSessionService _sessionService;
    private readonly ILogger<ExecutionSessionsController> _logger;

    public ExecutionSessionsController(
        IExecutionSessionService sessionService,
        ILogger<ExecutionSessionsController> logger)
    {
        _sessionService = sessionService;
        _logger = logger;
    }

    /// <summary>
    /// Create a new execution session.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ExecutionSessionDto>> CreateSession(
        [FromBody] CreateExecutionSessionRequestDto request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ParentWorkspaceId))
        {
            return BadRequest(new { error = "Parent workspace ID is required" });
        }

        try
        {
            var createRequest = new CreateExecutionSessionRequest
            {
                Name = request.Name,
                Type = request.Type,
                ParentWorkspaceId = request.ParentWorkspaceId,
                ParentSessionId = request.ParentSessionId,
                CreatedByAgentId = request.CreatedByAgentId,
                Permissions = request.Permissions?.ToDomain(),
                LogAllCommands = request.LogAllCommands,
                MaxIterations = request.MaxIterations,
                MaxDuration = request.MaxDurationMinutes.HasValue
                    ? TimeSpan.FromMinutes(request.MaxDurationMinutes.Value)
                    : null
            };

            var session = await _sessionService.CreateAsync(createRequest, ct);
            return CreatedAtAction(
                nameof(GetSession),
                new { id = session.Id },
                ExecutionSessionDto.FromDomain(session));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create session");
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Create a session from a workspace template.
    /// </summary>
    [HttpPost("from-template")]
    public async Task<ActionResult<ExecutionSessionDto>> CreateFromTemplate(
        [FromBody] CreateSessionFromTemplateRequestDto request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.WorkspaceId))
        {
            return BadRequest(new { error = "Workspace ID is required" });
        }
        if (string.IsNullOrWhiteSpace(request.TemplateType))
        {
            return BadRequest(new { error = "Template type is required" });
        }

        try
        {
            var session = await _sessionService.CreateFromTemplateAsync(
                request.WorkspaceId,
                request.TemplateType,
                request.CreatedByAgentId,
                ct);

            return CreatedAtAction(
                nameof(GetSession),
                new { id = session.Id },
                ExecutionSessionDto.FromDomain(session));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create session from template");
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get a session by ID.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ExecutionSessionDto>> GetSession(string id, CancellationToken ct)
    {
        var session = await _sessionService.GetAsync(id, ct);
        if (session == null)
        {
            return NotFound(new { error = $"Session not found: {id}" });
        }
        return Ok(ExecutionSessionDto.FromDomain(session));
    }

    /// <summary>
    /// List sessions by workspace.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ExecutionSessionDto>>> ListSessions(
        [FromQuery] string? workspaceId,
        [FromQuery] string? parentSessionId,
        [FromQuery] string? status,
        CancellationToken ct)
    {
        ExecutionSessionStatus? statusFilter = null;
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<ExecutionSessionStatus>(status, true, out var s))
        {
            statusFilter = s;
        }

        IReadOnlyList<ExecutionSession> sessions;

        if (!string.IsNullOrEmpty(parentSessionId))
        {
            sessions = await _sessionService.ListByParentSessionAsync(parentSessionId, ct);
        }
        else if (!string.IsNullOrEmpty(workspaceId))
        {
            sessions = await _sessionService.ListByWorkspaceAsync(workspaceId, statusFilter, ct);
        }
        else
        {
            return BadRequest(new { error = "Either workspaceId or parentSessionId is required" });
        }

        return Ok(sessions.Select(ExecutionSessionDto.FromDomain));
    }

    /// <summary>
    /// Get effective permissions for a session.
    /// </summary>
    [HttpGet("{id}/permissions")]
    public async Task<ActionResult<ContextPermissionsDto>> GetEffectivePermissions(
        string id,
        CancellationToken ct)
    {
        try
        {
            var permissions = await _sessionService.GetEffectivePermissionsAsync(id, ct);
            return Ok(ContextPermissionsDto.FromDomain(permissions));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = $"Session not found: {id}" });
        }
    }

    /// <summary>
    /// Attach an agent to a session.
    /// </summary>
    [HttpPost("{id}/attach")]
    public async Task<ActionResult<ExecutionSessionDto>> AttachAgent(
        string id,
        [FromBody] AttachAgentRequestDto request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.AgentId))
        {
            return BadRequest(new { error = "Agent ID is required" });
        }

        try
        {
            var session = await _sessionService.AttachAgentAsync(id, request.AgentId, ct);
            return Ok(ExecutionSessionDto.FromDomain(session));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = $"Session not found: {id}" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Detach the current agent from a session.
    /// </summary>
    [HttpPost("{id}/detach")]
    public async Task<ActionResult<ExecutionSessionDto>> DetachAgent(
        string id,
        CancellationToken ct)
    {
        try
        {
            var session = await _sessionService.DetachAgentAsync(id, ct);
            return Ok(ExecutionSessionDto.FromDomain(session));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = $"Session not found: {id}" });
        }
    }

    /// <summary>
    /// Pause a session.
    /// </summary>
    [HttpPost("{id}/pause")]
    public async Task<ActionResult<ExecutionSessionDto>> PauseSession(
        string id,
        CancellationToken ct)
    {
        try
        {
            var session = await _sessionService.PauseAsync(id, ct);
            return Ok(ExecutionSessionDto.FromDomain(session));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = $"Session not found: {id}" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Resume a paused session.
    /// </summary>
    [HttpPost("{id}/resume")]
    public async Task<ActionResult<ExecutionSessionDto>> ResumeSession(
        string id,
        CancellationToken ct)
    {
        try
        {
            var session = await _sessionService.ResumeAsync(id, ct);
            return Ok(ExecutionSessionDto.FromDomain(session));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = $"Session not found: {id}" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// End a session.
    /// </summary>
    [HttpPost("{id}/end")]
    public async Task<ActionResult<ExecutionSessionDto>> EndSession(
        string id,
        [FromBody] EndSessionRequestDto? request,
        CancellationToken ct)
    {
        try
        {
            var session = await _sessionService.EndAsync(id, request?.Reason, ct);
            return Ok(ExecutionSessionDto.FromDomain(session));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = $"Session not found: {id}" });
        }
    }

    /// <summary>
    /// Delete a session (must be ended first).
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteSession(string id, CancellationToken ct)
    {
        try
        {
            await _sessionService.DeleteAsync(id, ct);
            return Ok(new { message = $"Session {id} deleted" });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = $"Session not found: {id}" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
