using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Domain.Entities;

namespace Maestro.Api.Controllers;

/// <summary>
/// Controller for workspace management.
/// </summary>
[ApiController]
[Route("api/workspaces")]
public class WorkspacesController : ControllerBase
{
    private readonly IWorkspaceService _workspaceService;
    private readonly IWorkspaceGateway _workspaceGateway;
    private readonly ILogger<WorkspacesController> _logger;

    public WorkspacesController(
        IWorkspaceService workspaceService,
        IWorkspaceGateway workspaceGateway,
        ILogger<WorkspacesController> logger)
    {
        _workspaceService = workspaceService;
        _workspaceGateway = workspaceGateway;
        _logger = logger;
    }

    /// <summary>
    /// Get all workspaces.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<WorkspaceDto>>> GetWorkspaces(
        [FromQuery] string? type = null,
        CancellationToken ct = default)
    {
        IReadOnlyList<Workspace> workspaces;

        if (!string.IsNullOrEmpty(type) && Enum.TryParse<WorkspaceType>(type, true, out var workspaceType))
        {
            workspaces = await _workspaceService.GetWorkspacesByTypeAsync(workspaceType, ct);
        }
        else
        {
            workspaces = await _workspaceService.GetAllWorkspacesAsync(ct);
        }

        return Ok(workspaces.Select(WorkspaceDto.FromDomain));
    }

    /// <summary>
    /// Get a workspace by ID.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<WorkspaceDto>> GetWorkspace(string id, CancellationToken ct)
    {
        var workspace = await _workspaceService.GetWorkspaceAsync(id, ct);
        if (workspace == null)
        {
            return NotFound(new { error = $"Workspace '{id}' not found" });
        }
        return Ok(WorkspaceDto.FromDomain(workspace));
    }

    /// <summary>
    /// Create a new workspace.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<WorkspaceDto>> CreateWorkspace(
        [FromBody] CreateWorkspaceRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { error = "Workspace name is required" });
        }

        if (!Enum.TryParse<WorkspaceType>(request.Type, true, out var type))
        {
            return BadRequest(new { error = $"Invalid workspace type: {request.Type}" });
        }

        try
        {
            var workspace = await _workspaceService.CreateWorkspaceAsync(
                request.Name,
                type,
                request.Description,
                request.Isolated,
                request.IsolationConfig?.ToDomain(),
                ct);

            _logger.LogInformation("Created workspace {Id}: {Name}", workspace.Id, workspace.Name);
            return CreatedAtAction(nameof(GetWorkspace), new { id = workspace.Id }, WorkspaceDto.FromDomain(workspace));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create workspace");
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Update a workspace.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<WorkspaceDto>> UpdateWorkspace(
        string id,
        [FromBody] UpdateWorkspaceRequest request,
        CancellationToken ct)
    {
        try
        {
            var workspace = await _workspaceService.UpdateWorkspaceAsync(
                id,
                request.Name,
                request.Description,
                request.Settings?.ToDomain(),
                ct);

            if (request.Isolation != null)
            {
                workspace = await _workspaceService.UpdateIsolationAsync(id, request.Isolation.ToDomain(), ct);
            }

            _logger.LogInformation("Updated workspace {Id}", id);
            return Ok(WorkspaceDto.FromDomain(workspace));
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update workspace {Id}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Delete a workspace.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteWorkspace(string id, CancellationToken ct)
    {
        try
        {
            await _workspaceService.DeleteWorkspaceAsync(id, ct);
            _logger.LogInformation("Deleted workspace {Id}", id);
            return Ok(new { message = $"Workspace '{id}' deleted" });
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Add a session to a workspace.
    /// </summary>
    [HttpPost("{id}/sessions")]
    public async Task<ActionResult<WorkspaceDto>> AddSession(
        string id,
        [FromBody] AddSessionRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.SessionId))
        {
            return BadRequest(new { error = "Session ID is required" });
        }

        try
        {
            var workspace = await _workspaceService.AddSessionAsync(id, request.SessionId, ct);
            return Ok(WorkspaceDto.FromDomain(workspace));
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Remove a session from a workspace.
    /// </summary>
    [HttpDelete("{id}/sessions/{sessionId}")]
    public async Task<ActionResult<WorkspaceDto>> RemoveSession(
        string id,
        string sessionId,
        CancellationToken ct)
    {
        try
        {
            var workspace = await _workspaceService.RemoveSessionAsync(id, sessionId, ct);
            return Ok(WorkspaceDto.FromDomain(workspace));
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Add a project to a workspace.
    /// </summary>
    [HttpPost("{id}/projects")]
    public async Task<ActionResult<WorkspaceDto>> AddProject(
        string id,
        [FromBody] AddProjectRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectId))
        {
            return BadRequest(new { error = "Project ID is required" });
        }

        try
        {
            var workspace = await _workspaceService.AddProjectAsync(id, request.ProjectId, ct);
            return Ok(WorkspaceDto.FromDomain(workspace));
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Remove a project from a workspace.
    /// </summary>
    [HttpDelete("{id}/projects/{projectId}")]
    public async Task<ActionResult<WorkspaceDto>> RemoveProject(
        string id,
        string projectId,
        CancellationToken ct)
    {
        try
        {
            var workspace = await _workspaceService.RemoveProjectAsync(id, projectId, ct);
            return Ok(WorkspaceDto.FromDomain(workspace));
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Pause a workspace.
    /// </summary>
    [HttpPost("{id}/pause")]
    public async Task<ActionResult<WorkspaceDto>> PauseWorkspace(string id, CancellationToken ct)
    {
        try
        {
            var workspace = await _workspaceService.PauseWorkspaceAsync(id, ct);
            return Ok(WorkspaceDto.FromDomain(workspace));
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Resume a workspace.
    /// </summary>
    [HttpPost("{id}/resume")]
    public async Task<ActionResult<WorkspaceDto>> ResumeWorkspace(string id, CancellationToken ct)
    {
        try
        {
            var workspace = await _workspaceService.ResumeWorkspaceAsync(id, ct);
            return Ok(WorkspaceDto.FromDomain(workspace));
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Archive a workspace.
    /// </summary>
    [HttpPost("{id}/archive")]
    public async Task<ActionResult<WorkspaceDto>> ArchiveWorkspace(string id, CancellationToken ct)
    {
        try
        {
            var workspace = await _workspaceService.ArchiveWorkspaceAsync(id, ct);
            return Ok(WorkspaceDto.FromDomain(workspace));
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get workspace topology.
    /// </summary>
    [HttpGet("topology")]
    public async Task<ActionResult<WorkspaceTopologyDto>> GetTopology(CancellationToken ct)
    {
        var topology = await _workspaceService.GetTopologyAsync(ct);
        return Ok(new WorkspaceTopologyDto
        {
            Nodes = topology.Nodes.Select(n => new WorkspaceNodeDto
            {
                WorkspaceId = n.WorkspaceId,
                Name = n.Name,
                Type = n.Type.ToString(),
                SessionCount = n.SessionCount,
                ProjectCount = n.ProjectCount,
                IsIsolated = n.IsIsolated
            }).ToList(),
            Edges = topology.Edges.Select(e => new WorkspaceEdgeDto
            {
                SourceWorkspaceId = e.SourceWorkspaceId,
                TargetWorkspaceId = e.TargetWorkspaceId,
                EdgeType = e.EdgeType
            }).ToList()
        });
    }

    /// <summary>
    /// Promote an agent between workspaces.
    /// </summary>
    [HttpPost("{sourceId}/promote")]
    public async Task<ActionResult<PromotionResultDto>> PromoteAgent(
        string sourceId,
        [FromBody] PromoteAgentRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.TargetWorkspaceId))
        {
            return BadRequest(new { error = "Target workspace ID is required" });
        }

        if (string.IsNullOrWhiteSpace(request.AgentBlockId))
        {
            return BadRequest(new { error = "Agent block ID is required" });
        }

        var result = await _workspaceGateway.PromoteAgentAsync(
            sourceId,
            request.TargetWorkspaceId,
            request.AgentBlockId,
            request.Version,
            ct);

        return Ok(new PromotionResultDto
        {
            Success = result.Success,
            PromotedBlockId = result.PromotedBlockId,
            TargetVersion = result.TargetVersion,
            ErrorMessage = result.ErrorMessage,
            AuditLogId = result.AuditLogId
        });
    }
}

public class AddSessionRequest
{
    public string SessionId { get; set; } = string.Empty;
}

public class AddProjectRequest
{
    public string ProjectId { get; set; } = string.Empty;
}

public class PromoteAgentRequest
{
    public string TargetWorkspaceId { get; set; } = string.Empty;
    public string AgentBlockId { get; set; } = string.Empty;
    public string? Version { get; set; }
}

public class PromotionResultDto
{
    public bool Success { get; set; }
    public string? PromotedBlockId { get; set; }
    public string? TargetVersion { get; set; }
    public string? ErrorMessage { get; set; }
    public string? AuditLogId { get; set; }
}
