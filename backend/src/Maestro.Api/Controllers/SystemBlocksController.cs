using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;

namespace Maestro.Api.Controllers;

/// <summary>
/// Controller for managing system blocks and their user overrides.
/// </summary>
[ApiController]
[Route("api/blocks/system")]
public class SystemBlocksController : ControllerBase
{
    private readonly ISystemBlockService _systemBlockService;
    private readonly ILogger<SystemBlocksController> _logger;

    public SystemBlocksController(
        ISystemBlockService systemBlockService,
        ILogger<SystemBlocksController> logger)
    {
        _systemBlockService = systemBlockService;
        _logger = logger;
    }

    /// <summary>
    /// Gets all system blocks.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<BlockDto>>> GetSystemBlocks(CancellationToken ct)
    {
        var blocks = await _systemBlockService.GetSystemBlocksAsync(ct);
        var dtos = blocks.Select(b => BlockDto.FromDomain(b));
        return Ok(dtos);
    }

    /// <summary>
    /// Gets a specific system block by ID.
    /// </summary>
    [HttpGet("{blockId}")]
    public async Task<ActionResult<BlockDto>> GetSystemBlock(string blockId, CancellationToken ct)
    {
        var block = await _systemBlockService.GetSystemBlockAsync(blockId, ct);
        if (block == null)
        {
            return NotFound(new { error = $"System block '{blockId}' not found" });
        }
        return Ok(BlockDto.FromDomain(block));
    }

    /// <summary>
    /// Gets all user overrides.
    /// </summary>
    [HttpGet("overrides")]
    public async Task<ActionResult<IEnumerable<BlockDto>>> GetUserOverrides(CancellationToken ct)
    {
        var overrides = await _systemBlockService.GetUserOverridesAsync(ct);
        var dtos = overrides.Select(b => BlockDto.FromDomain(b));
        return Ok(dtos);
    }

    /// <summary>
    /// Creates a user override for a system block.
    /// </summary>
    [HttpPost("{blockId}/override")]
    public async Task<ActionResult<BlockDto>> CreateOverride(
        string blockId,
        [FromBody] CreateOverrideRequest? request,
        CancellationToken ct)
    {
        try
        {
            var overrideBlock = await _systemBlockService.CreateOverrideAsync(
                blockId,
                request?.Config,
                ct);

            _logger.LogInformation("Created override for system block {BlockId}", blockId);
            return Ok(BlockDto.FromDomain(overrideBlock));
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
    /// Restores a system block to its default configuration by removing any user override.
    /// </summary>
    [HttpDelete("{blockId}/override")]
    public async Task<ActionResult> RestoreSystemBlock(string blockId, CancellationToken ct)
    {
        try
        {
            await _systemBlockService.RestoreSystemBlockAsync(blockId, ct);
            _logger.LogInformation("Restored system block {BlockId} to default", blockId);
            return Ok(new { message = $"System block '{blockId}' restored to default" });
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Checks if a system block has a user override.
    /// </summary>
    [HttpGet("{blockId}/has-override")]
    public async Task<ActionResult<HasOverrideResponse>> HasOverride(string blockId, CancellationToken ct)
    {
        var systemBlock = await _systemBlockService.GetSystemBlockAsync(blockId, ct);
        if (systemBlock == null)
        {
            return NotFound(new { error = $"System block '{blockId}' not found" });
        }

        var hasOverride = await _systemBlockService.HasOverrideAsync(blockId, ct);
        return Ok(new HasOverrideResponse
        {
            BlockId = blockId,
            HasOverride = hasOverride,
            IsOverridable = systemBlock.Overridable
        });
    }

    /// <summary>
    /// Gets the effective block (system block with override applied if present).
    /// </summary>
    [HttpGet("{blockId}/effective")]
    public async Task<ActionResult<BlockDto>> GetEffectiveBlock(string blockId, CancellationToken ct)
    {
        var block = await _systemBlockService.GetEffectiveBlockAsync(blockId, ct);
        if (block == null)
        {
            return NotFound(new { error = $"Block '{blockId}' not found" });
        }
        return Ok(BlockDto.FromDomain(block));
    }
}

/// <summary>
/// Request for creating a system block override.
/// </summary>
public class CreateOverrideRequest
{
    /// <summary>
    /// Optional configuration to override.
    /// </summary>
    public Dictionary<string, object>? Config { get; set; }
}

/// <summary>
/// Response for has-override check.
/// </summary>
public class HasOverrideResponse
{
    public string BlockId { get; set; } = string.Empty;
    public bool HasOverride { get; set; }
    public bool IsOverridable { get; set; }
}
