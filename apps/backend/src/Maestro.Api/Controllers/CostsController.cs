using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for cost governance: summary, limits, session costs.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class CostsController : ControllerBase
{
    private readonly ICostTrackingService _costTracking;

    public CostsController(ICostTrackingService costTracking)
    {
        _costTracking = costTracking;
    }

    /// <summary>
    /// Get aggregated cost summary (today, week, month, allTime, by provider/model).
    /// </summary>
    [HttpGet("summary")]
    public async Task<ActionResult<CostSummaryDto>> GetSummary()
    {
        var summary = await _costTracking.GetSummaryAsync();
        return Ok(summary);
    }

    /// <summary>
    /// Get current cost limits.
    /// </summary>
    [HttpGet("limits")]
    public async Task<ActionResult<CostLimitsDto>> GetLimits()
    {
        var limits = await _costTracking.GetLimitsAsync();
        return Ok(limits);
    }

    /// <summary>
    /// Set cost limits.
    /// </summary>
    [HttpPut("limits")]
    public async Task<ActionResult> SetLimits([FromBody] CostLimitsDto limits)
    {
        await _costTracking.SetLimitsAsync(limits);
        return Ok(new { message = "Limits updated" });
    }

    /// <summary>
    /// Get cost entries for a specific session.
    /// </summary>
    [HttpGet("/api/sessions/{id}/costs")]
    public async Task<ActionResult<List<CostEntryDto>>> GetSessionCosts(string id)
    {
        var costs = await _costTracking.GetSessionCostsAsync(id);
        return Ok(costs);
    }
}
