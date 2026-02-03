using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Domain.Enums;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for session template operations.
/// Manages reusable presets for creating sessions.
/// </summary>
[ApiController]
[Route("api/session-templates")]
public class SessionTemplatesController : ControllerBase
{
    private readonly ISessionTemplateRepository _repository;
    private readonly ISandboxImageRepository _imageRepository;
    private readonly ILogger<SessionTemplatesController> _logger;

    public SessionTemplatesController(
        ISessionTemplateRepository repository,
        ISandboxImageRepository imageRepository,
        ILogger<SessionTemplatesController> logger)
    {
        _repository = repository;
        _imageRepository = imageRepository;
        _logger = logger;
    }

    /// <summary>
    /// List all session templates with optional filtering.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<SessionTemplateDto>>> GetAll(
        [FromQuery] string? source = null,
        [FromQuery] string? mode = null,
        [FromQuery] string? categoryId = null,
        [FromQuery] string? tags = null)
    {
        TemplateSource? sourceFilter = null;
        if (!string.IsNullOrEmpty(source))
        {
            var normalizedSource = source.Replace("-", "").Replace("_", "");
            if (Enum.TryParse<TemplateSource>(normalizedSource, ignoreCase: true, out var parsedSource))
            {
                sourceFilter = parsedSource;
            }
        }

        EnvironmentMode? modeFilter = null;
        if (!string.IsNullOrEmpty(mode) && Enum.TryParse<EnvironmentMode>(mode, ignoreCase: true, out var parsedMode))
        {
            modeFilter = parsedMode;
        }

        var tagList = !string.IsNullOrEmpty(tags)
            ? tags.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(t => t.Trim())
            : null;

        var templates = await _repository.GetAllAsync(sourceFilter, modeFilter, categoryId, tagList);
        var dtos = templates.Select(SessionTemplateDto.FromDomain).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Get built-in session templates only.
    /// </summary>
    [HttpGet("builtin")]
    public async Task<ActionResult<List<SessionTemplateDto>>> GetBuiltIn()
    {
        var templates = await _repository.GetBuiltInAsync();
        var dtos = templates.Select(SessionTemplateDto.FromDomain).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Get user-defined session templates only.
    /// </summary>
    [HttpGet("user")]
    public async Task<ActionResult<List<SessionTemplateDto>>> GetUserDefined()
    {
        var templates = await _repository.GetUserDefinedAsync();
        var dtos = templates.Select(SessionTemplateDto.FromDomain).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Get a session template by ID.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<SessionTemplateDto>> GetById(string id)
    {
        var template = await _repository.GetByIdAsync(id);

        if (template == null)
            return NotFound(new { error = $"Session template '{id}' not found" });

        return Ok(SessionTemplateDto.FromDomain(template));
    }

    /// <summary>
    /// Create a new user-defined session template.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<SessionTemplateDto>> Create([FromBody] CreateSessionTemplateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Id))
            return BadRequest(new { error = "Id is required" });

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Name is required" });

        if (string.IsNullOrWhiteSpace(request.SandboxImageId))
            return BadRequest(new { error = "SandboxImageId is required" });

        // Check for duplicate ID
        if (await _repository.ExistsAsync(request.Id))
            return Conflict(new { error = $"Session template with ID '{request.Id}' already exists" });

        // Validate sandbox image exists
        if (!await _imageRepository.ExistsAsync(request.SandboxImageId))
            return BadRequest(new { error = $"Sandbox image '{request.SandboxImageId}' not found" });

        try
        {
            var template = request.ToDomain();
            await _repository.SaveAsync(template);

            _logger.LogInformation("Created session template: {TemplateId}", template.Id);
            return CreatedAtAction(nameof(GetById), new { id = template.Id }, SessionTemplateDto.FromDomain(template));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create session template");
            return StatusCode(500, new { error = "Failed to create session template", details = ex.Message });
        }
    }

    /// <summary>
    /// Update a user-defined session template.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<SessionTemplateDto>> Update(string id, [FromBody] UpdateSessionTemplateRequest request)
    {
        var template = await _repository.GetByIdAsync(id);

        if (template == null)
            return NotFound(new { error = $"Session template '{id}' not found" });

        if (template.Source == TemplateSource.BuiltIn)
            return BadRequest(new { error = "Cannot modify built-in session templates" });

        // Validate sandbox image if changing
        if (!string.IsNullOrWhiteSpace(request.SandboxImageId) && !await _imageRepository.ExistsAsync(request.SandboxImageId))
            return BadRequest(new { error = $"Sandbox image '{request.SandboxImageId}' not found" });

        try
        {
            if (!string.IsNullOrWhiteSpace(request.Name)) template.Name = request.Name;
            if (request.Description != null) template.Description = request.Description;
            if (!string.IsNullOrWhiteSpace(request.Mode))
            {
                if (Enum.TryParse<EnvironmentMode>(request.Mode, ignoreCase: true, out var mode))
                    template.Mode = mode;
            }
            if (!string.IsNullOrWhiteSpace(request.SandboxImageId)) template.SandboxImageId = request.SandboxImageId;
            if (request.CategoryId != null) template.CategoryId = request.CategoryId;
            if (request.Tags != null) template.Tags = request.Tags;
            if (request.ResourceLimits != null) template.ResourceLimits = request.ResourceLimits.ToDomain();
            if (request.AccessConfig != null) template.AccessConfig = request.AccessConfig.ToDomain();
            if (request.DefaultEnvironment != null) template.DefaultEnvironment = request.DefaultEnvironment;
            if (request.WorkingDirectory != null) template.WorkingDirectory = request.WorkingDirectory;
            if (request.Icon != null) template.Icon = request.Icon;
            if (request.SortOrder.HasValue) template.SortOrder = request.SortOrder.Value;

            await _repository.SaveAsync(template);

            _logger.LogInformation("Updated session template: {TemplateId}", template.Id);
            return Ok(SessionTemplateDto.FromDomain(template));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update session template");
            return StatusCode(500, new { error = "Failed to update session template", details = ex.Message });
        }
    }

    /// <summary>
    /// Delete a user-defined session template.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(string id)
    {
        var template = await _repository.GetByIdAsync(id);

        if (template == null)
            return NotFound(new { error = $"Session template '{id}' not found" });

        if (template.Source == TemplateSource.BuiltIn)
            return BadRequest(new { error = "Cannot delete built-in session templates" });

        try
        {
            await _repository.DeleteAsync(id);
            _logger.LogInformation("Deleted session template: {TemplateId}", id);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete session template");
            return StatusCode(500, new { error = "Failed to delete session template", details = ex.Message });
        }
    }
}
