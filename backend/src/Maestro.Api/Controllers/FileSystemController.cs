using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for file system browsing operations.
/// Used for project folder selection.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class FileSystemController : ControllerBase
{
    private readonly IFileSystemBrowser _browser;
    private readonly ILogger<FileSystemController> _logger;

    public FileSystemController(
        IFileSystemBrowser browser,
        ILogger<FileSystemController> logger)
    {
        _browser = browser;
        _logger = logger;
    }

    /// <summary>
    /// Browse a directory and list its contents.
    /// </summary>
    [HttpGet("browse")]
    public async Task<ActionResult<DirectoryListingDto>> BrowseDirectory([FromQuery] string? path = null)
    {
        try
        {
            var result = await _browser.ListDirectoryAsync(path);
            return Ok(DirectoryListingDto.FromDomain(result));
        }
        catch (DirectoryNotFoundException)
        {
            return NotFound(new { error = $"Directory not found: {path}" });
        }
        catch (UnauthorizedAccessException)
        {
            return StatusCode(403, new { error = $"Access denied to directory: {path}" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error browsing directory {Path}", path);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Browse a directory using POST (for paths with special characters).
    /// </summary>
    [HttpPost("browse")]
    public async Task<ActionResult<DirectoryListingDto>> BrowseDirectoryPost([FromBody] BrowseDirectoryRequest request)
    {
        try
        {
            var result = await _browser.ListDirectoryAsync(request.Path);
            return Ok(DirectoryListingDto.FromDomain(result));
        }
        catch (DirectoryNotFoundException)
        {
            return NotFound(new { error = $"Directory not found: {request.Path}" });
        }
        catch (UnauthorizedAccessException)
        {
            return StatusCode(403, new { error = $"Access denied to directory: {request.Path}" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error browsing directory {Path}", request.Path);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get common/favorite directories (home, documents, etc.).
    /// </summary>
    [HttpGet("common")]
    public async Task<ActionResult<List<CommonDirectoryDto>>> GetCommonDirectories()
    {
        var directories = await _browser.GetCommonDirectoriesAsync();
        var dtos = directories.Select(CommonDirectoryDto.FromDomain).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Check if a path exists and is a directory.
    /// </summary>
    [HttpGet("exists")]
    public async Task<ActionResult<DirectoryExistsResponse>> DirectoryExists([FromQuery] string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return BadRequest(new { error = "Path is required" });
        }

        var exists = await _browser.DirectoryExistsAsync(path);
        return Ok(new DirectoryExistsResponse { Path = path, Exists = exists });
    }
}

/// <summary>
/// Response for directory existence check.
/// </summary>
public record DirectoryExistsResponse
{
    public string Path { get; init; } = string.Empty;
    public bool Exists { get; init; }
}
