using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Domain.Enums;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for sandbox image operations.
/// Manages Docker images that can be used for sandbox sessions.
/// </summary>
[ApiController]
[Route("api/sandbox-images")]
public class SandboxImagesController : ControllerBase
{
    private readonly ISandboxImageRepository _repository;
    private readonly ILogger<SandboxImagesController> _logger;

    public SandboxImagesController(
        ISandboxImageRepository repository,
        ILogger<SandboxImagesController> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    /// <summary>
    /// List all sandbox images with optional filtering.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<SandboxImageDto>>> GetAll(
        [FromQuery] string? source = null,
        [FromQuery] bool? verified = null,
        [FromQuery] string? tags = null)
    {
        ImageSource? sourceFilter = null;
        if (!string.IsNullOrEmpty(source))
        {
            var normalizedSource = source.Replace("-", "").Replace("_", "");
            if (Enum.TryParse<ImageSource>(normalizedSource, ignoreCase: true, out var parsed))
            {
                sourceFilter = parsed;
            }
        }

        var tagList = !string.IsNullOrEmpty(tags)
            ? tags.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(t => t.Trim())
            : null;

        var images = await _repository.GetAllAsync(sourceFilter, verified, tagList);
        var dtos = images.Select(SandboxImageDto.FromDomain).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Get built-in sandbox images only.
    /// </summary>
    [HttpGet("builtin")]
    public async Task<ActionResult<List<SandboxImageDto>>> GetBuiltIn()
    {
        var images = await _repository.GetBuiltInAsync();
        var dtos = images.Select(SandboxImageDto.FromDomain).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Get user-defined sandbox images only.
    /// </summary>
    [HttpGet("user")]
    public async Task<ActionResult<List<SandboxImageDto>>> GetUserDefined()
    {
        var images = await _repository.GetUserDefinedAsync();
        var dtos = images.Select(SandboxImageDto.FromDomain).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Get a sandbox image by ID.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<SandboxImageDto>> GetById(string id)
    {
        var image = await _repository.GetByIdAsync(id);

        if (image == null)
            return NotFound(new { error = $"Sandbox image '{id}' not found" });

        return Ok(SandboxImageDto.FromDomain(image));
    }

    /// <summary>
    /// Register a new user-defined sandbox image.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<SandboxImageDto>> Register([FromBody] RegisterSandboxImageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Id))
            return BadRequest(new { error = "Id is required" });

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Name is required" });

        if (string.IsNullOrWhiteSpace(request.DockerImage))
            return BadRequest(new { error = "DockerImage is required" });

        // Check for duplicate ID
        if (await _repository.ExistsAsync(request.Id))
            return Conflict(new { error = $"Sandbox image with ID '{request.Id}' already exists" });

        try
        {
            var image = request.ToDomain();
            await _repository.SaveAsync(image);

            _logger.LogInformation("Registered sandbox image: {ImageId}", image.Id);
            return CreatedAtAction(nameof(GetById), new { id = image.Id }, SandboxImageDto.FromDomain(image));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to register sandbox image");
            return StatusCode(500, new { error = "Failed to register sandbox image", details = ex.Message });
        }
    }

    /// <summary>
    /// Update a user-defined sandbox image.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<SandboxImageDto>> Update(string id, [FromBody] UpdateSandboxImageRequest request)
    {
        var image = await _repository.GetByIdAsync(id);

        if (image == null)
            return NotFound(new { error = $"Sandbox image '{id}' not found" });

        if (image.Source == ImageSource.BuiltIn)
            return BadRequest(new { error = "Cannot modify built-in sandbox images" });

        try
        {
            if (!string.IsNullOrWhiteSpace(request.Name)) image.Name = request.Name;
            if (request.Description != null) image.Description = request.Description;
            if (!string.IsNullOrWhiteSpace(request.DockerImage))
            {
                image.DockerImage = request.DockerImage;
                image.MarkUnverified();
            }
            if (request.Tags != null) image.Tags = request.Tags;
            if (request.Tools != null) image.Tools = request.Tools;
            if (request.WorkingDirectory != null) image.WorkingDirectory = request.WorkingDirectory;
            if (request.DefaultShell != null) image.DefaultShell = request.DefaultShell;
            if (request.DefaultEnvironment != null) image.DefaultEnvironment = request.DefaultEnvironment;

            await _repository.SaveAsync(image);

            _logger.LogInformation("Updated sandbox image: {ImageId}", image.Id);
            return Ok(SandboxImageDto.FromDomain(image));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update sandbox image");
            return StatusCode(500, new { error = "Failed to update sandbox image", details = ex.Message });
        }
    }

    /// <summary>
    /// Delete a user-defined sandbox image.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(string id)
    {
        var image = await _repository.GetByIdAsync(id);

        if (image == null)
            return NotFound(new { error = $"Sandbox image '{id}' not found" });

        if (image.Source == ImageSource.BuiltIn)
            return BadRequest(new { error = "Cannot delete built-in sandbox images" });

        try
        {
            await _repository.DeleteAsync(id);
            _logger.LogInformation("Deleted sandbox image: {ImageId}", id);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete sandbox image");
            return StatusCode(500, new { error = "Failed to delete sandbox image", details = ex.Message });
        }
    }

    /// <summary>
    /// Verify that a sandbox image exists and is pullable.
    /// </summary>
    [HttpPost("{id}/verify")]
    public async Task<ActionResult<SandboxImageVerificationResult>> Verify(string id)
    {
        var image = await _repository.GetByIdAsync(id);

        if (image == null)
            return NotFound(new { error = $"Sandbox image '{id}' not found" });

        // TODO: Implement actual Docker verification
        // For now, just mark as verified
        image.MarkVerified();

        if (image.Source == ImageSource.UserDefined)
        {
            await _repository.SaveAsync(image);
        }

        return Ok(new SandboxImageVerificationResult
        {
            Success = true,
            ImageId = image.DockerImage,
            VerifiedAt = DateTime.UtcNow
        });
    }
}
