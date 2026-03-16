using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using System.Text.Json;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for cost governance: summary, limits, session costs.
/// Supports both old format (decimal values) and new format (CostLimitConfigDto objects)
/// for backward compatibility.
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
    /// Accepts both old format (number values) and new format (objects with value/enforcement/autoResume).
    /// The CostLimitConfigDtoConverter handles backward compatibility automatically.
    ///
    /// Old format example: { "maxPerDay": 5.0 }
    /// New format example: { "maxPerDay": { "value": 5.0, "enforcement": "block", "autoResume": true } }
    /// Mixed format is also supported.
    /// </summary>
    [HttpPut("limits")]
    public async Task<ActionResult> SetLimits()
    {
        try
        {
            // Read the raw request body as a string. We cannot use [FromBody] JsonElement
            // because the API is configured with Newtonsoft (.AddNewtonsoftJson()), and
            // JsonElement is a System.Text.Json type — Newtonsoft cannot bind it, causing
            // "Operation is not valid" when GetRawText() is called on a default JsonElement.
            using var reader = new StreamReader(Request.Body);
            var rawJson = await reader.ReadToEndAsync();
            if (string.IsNullOrWhiteSpace(rawJson))
                return BadRequest(new { error = "Request body is empty" });

            // Use System.Text.Json with our custom converter to handle both formats
            var opts = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                PropertyNameCaseInsensitive = true
            };
            var limits = JsonSerializer.Deserialize<CostLimitsDto>(rawJson, opts);
            if (limits == null)
                return BadRequest(new { error = "Invalid limits format" });

            await _costTracking.SetLimitsAsync(limits);
            return Ok(new { message = "Limits updated" });
        }
        catch (JsonException ex)
        {
            return BadRequest(new { error = $"Invalid JSON format: {ex.Message}" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = "invalid_operation", message = ex.Message, status = 400 });
        }
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
