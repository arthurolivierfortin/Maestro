using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Domain.Configuration;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for session operations.
/// Manages interactive project sessions with command execution.
/// </summary>
[ApiController]
[Route("api/sessions")]
public class SessionsController : ControllerBase
{
    private readonly IProjectSessionServer _sessionServer;
    private readonly ILogger<SessionsController> _logger;

    public SessionsController(
        IProjectSessionServer sessionServer,
        ILogger<SessionsController> logger)
    {
        _sessionServer = sessionServer;
        _logger = logger;
    }

    /// <summary>
    /// List all sessions with optional filtering.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<ProjectSessionDto>>> GetSessions(
        [FromQuery] string? status = null,
        [FromQuery] string? projectId = null,
        [FromQuery] int? limit = null)
    {
        SessionStatus? statusFilter = null;
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<SessionStatus>(status, ignoreCase: true, out var parsed))
        {
            statusFilter = parsed;
        }

        var sessions = await _sessionServer.GetAllAsync(statusFilter, projectId, limit);
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
        var session = await _sessionServer.GetAsync(sessionId);

        if (session == null)
            return NotFound(new { error = $"Session '{id}' not found" });

        return Ok(ProjectSessionDto.FromDomain(session));
    }

    /// <summary>
    /// Create a new session.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ProjectSessionDto>> Create([FromBody] CreateInteractiveSessionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId))
            return BadRequest(new { error = "ProjectId is required" });

        try
        {
            // Parse authority
            var authority = !string.IsNullOrEmpty(request.Authority)
                ? Authority.Parse(request.Authority)
                : Authority.Human();

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
                    DeniedPaths = request.DeniedPaths ?? new List<string> { ".env", "*.env", "secrets/**" }
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
            var session = await _sessionServer.CreateAsync(sessionName, authority, config);

            _logger.LogInformation("Created session {SessionId} for project {ProjectId} with authority {Authority}",
                session.Id, request.ProjectId, authority);

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
    /// Start a session.
    /// </summary>
    [HttpPost("{id}/start")]
    public async Task<ActionResult<ProjectSessionDto>> Start(string id)
    {
        var sessionId = SessionId.From(id);

        try
        {
            var session = await _sessionServer.StartAsync(sessionId);
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
    /// Pause a session.
    /// </summary>
    [HttpPost("{id}/pause")]
    public async Task<ActionResult<ProjectSessionDto>> Pause(string id)
    {
        var sessionId = SessionId.From(id);

        try
        {
            var session = await _sessionServer.PauseAsync(sessionId);
            _logger.LogInformation("Paused session {SessionId}", id);
            return Ok(ProjectSessionDto.FromDomain(session));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to pause session {SessionId}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Resume a paused session.
    /// </summary>
    [HttpPost("{id}/resume")]
    public async Task<ActionResult<ProjectSessionDto>> Resume(string id)
    {
        var sessionId = SessionId.From(id);

        try
        {
            var session = await _sessionServer.ResumeAsync(sessionId);
            _logger.LogInformation("Resumed session {SessionId}", id);
            return Ok(ProjectSessionDto.FromDomain(session));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to resume session {SessionId}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Stop a session.
    /// </summary>
    [HttpPost("{id}/stop")]
    public async Task<ActionResult<ProjectSessionDto>> Stop(string id)
    {
        var sessionId = SessionId.From(id);

        try
        {
            var session = await _sessionServer.StopAsync(sessionId);
            _logger.LogInformation("Stopped session {SessionId}", id);
            return Ok(ProjectSessionDto.FromDomain(session));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to stop session {SessionId}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Take control of a session (transfer authority).
    /// </summary>
    [HttpPost("{id}/take-control")]
    public async Task<ActionResult<ProjectSessionDto>> TakeControl(string id, [FromBody] TakeControlRequest? request = null)
    {
        var sessionId = SessionId.From(id);

        try
        {
            var newAuthority = !string.IsNullOrEmpty(request?.Authority)
                ? Authority.Parse(request.Authority)
                : Authority.Human();

            var session = await _sessionServer.TakeControlAsync(sessionId, newAuthority);
            _logger.LogInformation("Transferred control of session {SessionId} to {Authority}", id, newAuthority);
            return Ok(ProjectSessionDto.FromDomain(session));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to take control of session {SessionId}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Delete a session.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(string id)
    {
        var sessionId = SessionId.From(id);

        try
        {
            await _sessionServer.DeleteAsync(sessionId);
            _logger.LogInformation("Deleted session {SessionId}", id);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to delete session {SessionId}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Execute a command within the session.
    /// </summary>
    [HttpPost("{id}/exec")]
    public async Task<ActionResult<CommandResultDto>> ExecuteCommand(string id, [FromBody] ExecuteCommandRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Command))
            return BadRequest(new { error = "Command is required" });

        var sessionId = SessionId.From(id);

        try
        {
            var result = await _sessionServer.ExecuteCommandAsync(sessionId, request.Command);

            var dto = new CommandResultDto
            {
                CommandId = result.Command.Id,
                Command = result.Command.Command,
                CommandType = result.Command.Type.ToString().ToLowerInvariant(),
                Success = result.Success,
                Output = result.Output,
                Error = result.Error,
                ExitCode = result.ExitCode,
                DurationMs = result.Command.DurationMs
            };

            return Ok(dto);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to execute command in session {SessionId}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get session events with pagination.
    /// </summary>
    [HttpGet("{id}/events")]
    public async Task<ActionResult<List<SessionEventDto>>> GetEvents(
        string id,
        [FromQuery] int? limit = 100,
        [FromQuery] int? offset = 0,
        [FromQuery] string? filter = null)
    {
        var sessionId = SessionId.From(id);
        var session = await _sessionServer.GetAsync(sessionId);

        if (session == null)
            return NotFound(new { error = $"Session '{id}' not found" });

        var events = session.EventHistory.AsEnumerable();

        // Apply filter
        if (!string.IsNullOrEmpty(filter))
        {
            if (Enum.TryParse<SessionEventType>(filter, ignoreCase: true, out var eventType))
            {
                events = events.Where(e => e.Type == eventType);
            }
        }

        // Apply pagination
        events = events.Skip(offset ?? 0).Take(limit ?? 100);

        var dtos = events.Select(e => new SessionEventDto
        {
            Id = e.Id,
            Type = e.Type.ToString().ToLowerInvariant(),
            Source = e.Source,
            Message = e.Message,
            Timestamp = e.Timestamp,
            Sequence = e.Sequence,
            Data = e.Data.ToDictionary(k => k.Key, k => k.Value)
        }).ToList();

        return Ok(dtos);
    }

    // ========== Session Variables Endpoints ==========

    /// <summary>
    /// Get all session variables.
    /// </summary>
    [HttpGet("{id}/variables")]
    public async Task<ActionResult<Dictionary<string, object>>> GetVariables(string id)
    {
        var sessionId = SessionId.From(id);
        var session = await _sessionServer.GetAsync(sessionId);

        if (session == null)
            return NotFound(new { error = $"Session '{id}' not found" });

        return Ok(session.Variables);
    }

    /// <summary>
    /// Get a specific session variable.
    /// </summary>
    [HttpGet("{id}/variables/{key}")]
    public async Task<ActionResult<object>> GetVariable(string id, string key)
    {
        var sessionId = SessionId.From(id);
        var session = await _sessionServer.GetAsync(sessionId);

        if (session == null)
            return NotFound(new { error = $"Session '{id}' not found" });

        if (!session.HasVariable(key))
            return NotFound(new { error = $"Variable '{key}' not found" });

        return Ok(new { key, value = session.GetVariable(key) });
    }

    /// <summary>
    /// Set a session variable.
    /// </summary>
    [HttpPut("{id}/variables/{key}")]
    public async Task<ActionResult> SetVariable(string id, string key, [FromBody] SetVariableRequest request)
    {
        var sessionId = SessionId.From(id);
        var session = await _sessionServer.GetAsync(sessionId);

        if (session == null)
            return NotFound(new { error = $"Session '{id}' not found" });

        try
        {
            session.SetVariable(key, request.Value);
            await _sessionServer.SaveAsync(session);
            _logger.LogInformation("Set variable '{Key}' on session {SessionId}", key, id);
            return Ok(new { key, value = request.Value });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to set variable '{Key}' on session {SessionId}", key, id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Delete a session variable.
    /// </summary>
    [HttpDelete("{id}/variables/{key}")]
    public async Task<ActionResult> DeleteVariable(string id, string key)
    {
        var sessionId = SessionId.From(id);
        var session = await _sessionServer.GetAsync(sessionId);

        if (session == null)
            return NotFound(new { error = $"Session '{id}' not found" });

        if (!session.RemoveVariable(key))
            return NotFound(new { error = $"Variable '{key}' not found" });

        await _sessionServer.SaveAsync(session);
        _logger.LogInformation("Removed variable '{Key}' from session {SessionId}", key, id);
        return NoContent();
    }

    // ========== Entry Points Endpoints ==========

    /// <summary>
    /// Get all entry points for a session.
    /// </summary>
    [HttpGet("{id}/entry-points")]
    public async Task<ActionResult<Dictionary<string, string>>> GetEntryPoints(string id)
    {
        var sessionId = SessionId.From(id);
        var session = await _sessionServer.GetAsync(sessionId);

        if (session == null)
            return NotFound(new { error = $"Session '{id}' not found" });

        return Ok(session.EntryPoints);
    }

    /// <summary>
    /// Register an entry point for a session.
    /// </summary>
    [HttpPut("{id}/entry-points/{name}")]
    public async Task<ActionResult> RegisterEntryPoint(string id, string name, [FromBody] RegisterEntryPointRequest request)
    {
        var sessionId = SessionId.From(id);
        var session = await _sessionServer.GetAsync(sessionId);

        if (session == null)
            return NotFound(new { error = $"Session '{id}' not found" });

        try
        {
            session.RegisterEntryPoint(name, request.WorkflowId);
            await _sessionServer.SaveAsync(session);
            _logger.LogInformation("Registered entry point '{Name}' on session {SessionId}", name, id);
            return Ok(new { name, workflowId = request.WorkflowId });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to register entry point '{Name}' on session {SessionId}", name, id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Remove an entry point from a session.
    /// </summary>
    [HttpDelete("{id}/entry-points/{name}")]
    public async Task<ActionResult> RemoveEntryPoint(string id, string name)
    {
        var sessionId = SessionId.From(id);
        var session = await _sessionServer.GetAsync(sessionId);

        if (session == null)
            return NotFound(new { error = $"Session '{id}' not found" });

        if (!session.RemoveEntryPoint(name))
            return NotFound(new { error = $"Entry point '{name}' not found" });

        await _sessionServer.SaveAsync(session);
        _logger.LogInformation("Removed entry point '{Name}' from session {SessionId}", name, id);
        return NoContent();
    }

    /// <summary>
    /// Invoke an entry point on a session.
    /// </summary>
    [HttpPost("{id}/invoke/{entryPoint}")]
    public async Task<ActionResult> InvokeEntryPoint(string id, string entryPoint, [FromBody] InvokeEntryPointRequest? request = null)
    {
        var sessionId = SessionId.From(id);

        try
        {
            var result = await _sessionServer.InvokeEntryPointAsync(
                sessionId,
                entryPoint,
                request?.Inputs);

            _logger.LogInformation("Invoked entry point '{EntryPoint}' ({WorkflowId}) on session {SessionId}, invocation {InvocationId}",
                result.EntryPoint, result.WorkflowId, id, result.InvocationId);

            return Ok(new
            {
                entryPoint = result.EntryPoint,
                workflowId = result.WorkflowId,
                status = result.Status,
                invocationId = result.InvocationId
            });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to invoke entry point '{EntryPoint}' on session {SessionId}", entryPoint, id);
            return BadRequest(new { error = ex.Message });
        }
    }

    // ========== Widget Endpoints ==========

    /// <summary>
    /// Get all widgets for a session.
    /// </summary>
    [HttpGet("{id}/widgets")]
    public async Task<ActionResult<List<MonitorWidgetConfigDto>>> GetWidgets(string id)
    {
        var sessionId = SessionId.From(id);
        var session = await _sessionServer.GetAsync(sessionId);

        if (session == null)
            return NotFound(new { error = $"Session '{id}' not found" });

        var widgets = session.MonitorWidgets.Select(w => new MonitorWidgetConfigDto
        {
            Id = w.Id,
            Type = w.Type,
            Config = new Dictionary<string, object>(w.Config)
        }).ToList();

        return Ok(widgets);
    }

    /// <summary>
    /// Register a widget for a session.
    /// </summary>
    [HttpPost("{id}/widgets")]
    public async Task<ActionResult> RegisterWidget(string id, [FromBody] MonitorWidgetConfigDto request)
    {
        var sessionId = SessionId.From(id);
        var session = await _sessionServer.GetAsync(sessionId);

        if (session == null)
            return NotFound(new { error = $"Session '{id}' not found" });

        try
        {
            var widget = new Maestro.Domain.ValueObjects.MonitorWidgetConfig
            {
                Id = request.Id,
                Type = request.Type,
                Config = request.Config ?? new Dictionary<string, object>()
            };
            session.RegisterWidget(widget);
            await _sessionServer.SaveAsync(session);
            _logger.LogInformation("Registered widget '{WidgetId}' on session {SessionId}", request.Id, id);
            return Ok(request);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to register widget on session {SessionId}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Remove a widget from a session.
    /// </summary>
    [HttpDelete("{id}/widgets/{widgetId}")]
    public async Task<ActionResult> RemoveWidget(string id, string widgetId)
    {
        var sessionId = SessionId.From(id);
        var session = await _sessionServer.GetAsync(sessionId);

        if (session == null)
            return NotFound(new { error = $"Session '{id}' not found" });

        if (!session.RemoveWidget(widgetId))
            return NotFound(new { error = $"Widget '{widgetId}' not found" });

        await _sessionServer.SaveAsync(session);
        _logger.LogInformation("Removed widget '{WidgetId}' from session {SessionId}", widgetId, id);
        return NoContent();
    }
}

/// <summary>
/// Request to set a session variable.
/// </summary>
public record SetVariableRequest
{
    public required object Value { get; init; }
}

/// <summary>
/// Request to create a session.
/// </summary>
public record CreateInteractiveSessionRequest
{
    public string? Name { get; init; }
    public required string ProjectId { get; init; }
    public string Authority { get; init; } = "human";
    public string? WorkflowId { get; init; }
    public string? Task { get; init; }
    public string? Context { get; init; }
    public string Access { get; init; } = "controlled";
    public List<string>? AllowedPaths { get; init; }
    public List<string>? DeniedPaths { get; init; }
    public List<string>? Blocks { get; init; }
    public bool RunTests { get; init; }
    public string? TestCommand { get; init; }
    public bool RunLinter { get; init; }
    public string? LinterCommand { get; init; }
    public int MaxSteps { get; init; } = 50;
    public int TimeoutMs { get; init; } = 600000;
    public Dictionary<string, object>? Inputs { get; init; }
}

/// <summary>
/// Request to take control of a session.
/// </summary>
public record TakeControlRequest
{
    public string? Authority { get; init; }
}

/// <summary>
/// Request to execute a command.
/// </summary>
public record ExecuteCommandRequest
{
    public required string Command { get; init; }
    public Dictionary<string, object>? Args { get; init; }
}

/// <summary>
/// DTO for command result.
/// </summary>
public record CommandResultDto
{
    public string CommandId { get; init; } = string.Empty;
    public string Command { get; init; } = string.Empty;
    public string CommandType { get; init; } = "shell";
    public bool Success { get; init; }
    public string? Output { get; init; }
    public string? Error { get; init; }
    public int? ExitCode { get; init; }
    public long? DurationMs { get; init; }
}

/// <summary>
/// DTO for session event.
/// </summary>
public record SessionEventDto
{
    public string Id { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Source { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public DateTime Timestamp { get; init; }
    public long Sequence { get; init; }
    public Dictionary<string, object> Data { get; init; } = new();
}

/// <summary>
/// Request to register an entry point.
/// </summary>
public record RegisterEntryPointRequest
{
    public required string WorkflowId { get; init; }
}

/// <summary>
/// Request to invoke an entry point.
/// </summary>
public record InvokeEntryPointRequest
{
    public Dictionary<string, object>? Inputs { get; init; }
}

/// <summary>
/// DTO for monitor widget configuration.
/// </summary>
public record MonitorWidgetConfigDto
{
    public string Id { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public Dictionary<string, object>? Config { get; init; }
}
