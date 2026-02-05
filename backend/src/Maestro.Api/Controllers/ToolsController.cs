using Microsoft.AspNetCore.Mvc;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Foundry;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for managing tools in Agent Foundry.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ToolsController : ControllerBase
{
    private readonly ToolRegistry _toolRegistry;

    public ToolsController(ToolRegistry toolRegistry)
    {
        _toolRegistry = toolRegistry;
    }

    /// <summary>
    /// List all tools.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<ToolSummaryDto>>> ListTools(
        [FromQuery] string? projectPath = null,
        [FromQuery] string? category = null)
    {
        var tools = string.IsNullOrEmpty(category)
            ? await _toolRegistry.GetAllAsync(projectPath)
            : await _toolRegistry.GetByCategoryAsync(category, projectPath);

        var summaries = tools.Select(t => new ToolSummaryDto
        {
            Id = t.Id,
            Name = t.Name,
            Description = t.Description,
            Version = t.Version,
            Category = t.Category,
            Tags = t.Tags,
            TotalRuns = t.Metrics.TotalRuns,
            SuccessRate = Math.Round(t.Metrics.SuccessRate, 1),
            OverallScore = Math.Round(t.Metrics.OverallScore, 1),
            LastRunAt = t.Metrics.LastRunAt,
            UsedByAgentsCount = t.Metrics.UsedByAgents.Count
        }).OrderByDescending(t => t.OverallScore).ToList();

        return Ok(summaries);
    }

    /// <summary>
    /// Get tool details.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ToolDefinition>> GetTool(string id, [FromQuery] string? projectPath = null)
    {
        var tool = await _toolRegistry.GetByIdAsync(id, projectPath);
        if (tool == null)
        {
            return NotFound(new { error = $"Tool '{id}' not found" });
        }
        return Ok(tool);
    }

    /// <summary>
    /// Create a new tool.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ToolDefinition>> CreateTool(
        [FromBody] CreateToolRequest request,
        [FromQuery] string? projectPath = null)
    {
        var tool = new ToolDefinition
        {
            Id = request.Id ?? GenerateId(request.Name),
            Name = request.Name,
            Description = request.Description,
            Version = request.Version ?? "1.0.0",
            BlockId = request.BlockId,
            InputSchema = request.InputSchema ?? new Dictionary<string, object>(),
            OutputSchema = request.OutputSchema ?? new Dictionary<string, object>(),
            Category = request.Category ?? "general",
            Tags = request.Tags ?? new List<string>(),
            Author = request.Author,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var saved = await _toolRegistry.SaveAsync(tool, projectPath);
        return CreatedAtAction(nameof(GetTool), new { id = saved.Id }, saved);
    }

    /// <summary>
    /// Update a tool.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<ToolDefinition>> UpdateTool(
        string id,
        [FromBody] UpdateToolRequest request,
        [FromQuery] string? projectPath = null)
    {
        var existing = await _toolRegistry.GetByIdAsync(id, projectPath);
        if (existing == null)
        {
            return NotFound(new { error = $"Tool '{id}' not found" });
        }

        if (request.Name != null) existing.Name = request.Name;
        if (request.Description != null) existing.Description = request.Description;
        if (request.Version != null) existing.Version = request.Version;
        if (request.BlockId != null) existing.BlockId = request.BlockId;
        if (request.InputSchema != null) existing.InputSchema = request.InputSchema;
        if (request.OutputSchema != null) existing.OutputSchema = request.OutputSchema;
        if (request.Category != null) existing.Category = request.Category;
        if (request.Tags != null) existing.Tags = request.Tags;

        var saved = await _toolRegistry.SaveAsync(existing, projectPath);
        return Ok(saved);
    }

    /// <summary>
    /// Delete a tool.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTool(string id, [FromQuery] string? projectPath = null)
    {
        var deleted = await _toolRegistry.DeleteAsync(id, projectPath);
        if (!deleted)
        {
            return NotFound(new { error = $"Tool '{id}' not found" });
        }
        return Ok(new { message = $"Tool '{id}' deleted" });
    }

    /// <summary>
    /// Get tool metrics.
    /// </summary>
    [HttpGet("{id}/metrics")]
    public async Task<ActionResult<ToolMetrics>> GetToolMetrics(string id, [FromQuery] string? projectPath = null)
    {
        var tool = await _toolRegistry.GetByIdAsync(id, projectPath);
        if (tool == null)
        {
            return NotFound(new { error = $"Tool '{id}' not found" });
        }
        return Ok(tool.Metrics);
    }

    /// <summary>
    /// Record a tool run (for metrics tracking).
    /// </summary>
    [HttpPost("{id}/runs")]
    public async Task<IActionResult> RecordRun(
        string id,
        [FromBody] RecordToolRunRequest request,
        [FromQuery] string? projectPath = null)
    {
        await _toolRegistry.RecordRunAsync(
            id,
            request.Success,
            request.ExecutionTimeMs,
            request.TokenCost,
            request.Score,
            projectPath);

        return Ok(new { message = "Run recorded" });
    }

    /// <summary>
    /// Get top tools by score.
    /// </summary>
    [HttpGet("top")]
    public async Task<ActionResult<List<ToolSummaryDto>>> GetTopTools(
        [FromQuery] int limit = 10,
        [FromQuery] string? projectPath = null)
    {
        var tools = await _toolRegistry.GetTopByScoreAsync(limit, projectPath);

        var summaries = tools.Select(t => new ToolSummaryDto
        {
            Id = t.Id,
            Name = t.Name,
            Description = t.Description,
            Version = t.Version,
            Category = t.Category,
            Tags = t.Tags,
            TotalRuns = t.Metrics.TotalRuns,
            SuccessRate = Math.Round(t.Metrics.SuccessRate, 1),
            OverallScore = Math.Round(t.Metrics.OverallScore, 1),
            LastRunAt = t.Metrics.LastRunAt,
            UsedByAgentsCount = t.Metrics.UsedByAgents.Count
        }).ToList();

        return Ok(summaries);
    }

    private string GenerateId(string name)
    {
        return name.ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("_", "-");
    }
}

// DTOs
public class ToolSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new();
    public int TotalRuns { get; set; }
    public double SuccessRate { get; set; }
    public double OverallScore { get; set; }
    public DateTime? LastRunAt { get; set; }
    public int UsedByAgentsCount { get; set; }
}

public class CreateToolRequest
{
    public string? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Version { get; set; }
    public string BlockId { get; set; } = string.Empty;
    public Dictionary<string, object>? InputSchema { get; set; }
    public Dictionary<string, object>? OutputSchema { get; set; }
    public string? Category { get; set; }
    public List<string>? Tags { get; set; }
    public string? Author { get; set; }
}

public class UpdateToolRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Version { get; set; }
    public string? BlockId { get; set; }
    public Dictionary<string, object>? InputSchema { get; set; }
    public Dictionary<string, object>? OutputSchema { get; set; }
    public string? Category { get; set; }
    public List<string>? Tags { get; set; }
}

public class RecordToolRunRequest
{
    public bool Success { get; set; }
    public long ExecutionTimeMs { get; set; }
    public int TokenCost { get; set; }
    public double Score { get; set; }
}
