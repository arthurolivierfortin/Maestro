using Microsoft.AspNetCore.Mvc;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Foundry;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for managing agents in Agent Foundry.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AgentsController : ControllerBase
{
    private readonly AgentRegistry _agentRegistry;
    private readonly ToolRegistry _toolRegistry;

    public AgentsController(AgentRegistry agentRegistry, ToolRegistry toolRegistry)
    {
        _agentRegistry = agentRegistry;
        _toolRegistry = toolRegistry;
    }

    /// <summary>
    /// List all agents.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<AgentSummaryDto>>> ListAgents(
        [FromQuery] string? projectPath = null,
        [FromQuery] string? category = null)
    {
        var agents = string.IsNullOrEmpty(category)
            ? await _agentRegistry.GetAllAsync(projectPath)
            : await _agentRegistry.GetByCategoryAsync(category, projectPath);

        var summaries = agents.Select(a => new AgentSummaryDto
        {
            Id = a.Id,
            Name = a.Name,
            Description = a.Description,
            Version = a.Version,
            Category = a.Category,
            Tags = a.Tags,
            Capabilities = a.Capabilities,
            AvailableToolsCount = a.AvailableTools.Count,
            TotalRuns = a.Metrics.TotalRuns,
            CompletionRate = Math.Round(a.Metrics.CompletionRate, 1),
            OverallScore = Math.Round(a.Metrics.OverallScore, 1),
            LastRunAt = a.Metrics.LastRunAt
        }).OrderByDescending(a => a.OverallScore).ToList();

        return Ok(summaries);
    }

    /// <summary>
    /// Get agent details.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<AgentDetailDto>> GetAgent(string id, [FromQuery] string? projectPath = null)
    {
        var agent = await _agentRegistry.GetByIdAsync(id, projectPath);
        if (agent == null)
        {
            return NotFound(new { error = $"Agent '{id}' not found" });
        }

        // Load tool details for available tools
        var toolDetails = new List<ToolSummaryDto>();
        foreach (var toolId in agent.AvailableTools)
        {
            var tool = await _toolRegistry.GetByIdAsync(toolId, projectPath);
            if (tool != null)
            {
                toolDetails.Add(new ToolSummaryDto
                {
                    Id = tool.Id,
                    Name = tool.Name,
                    Description = tool.Description,
                    Version = tool.Version,
                    Category = tool.Category,
                    TotalRuns = tool.Metrics.TotalRuns,
                    SuccessRate = Math.Round(tool.Metrics.SuccessRate, 1),
                    OverallScore = Math.Round(tool.Metrics.OverallScore, 1)
                });
            }
        }

        var detail = new AgentDetailDto
        {
            Id = agent.Id,
            Name = agent.Name,
            Description = agent.Description,
            Version = agent.Version,
            BlockId = agent.BlockId,
            Capabilities = agent.Capabilities,
            AvailableTools = agent.AvailableTools,
            AvailableAgents = agent.AvailableAgents,
            Config = agent.Config,
            Category = agent.Category,
            Tags = agent.Tags,
            Author = agent.Author,
            Metrics = agent.Metrics,
            ToolDetails = toolDetails,
            CreatedAt = agent.CreatedAt,
            UpdatedAt = agent.UpdatedAt
        };

        return Ok(detail);
    }

    /// <summary>
    /// Create a new agent.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<AgentDefinition>> CreateAgent(
        [FromBody] CreateAgentRequest request,
        [FromQuery] string? projectPath = null)
    {
        var agent = new AgentDefinition
        {
            Id = request.Id ?? GenerateId(request.Name),
            Name = request.Name,
            Description = request.Description,
            Version = request.Version ?? "1.0.0",
            BlockId = request.BlockId,
            Capabilities = request.Capabilities ?? new List<string>(),
            AvailableTools = request.AvailableTools ?? new List<string>(),
            AvailableAgents = request.AvailableAgents ?? new List<string>(),
            Config = request.Config ?? new AgentConfig(),
            Category = request.Category ?? "general",
            Tags = request.Tags ?? new List<string>(),
            Author = request.Author,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var saved = await _agentRegistry.SaveAsync(agent, projectPath);

        // Update tool references
        foreach (var toolId in agent.AvailableTools)
        {
            var tool = await _toolRegistry.GetByIdAsync(toolId, projectPath);
            if (tool != null && !tool.Metrics.UsedByAgents.Contains(agent.Id))
            {
                tool.Metrics.UsedByAgents.Add(agent.Id);
                await _toolRegistry.SaveAsync(tool, projectPath);
            }
        }

        return CreatedAtAction(nameof(GetAgent), new { id = saved.Id }, saved);
    }

    /// <summary>
    /// Update an agent.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<AgentDefinition>> UpdateAgent(
        string id,
        [FromBody] UpdateAgentRequest request,
        [FromQuery] string? projectPath = null)
    {
        var existing = await _agentRegistry.GetByIdAsync(id, projectPath);
        if (existing == null)
        {
            return NotFound(new { error = $"Agent '{id}' not found" });
        }

        if (request.Name != null) existing.Name = request.Name;
        if (request.Description != null) existing.Description = request.Description;
        if (request.Version != null) existing.Version = request.Version;
        if (request.BlockId != null) existing.BlockId = request.BlockId;
        if (request.Capabilities != null) existing.Capabilities = request.Capabilities;
        if (request.AvailableTools != null) existing.AvailableTools = request.AvailableTools;
        if (request.AvailableAgents != null) existing.AvailableAgents = request.AvailableAgents;
        if (request.Config != null) existing.Config = request.Config;
        if (request.Category != null) existing.Category = request.Category;
        if (request.Tags != null) existing.Tags = request.Tags;

        var saved = await _agentRegistry.SaveAsync(existing, projectPath);
        return Ok(saved);
    }

    /// <summary>
    /// Delete an agent.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAgent(string id, [FromQuery] string? projectPath = null)
    {
        var deleted = await _agentRegistry.DeleteAsync(id, projectPath);
        if (!deleted)
        {
            return NotFound(new { error = $"Agent '{id}' not found" });
        }
        return Ok(new { message = $"Agent '{id}' deleted" });
    }

    /// <summary>
    /// Get agent metrics.
    /// </summary>
    [HttpGet("{id}/metrics")]
    public async Task<ActionResult<AgentMetrics>> GetAgentMetrics(string id, [FromQuery] string? projectPath = null)
    {
        var agent = await _agentRegistry.GetByIdAsync(id, projectPath);
        if (agent == null)
        {
            return NotFound(new { error = $"Agent '{id}' not found" });
        }
        return Ok(agent.Metrics);
    }

    /// <summary>
    /// Record an agent run (for metrics tracking).
    /// </summary>
    [HttpPost("{id}/runs")]
    public async Task<IActionResult> RecordRun(
        string id,
        [FromBody] RecordAgentRunRequest request,
        [FromQuery] string? projectPath = null)
    {
        var result = new AgentRunResult
        {
            Status = request.Status,
            ExecutionTimeMs = request.ExecutionTimeMs,
            TokenCost = request.TokenCost,
            StepsExecuted = request.StepsExecuted,
            ToolsUsed = request.ToolsUsed ?? new List<string>(),
            TaskCompletionScore = request.TaskCompletionScore,
            EfficiencyScore = request.EfficiencyScore,
            QualityScore = request.QualityScore
        };

        await _agentRegistry.RecordRunAsync(id, result, projectPath);

        return Ok(new { message = "Run recorded" });
    }

    /// <summary>
    /// Get tools available to this agent.
    /// </summary>
    [HttpGet("{id}/tools")]
    public async Task<ActionResult<List<ToolSummaryDto>>> GetAgentTools(string id, [FromQuery] string? projectPath = null)
    {
        var agent = await _agentRegistry.GetByIdAsync(id, projectPath);
        if (agent == null)
        {
            return NotFound(new { error = $"Agent '{id}' not found" });
        }

        var tools = new List<ToolSummaryDto>();
        foreach (var toolId in agent.AvailableTools)
        {
            var tool = await _toolRegistry.GetByIdAsync(toolId, projectPath);
            if (tool != null)
            {
                tools.Add(new ToolSummaryDto
                {
                    Id = tool.Id,
                    Name = tool.Name,
                    Description = tool.Description,
                    Version = tool.Version,
                    Category = tool.Category,
                    Tags = tool.Tags,
                    TotalRuns = tool.Metrics.TotalRuns,
                    SuccessRate = Math.Round(tool.Metrics.SuccessRate, 1),
                    OverallScore = Math.Round(tool.Metrics.OverallScore, 1)
                });
            }
        }

        return Ok(tools);
    }

    /// <summary>
    /// Get top agents by score.
    /// </summary>
    [HttpGet("top")]
    public async Task<ActionResult<List<AgentSummaryDto>>> GetTopAgents(
        [FromQuery] int limit = 10,
        [FromQuery] string? projectPath = null)
    {
        var agents = await _agentRegistry.GetTopByScoreAsync(limit, projectPath);

        var summaries = agents.Select(a => new AgentSummaryDto
        {
            Id = a.Id,
            Name = a.Name,
            Description = a.Description,
            Version = a.Version,
            Category = a.Category,
            Tags = a.Tags,
            Capabilities = a.Capabilities,
            AvailableToolsCount = a.AvailableTools.Count,
            TotalRuns = a.Metrics.TotalRuns,
            CompletionRate = Math.Round(a.Metrics.CompletionRate, 1),
            OverallScore = Math.Round(a.Metrics.OverallScore, 1),
            LastRunAt = a.Metrics.LastRunAt
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
public class AgentSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new();
    public List<string> Capabilities { get; set; } = new();
    public int AvailableToolsCount { get; set; }
    public int TotalRuns { get; set; }
    public double CompletionRate { get; set; }
    public double OverallScore { get; set; }
    public DateTime? LastRunAt { get; set; }
}

public class AgentDetailDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string BlockId { get; set; } = string.Empty;
    public List<string> Capabilities { get; set; } = new();
    public List<string> AvailableTools { get; set; } = new();
    public List<string> AvailableAgents { get; set; } = new();
    public AgentConfig Config { get; set; } = new();
    public string Category { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new();
    public string? Author { get; set; }
    public AgentMetrics Metrics { get; set; } = new();
    public List<ToolSummaryDto> ToolDetails { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateAgentRequest
{
    public string? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Version { get; set; }
    public string BlockId { get; set; } = string.Empty;
    public List<string>? Capabilities { get; set; }
    public List<string>? AvailableTools { get; set; }
    public List<string>? AvailableAgents { get; set; }
    public AgentConfig? Config { get; set; }
    public string? Category { get; set; }
    public List<string>? Tags { get; set; }
    public string? Author { get; set; }
}

public class UpdateAgentRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Version { get; set; }
    public string? BlockId { get; set; }
    public List<string>? Capabilities { get; set; }
    public List<string>? AvailableTools { get; set; }
    public List<string>? AvailableAgents { get; set; }
    public AgentConfig? Config { get; set; }
    public string? Category { get; set; }
    public List<string>? Tags { get; set; }
}

public class RecordAgentRunRequest
{
    public string Status { get; set; } = "completed";
    public long ExecutionTimeMs { get; set; }
    public int TokenCost { get; set; }
    public int StepsExecuted { get; set; }
    public List<string>? ToolsUsed { get; set; }
    public double TaskCompletionScore { get; set; }
    public double EfficiencyScore { get; set; }
    public double QualityScore { get; set; }
}
