using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;

namespace Maestro.Api.Controllers;

/// <summary>
/// Controller for CLI command execution.
/// This is the main entry point for agents using the maestro-cli block.
/// </summary>
[ApiController]
[Route("api/cli")]
public class CliController : ControllerBase
{
    private readonly ICliExecutor _executor;
    private readonly ILogger<CliController> _logger;

    public CliController(
        ICliExecutor executor,
        ILogger<CliController> logger)
    {
        _executor = executor;
        _logger = logger;
    }

    /// <summary>
    /// Execute a CLI command.
    /// </summary>
    /// <param name="request">The CLI request containing command and context</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>CLI execution result</returns>
    [HttpPost("execute")]
    public async Task<ActionResult<CliResultDto>> Execute(
        [FromBody] CliRequestDto request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Command))
        {
            return BadRequest(new { error = "Command is required" });
        }

        var context = new CliExecutionContext
        {
            WorkspaceId = request.Context?.WorkspaceId,
            SessionId = request.Context?.SessionId,
            AgentId = request.Context?.AgentId
        };

        _logger.LogInformation(
            "CLI execute: command='{Command}', workspaceId={WorkspaceId}, sessionId={SessionId}",
            request.Command, context.WorkspaceId, context.SessionId);

        var result = await _executor.ExecuteAsync(request.Command, context, ct);

        return Ok(new CliResultDto
        {
            Success = result.Success,
            Output = result.Output,
            Error = result.Error,
            ExitCode = result.ExitCode
        });
    }

    /// <summary>
    /// Get available commands for a context.
    /// </summary>
    [HttpGet("commands")]
    public async Task<ActionResult<object>> GetCommands(
        [FromQuery] string? workspaceId,
        [FromQuery] string? sessionId,
        CancellationToken ct)
    {
        var context = new CliExecutionContext
        {
            WorkspaceId = workspaceId,
            SessionId = sessionId
        };

        // Execute help command to get available commands
        var result = await _executor.ExecuteAsync("help", context, ct);

        return Ok(result.Output);
    }
}

/// <summary>
/// DTO for CLI request.
/// </summary>
public class CliRequestDto
{
    /// <summary>
    /// The command to execute (without 'maestro' prefix).
    /// </summary>
    public string Command { get; set; } = string.Empty;

    /// <summary>
    /// Execution context (workspace, session, agent).
    /// </summary>
    public CliContextDto? Context { get; set; }
}

/// <summary>
/// DTO for execution context.
/// </summary>
public class CliContextDto
{
    public string? WorkspaceId { get; set; }
    public string? SessionId { get; set; }
    public string? AgentId { get; set; }
}

/// <summary>
/// DTO for CLI result.
/// </summary>
public class CliResultDto
{
    public bool Success { get; set; }
    public object? Output { get; set; }
    public string? Error { get; set; }
    public int ExitCode { get; set; }
}
