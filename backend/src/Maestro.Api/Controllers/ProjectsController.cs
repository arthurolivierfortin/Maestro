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
    private readonly ILogger<ProjectsController> _logger;

    public ProjectsController(
        IProjectRepository projectRepository,
        IBlockDiscoveryService blockDiscovery,
        ILogger<ProjectsController> logger)
    {
        _projectRepository = projectRepository;
        _blockDiscovery = blockDiscovery;
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
}
