using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for project CRUD operations.
/// Manages isolated execution units containing blocks and workflows.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ProjectsController : ControllerBase
{
    private readonly IProjectRepository _projectRepository;
    private readonly IBlockDiscoveryService _blockDiscovery;
    private readonly IProjectContainerService _containerService;
    private readonly ILogger<ProjectsController> _logger;

    public ProjectsController(
        IProjectRepository projectRepository,
        IBlockDiscoveryService blockDiscovery,
        IProjectContainerService containerService,
        ILogger<ProjectsController> logger)
    {
        _projectRepository = projectRepository;
        _blockDiscovery = blockDiscovery;
        _containerService = containerService;
        _logger = logger;
    }

    /// <summary>
    /// List all discovered projects.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<ProjectDto>>> GetProjects()
    {
        var projects = await _projectRepository.GetAllAsync();
        var dtos = projects.Select(p => ProjectDto.FromDomain(p)).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Get a single project by ID.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ProjectDto>> GetById(string id)
    {
        if (!Guid.TryParse(id, out var guid))
            return BadRequest(new { error = "Invalid project ID format" });

        var projectId = ProjectId.From(guid);
        var project = await _projectRepository.GetByIdAsync(projectId);
        
        if (project == null)
            return NotFound(new { error = $"Project '{id}' not found" });

        var dto = ProjectDto.FromDomain(project);
        return Ok(dto);
    }

    /// <summary>
    /// Create a new project.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ProjectDto>> Create([FromBody] CreateProjectRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Name is required" });
        
        if (string.IsNullOrWhiteSpace(request.RootPath))
            return BadRequest(new { error = "RootPath is required" });

        // Check if path exists
        if (!Directory.Exists(request.RootPath))
        {
            try
            {
                Directory.CreateDirectory(request.RootPath);
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = $"Cannot create directory: {ex.Message}" });
            }
        }

        // Check if project already exists at this path
        var existing = await _projectRepository.GetByPathAsync(request.RootPath);
        if (existing != null)
            return Conflict(new { error = $"A project already exists at '{request.RootPath}'" });

        // Create project entity
        var project = Project.Create(
            ProjectId.New(),
            request.Name,
            Path.GetFullPath(request.RootPath),
            request.Description);

        if (request.Runtime != null)
            project.Runtime = request.Runtime.ToDomain();

        // Save project (this creates .maestro folder and project.json)
        await _projectRepository.SaveAsync(project);

        _logger.LogInformation("Created project {Name} at {Path}", project.Name, project.RootPath);

        var dto = ProjectDto.FromDomain(project);
        return CreatedAtAction(nameof(GetById), new { id = project.Id.ToString() }, dto);
    }

    /// <summary>
    /// Update an existing project.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<ProjectDto>> Update(string id, [FromBody] UpdateProjectRequest request)
    {
        if (!Guid.TryParse(id, out var guid))
            return BadRequest(new { error = "Invalid project ID format" });

        var projectId = ProjectId.From(guid);
        var project = await _projectRepository.GetByIdAsync(projectId);
        
        if (project == null)
            return NotFound(new { error = $"Project '{id}' not found" });

        // Update properties
        if (!string.IsNullOrEmpty(request.Name))
            project.Name = request.Name;

        if (request.Description != null)
            project.Description = request.Description;

        if (request.Runtime != null)
            project.Runtime = request.Runtime.ToDomain();

        if (request.DefaultModel != null)
            project.DefaultModel = request.DefaultModel;

        project.MarkUpdated();

        await _projectRepository.SaveAsync(project);

        _logger.LogInformation("Updated project {Id}", id);

        var dto = ProjectDto.FromDomain(project);
        return Ok(dto);
    }

    /// <summary>
    /// Delete a project.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(string id)
    {
        if (!Guid.TryParse(id, out var guid))
            return BadRequest(new { error = "Invalid project ID format" });

        var projectId = ProjectId.From(guid);
        var project = await _projectRepository.GetByIdAsync(projectId);
        
        if (project == null)
            return NotFound(new { error = $"Project '{id}' not found" });

        await _projectRepository.DeleteAsync(projectId);

        _logger.LogInformation("Deleted project {Id}", id);

        return NoContent();
    }

    /// <summary>
    /// Bind (initialize) an existing directory as a Maestro project.
    /// Creates the .maestro folder structure if it doesn't exist.
    /// </summary>
    [HttpPost("bind")]
    public async Task<ActionResult<ProjectDto>> BindProject([FromBody] BindProjectRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RootPath))
            return BadRequest(new { error = "RootPath is required" });

        var fullPath = Path.GetFullPath(request.RootPath);

        // Check if directory exists
        if (!Directory.Exists(fullPath))
            return BadRequest(new { error = $"Directory does not exist: '{fullPath}'" });

        // Check if project already exists at this path
        var existing = await _projectRepository.GetByPathAsync(fullPath);
        if (existing != null)
        {
            var existingDto = ProjectDto.FromDomain(existing);
            return Ok(existingDto);
        }

        // Determine project name from request or directory name
        var projectName = !string.IsNullOrWhiteSpace(request.Name)
            ? request.Name
            : Path.GetFileName(fullPath) ?? "Unnamed Project";

        // Create project entity
        var project = Project.Create(
            ProjectId.New(),
            projectName,
            fullPath,
            request.Description);

        if (request.Runtime != null)
            project.Runtime = request.Runtime.ToDomain();

        if (!string.IsNullOrEmpty(request.DefaultModel))
            project.DefaultModel = request.DefaultModel;

        // Save project (this creates .maestro folder structure and project.json)
        await _projectRepository.SaveAsync(project);

        _logger.LogInformation("Bound project {Name} at {Path}", project.Name, project.RootPath);

        var dto = ProjectDto.FromDomain(project);
        return CreatedAtAction(nameof(GetById), new { id = project.Id.ToString() }, dto);
    }

    /// <summary>
    /// Open an existing project by path.
    /// </summary>
    [HttpPost("open")]
    public async Task<ActionResult<ProjectDto>> OpenProject([FromBody] OpenProjectRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RootPath))
            return BadRequest(new { error = "RootPath is required" });

        var fullPath = Path.GetFullPath(request.RootPath);

        // Check if project already discovered
        var existing = await _projectRepository.GetByPathAsync(fullPath);
        if (existing != null)
        {
            var existingDto = ProjectDto.FromDomain(existing);
            return Ok(existingDto);
        }

        // Check if .maestro/project.json exists
        var configPath = Path.Combine(fullPath, ".maestro", "project.json");
        if (!System.IO.File.Exists(configPath))
        {
            return NotFound(new { error = $"No project found at '{fullPath}'. Create a project first." });
        }

        // Trigger discovery for this path
        await _projectRepository.DiscoverProjectsAsync(new[] { fullPath });

        var project = await _projectRepository.GetByPathAsync(fullPath);
        if (project == null)
            return NotFound(new { error = $"Failed to load project at '{fullPath}'" });

        _logger.LogInformation("Opened project {Name} at {Path}", project.Name, project.RootPath);

        var dto = ProjectDto.FromDomain(project);
        return Ok(dto);
    }

    /// <summary>
    /// Get blocks for a specific project.
    /// </summary>
    [HttpGet("{id}/blocks")]
    public async Task<ActionResult<List<BlockDto>>> GetProjectBlocks(string id)
    {
        if (!Guid.TryParse(id, out var guid))
            return BadRequest(new { error = "Invalid project ID format" });

        var projectId = ProjectId.From(guid);
        var project = await _projectRepository.GetByIdAsync(projectId);
        
        if (project == null)
            return NotFound(new { error = $"Project '{id}' not found" });

        // For now, filter blocks by checking if their source path is within the project
        var allBlocks = await _blockDiscovery.DiscoverAllAsync();
        var projectBlocks = allBlocks.Where(b =>
        {
            if (b.Metadata?.TryGetValue("_sourcePath", out var sourcePath) == true)
            {
                var path = sourcePath?.ToString();
                return path != null && path.StartsWith(project.RootPath, StringComparison.OrdinalIgnoreCase);
            }
            return false;
        });

        var dtos = projectBlocks.Select(b => BlockDto.FromDomain(b)).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Discover projects in the default search paths.
    /// </summary>
    [HttpPost("discover")]
    public async Task<ActionResult<List<ProjectDto>>> DiscoverProjects()
    {
        // Re-scan for projects
        var discovered = await _projectRepository.DiscoverProjectsAsync(Array.Empty<string>());
        var dtos = discovered.Select(p => ProjectDto.FromDomain(p)).ToList();

        _logger.LogInformation("Discovered {Count} projects", dtos.Count);

        return Ok(dtos);
    }

    // ==================== Container Management ====================

    /// <summary>
    /// Get container status for a project.
    /// </summary>
    [HttpGet("{id}/status")]
    public async Task<ActionResult<ContainerStateDto>> GetProjectStatus(string id)
    {
        if (!Guid.TryParse(id, out var guid))
            return BadRequest(new { error = "Invalid project ID format" });

        var projectId = ProjectId.From(guid);
        var state = await _containerService.GetStateAsync(projectId);
        return Ok(ContainerStateDto.FromDomain(state));
    }

    /// <summary>
    /// Start the container for a project.
    /// </summary>
    [HttpPost("{id}/start")]
    public async Task<ActionResult<ContainerStateDto>> StartProject(string id)
    {
        if (!Guid.TryParse(id, out var guid))
            return BadRequest(new { error = "Invalid project ID format" });

        var projectId = ProjectId.From(guid);

        try
        {
            var state = await _containerService.StartAsync(projectId);
            _logger.LogInformation("Started container for project {Id}", id);
            return Ok(ContainerStateDto.FromDomain(state));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to start container for project {Id}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Stop the container for a project.
    /// </summary>
    [HttpPost("{id}/stop")]
    public async Task<ActionResult<ContainerStateDto>> StopProject(string id)
    {
        if (!Guid.TryParse(id, out var guid))
            return BadRequest(new { error = "Invalid project ID format" });

        var projectId = ProjectId.From(guid);

        try
        {
            var state = await _containerService.StopAsync(projectId);
            _logger.LogInformation("Stopped container for project {Id}", id);
            return Ok(ContainerStateDto.FromDomain(state));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to stop container for project {Id}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Restart the container for a project.
    /// </summary>
    [HttpPost("{id}/restart")]
    public async Task<ActionResult<ContainerStateDto>> RestartProject(string id)
    {
        if (!Guid.TryParse(id, out var guid))
            return BadRequest(new { error = "Invalid project ID format" });

        var projectId = ProjectId.From(guid);

        try
        {
            var state = await _containerService.RestartAsync(projectId);
            _logger.LogInformation("Restarted container for project {Id}", id);
            return Ok(ContainerStateDto.FromDomain(state));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to restart container for project {Id}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get container logs for a project.
    /// </summary>
    [HttpGet("{id}/logs")]
    public async Task<ActionResult<LogsResponse>> GetProjectLogs(string id, [FromQuery] int? tail = 100)
    {
        if (!Guid.TryParse(id, out var guid))
            return BadRequest(new { error = "Invalid project ID format" });

        var projectId = ProjectId.From(guid);
        var logs = await _containerService.GetLogsAsync(projectId, tail);
        return Ok(new LogsResponse { Logs = logs });
    }

    // ==================== File Access Rules ====================

    /// <summary>
    /// Get file access rules for a project.
    /// </summary>
    [HttpGet("{id}/file-rules")]
    public async Task<ActionResult<List<FileAccessRuleDto>>> GetFileAccessRules(string id)
    {
        if (!Guid.TryParse(id, out var guid))
            return BadRequest(new { error = "Invalid project ID format" });

        var projectId = ProjectId.From(guid);
        var project = await _projectRepository.GetByIdAsync(projectId);

        if (project == null)
            return NotFound(new { error = $"Project '{id}' not found" });

        var dtos = project.FileAccessRules.Select(FileAccessRuleDto.FromDomain).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Update file access rules for a project.
    /// </summary>
    [HttpPut("{id}/file-rules")]
    public async Task<ActionResult<List<FileAccessRuleDto>>> UpdateFileAccessRules(
        string id,
        [FromBody] UpdateFileAccessRulesRequest request)
    {
        if (!Guid.TryParse(id, out var guid))
            return BadRequest(new { error = "Invalid project ID format" });

        var projectId = ProjectId.From(guid);
        var project = await _projectRepository.GetByIdAsync(projectId);

        if (project == null)
            return NotFound(new { error = $"Project '{id}' not found" });

        project.FileAccessRules = request.Rules.Select(r => r.ToDomain()).ToList();
        project.MarkUpdated();

        await _projectRepository.SaveAsync(project);

        _logger.LogInformation("Updated file access rules for project {Id}", id);

        var dtos = project.FileAccessRules.Select(FileAccessRuleDto.FromDomain).ToList();
        return Ok(dtos);
    }

    // ==================== Block Permissions ====================

    /// <summary>
    /// Get block permissions for a project.
    /// </summary>
    [HttpGet("{id}/block-permissions")]
    public async Task<ActionResult<List<BlockPermissionDto>>> GetBlockPermissions(string id)
    {
        if (!Guid.TryParse(id, out var guid))
            return BadRequest(new { error = "Invalid project ID format" });

        var projectId = ProjectId.From(guid);
        var project = await _projectRepository.GetByIdAsync(projectId);

        if (project == null)
            return NotFound(new { error = $"Project '{id}' not found" });

        var dtos = project.BlockPermissions.Select(BlockPermissionDto.FromDomain).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Update block permissions for a project.
    /// </summary>
    [HttpPut("{id}/block-permissions")]
    public async Task<ActionResult<List<BlockPermissionDto>>> UpdateBlockPermissions(
        string id,
        [FromBody] UpdateBlockPermissionsRequest request)
    {
        if (!Guid.TryParse(id, out var guid))
            return BadRequest(new { error = "Invalid project ID format" });

        var projectId = ProjectId.From(guid);
        var project = await _projectRepository.GetByIdAsync(projectId);

        if (project == null)
            return NotFound(new { error = $"Project '{id}' not found" });

        project.BlockPermissions = request.Permissions.Select(p => p.ToDomain()).ToList();
        project.MarkUpdated();

        await _projectRepository.SaveAsync(project);

        _logger.LogInformation("Updated block permissions for project {Id}", id);

        var dtos = project.BlockPermissions.Select(BlockPermissionDto.FromDomain).ToList();
        return Ok(dtos);
    }
}
