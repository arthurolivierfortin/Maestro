using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

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
                request.RepositoryPath,
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

    // ====== Context Permissions Endpoints ======

    /// <summary>
    /// Get permissions for a workspace context.
    /// </summary>
    [HttpGet("{id}/permissions")]
    public async Task<ActionResult<ContextPermissionsDto>> GetPermissions(
        string id,
        CancellationToken ct)
    {
        var workspace = await _workspaceService.GetWorkspaceAsync(id, ct);
        if (workspace == null)
        {
            return NotFound(new { error = $"Workspace '{id}' not found" });
        }

        return Ok(ContextPermissionsDto.FromDomain(workspace.Permissions));
    }

    /// <summary>
    /// Update permissions for a workspace context.
    /// </summary>
    [HttpPut("{id}/permissions")]
    public async Task<ActionResult<WorkspaceDto>> UpdatePermissions(
        string id,
        [FromBody] ContextPermissionsDto request,
        CancellationToken ct)
    {
        try
        {
            var workspace = await _workspaceService.GetWorkspaceAsync(id, ct);
            if (workspace == null)
            {
                return NotFound(new { error = $"Workspace '{id}' not found" });
            }

            workspace.UpdatePermissions(request.ToDomain());
            _logger.LogInformation("Updated permissions for workspace {Id}", id);
            return Ok(WorkspaceDto.FromDomain(workspace));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update permissions for workspace {Id}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    // ====== Session Templates Endpoints ======

    /// <summary>
    /// Get all session templates for a workspace.
    /// </summary>
    [HttpGet("{id}/session-templates")]
    public async Task<ActionResult<Dictionary<string, SessionTemplateDto>>> GetSessionTemplates(
        string id,
        CancellationToken ct)
    {
        var workspace = await _workspaceService.GetWorkspaceAsync(id, ct);
        if (workspace == null)
        {
            return NotFound(new { error = $"Workspace '{id}' not found" });
        }

        var templates = workspace.SessionTemplates.ToDictionary(
            kvp => kvp.Key,
            kvp => SessionTemplateDto.FromDomain(kvp.Value));
        return Ok(templates);
    }

    /// <summary>
    /// Get a specific session template.
    /// </summary>
    [HttpGet("{id}/session-templates/{templateType}")]
    public async Task<ActionResult<SessionTemplateDto>> GetSessionTemplate(
        string id,
        string templateType,
        CancellationToken ct)
    {
        var workspace = await _workspaceService.GetWorkspaceAsync(id, ct);
        if (workspace == null)
        {
            return NotFound(new { error = $"Workspace '{id}' not found" });
        }

        var template = workspace.GetSessionTemplate(templateType);
        if (template == null)
        {
            return NotFound(new { error = $"Session template '{templateType}' not found" });
        }

        return Ok(SessionTemplateDto.FromDomain(template));
    }

    /// <summary>
    /// Set or update a session template.
    /// </summary>
    [HttpPut("{id}/session-templates/{templateType}")]
    public async Task<ActionResult<WorkspaceDto>> SetSessionTemplate(
        string id,
        string templateType,
        [FromBody] SessionTemplateDto template,
        CancellationToken ct)
    {
        try
        {
            var workspace = await _workspaceService.GetWorkspaceAsync(id, ct);
            if (workspace == null)
            {
                return NotFound(new { error = $"Workspace '{id}' not found" });
            }

            workspace.SetSessionTemplate(templateType, template.ToDomain());
            _logger.LogInformation("Set session template '{Template}' for workspace {Id}", templateType, id);
            return Ok(WorkspaceDto.FromDomain(workspace));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to set session template for workspace {Id}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Delete a session template.
    /// </summary>
    [HttpDelete("{id}/session-templates/{templateType}")]
    public async Task<ActionResult<WorkspaceDto>> DeleteSessionTemplate(
        string id,
        string templateType,
        CancellationToken ct)
    {
        try
        {
            var workspace = await _workspaceService.GetWorkspaceAsync(id, ct);
            if (workspace == null)
            {
                return NotFound(new { error = $"Workspace '{id}' not found" });
            }

            workspace.RemoveSessionTemplate(templateType);
            _logger.LogInformation("Removed session template '{Template}' from workspace {Id}", templateType, id);
            return Ok(WorkspaceDto.FromDomain(workspace));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to remove session template from workspace {Id}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    // ====== Entry Points Endpoints ======

    /// <summary>
    /// Get all entry points for a workspace.
    /// </summary>
    [HttpGet("{id}/entry-points")]
    public async Task<ActionResult<Dictionary<string, string>>> GetEntryPoints(
        string id,
        CancellationToken ct)
    {
        var workspace = await _workspaceService.GetWorkspaceAsync(id, ct);
        if (workspace == null)
        {
            return NotFound(new { error = $"Workspace '{id}' not found" });
        }

        return Ok(workspace.EntryPoints);
    }

    /// <summary>
    /// Set or update an entry point.
    /// </summary>
    [HttpPut("{id}/entry-points/{name}")]
    public async Task<ActionResult<WorkspaceDto>> SetEntryPoint(
        string id,
        string name,
        [FromBody] SetEntryPointRequest request,
        CancellationToken ct)
    {
        try
        {
            var workspace = await _workspaceService.GetWorkspaceAsync(id, ct);
            if (workspace == null)
            {
                return NotFound(new { error = $"Workspace '{id}' not found" });
            }

            workspace.SetEntryPoint(name, request.BlockId);
            _logger.LogInformation("Set entry point '{Name}' to block '{BlockId}' for workspace {Id}",
                name, request.BlockId, id);
            return Ok(WorkspaceDto.FromDomain(workspace));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to set entry point for workspace {Id}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Delete an entry point.
    /// </summary>
    [HttpDelete("{id}/entry-points/{name}")]
    public async Task<ActionResult<WorkspaceDto>> DeleteEntryPoint(
        string id,
        string name,
        CancellationToken ct)
    {
        try
        {
            var workspace = await _workspaceService.GetWorkspaceAsync(id, ct);
            if (workspace == null)
            {
                return NotFound(new { error = $"Workspace '{id}' not found" });
            }

            workspace.RemoveEntryPoint(name);
            _logger.LogInformation("Removed entry point '{Name}' from workspace {Id}", name, id);
            return Ok(WorkspaceDto.FromDomain(workspace));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to remove entry point from workspace {Id}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    // ====== Workspace Load/Validate Endpoints ======

    /// <summary>
    /// Load a workspace from a filesystem path.
    /// </summary>
    [HttpPost("load")]
    public async Task<ActionResult<WorkspaceDto>> LoadFromPath(
        [FromBody] LoadWorkspaceRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Path))
        {
            return BadRequest(new { error = "Path is required" });
        }

        try
        {
            // This would need to be implemented in the service
            // For now, return not implemented
            _logger.LogInformation("Load workspace from path requested: {Path}", request.Path);
            return StatusCode(501, new { error = "Load from path not yet implemented" });
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load workspace from path {Path}", request.Path);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Validate a workspace structure.
    /// </summary>
    [HttpPost("{id}/validate")]
    public async Task<ActionResult<WorkspaceValidationResult>> ValidateWorkspace(
        string id,
        CancellationToken ct)
    {
        var workspace = await _workspaceService.GetWorkspaceAsync(id, ct);
        if (workspace == null)
        {
            return NotFound(new { error = $"Workspace '{id}' not found" });
        }

        var result = new WorkspaceValidationResult
        {
            IsValid = true,
            Errors = new List<string>(),
            Warnings = new List<string>()
        };

        // Validate path exists
        if (!string.IsNullOrEmpty(workspace.Path) && !Directory.Exists(workspace.Path))
        {
            result.Errors.Add($"Workspace path does not exist: {workspace.Path}");
            result.IsValid = false;
        }

        // Validate required directories exist
        if (!string.IsNullOrEmpty(workspace.Path))
        {
            var blocksPath = Path.Combine(workspace.Path, "blocks");
            var dataPath = Path.Combine(workspace.Path, "data");

            if (!Directory.Exists(blocksPath))
            {
                result.Warnings.Add($"Blocks directory not found: {blocksPath}");
            }
            if (!Directory.Exists(dataPath))
            {
                result.Warnings.Add($"Data directory not found: {dataPath}");
            }
        }

        // Validate entry points reference existing blocks (placeholder)
        foreach (var (name, blockId) in workspace.EntryPoints)
        {
            result.Warnings.Add($"Entry point '{name}' -> '{blockId}' (block existence not verified)");
        }

        // Validate session templates have valid permissions
        foreach (var (type, template) in workspace.SessionTemplates)
        {
            if (template.Permissions.AllowedCommands.Count == 0 &&
                template.Permissions.AllowedTools.Count == 0)
            {
                result.Warnings.Add($"Session template '{type}' has no allowed commands or tools");
            }
        }

        _logger.LogInformation("Validated workspace {Id}: IsValid={IsValid}", id, result.IsValid);
        return Ok(result);
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

public class SetEntryPointRequest
{
    public string BlockId { get; set; } = string.Empty;
}
