using Microsoft.AspNetCore.Mvc;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Foundry;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for Agent Foundry overview and dashboard.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class FoundryController : ControllerBase
{
    private readonly AgentRegistry _agentRegistry;
    private readonly ToolRegistry _toolRegistry;

    public FoundryController(AgentRegistry agentRegistry, ToolRegistry toolRegistry)
    {
        _agentRegistry = agentRegistry;
        _toolRegistry = toolRegistry;
    }

    /// <summary>
    /// Get overview dashboard data.
    /// </summary>
    [HttpGet("overview")]
    public async Task<ActionResult<FoundryOverviewDto>> GetOverview([FromQuery] string? projectPath = null)
    {
        var agents = await _agentRegistry.GetAllAsync(projectPath);
        var tools = await _toolRegistry.GetAllAsync(projectPath);

        var totalAgentRuns = agents.Sum(a => a.Metrics.TotalRuns);
        var totalToolRuns = tools.Sum(t => t.Metrics.TotalRuns);

        var avgAgentScore = agents.Count > 0
            ? agents.Average(a => a.Metrics.OverallScore)
            : 0;
        var avgToolScore = tools.Count > 0
            ? tools.Average(t => t.Metrics.OverallScore)
            : 0;

        var overview = new FoundryOverviewDto
        {
            AgentCount = agents.Count,
            ToolCount = tools.Count,
            TotalAgentRuns = totalAgentRuns,
            TotalToolRuns = totalToolRuns,
            AvgAgentScore = Math.Round(avgAgentScore, 1),
            AvgToolScore = Math.Round(avgToolScore, 1),
            TopAgents = agents
                .OrderByDescending(a => a.Metrics.OverallScore)
                .Take(5)
                .Select(a => new LeaderboardItemDto
                {
                    Id = a.Id,
                    Name = a.Name,
                    Type = "agent",
                    Score = Math.Round(a.Metrics.OverallScore, 1),
                    Runs = a.Metrics.TotalRuns,
                    SuccessRate = Math.Round(a.Metrics.CompletionRate, 1)
                }).ToList(),
            TopTools = tools
                .OrderByDescending(t => t.Metrics.OverallScore)
                .Take(5)
                .Select(t => new LeaderboardItemDto
                {
                    Id = t.Id,
                    Name = t.Name,
                    Type = "tool",
                    Score = Math.Round(t.Metrics.OverallScore, 1),
                    Runs = t.Metrics.TotalRuns,
                    SuccessRate = Math.Round(t.Metrics.SuccessRate, 1)
                }).ToList(),
            RecentActivity = GetRecentActivity(agents, tools),
            CategoryBreakdown = GetCategoryBreakdown(agents, tools)
        };

        return Ok(overview);
    }

    /// <summary>
    /// Get leaderboard of agents and tools by score.
    /// </summary>
    [HttpGet("leaderboard")]
    public async Task<ActionResult<LeaderboardDto>> GetLeaderboard(
        [FromQuery] string? projectPath = null,
        [FromQuery] int limit = 10)
    {
        var agents = await _agentRegistry.GetTopByScoreAsync(limit, projectPath);
        var tools = await _toolRegistry.GetTopByScoreAsync(limit, projectPath);

        var leaderboard = new LeaderboardDto
        {
            Agents = agents.Select(a => new LeaderboardItemDto
            {
                Id = a.Id,
                Name = a.Name,
                Type = "agent",
                Category = a.Category,
                Score = Math.Round(a.Metrics.OverallScore, 1),
                Runs = a.Metrics.TotalRuns,
                SuccessRate = Math.Round(a.Metrics.CompletionRate, 1),
                LastRunAt = a.Metrics.LastRunAt
            }).ToList(),
            Tools = tools.Select(t => new LeaderboardItemDto
            {
                Id = t.Id,
                Name = t.Name,
                Type = "tool",
                Category = t.Category,
                Score = Math.Round(t.Metrics.OverallScore, 1),
                Runs = t.Metrics.TotalRuns,
                SuccessRate = Math.Round(t.Metrics.SuccessRate, 1),
                LastRunAt = t.Metrics.LastRunAt
            }).ToList()
        };

        return Ok(leaderboard);
    }

    /// <summary>
    /// Get agent-tool relationship graph.
    /// </summary>
    [HttpGet("relationships")]
    public async Task<ActionResult<RelationshipGraphDto>> GetRelationships([FromQuery] string? projectPath = null)
    {
        var agents = await _agentRegistry.GetAllAsync(projectPath);
        var tools = await _toolRegistry.GetAllAsync(projectPath);

        var nodes = new List<GraphNodeDto>();
        var edges = new List<GraphEdgeDto>();

        // Add agent nodes
        foreach (var agent in agents)
        {
            nodes.Add(new GraphNodeDto
            {
                Id = agent.Id,
                Label = agent.Name,
                Type = "agent",
                Score = Math.Round(agent.Metrics.OverallScore, 1)
            });

            // Add edges from agent to tools
            foreach (var toolId in agent.AvailableTools)
            {
                edges.Add(new GraphEdgeDto
                {
                    Source = agent.Id,
                    Target = toolId,
                    Type = "uses-tool"
                });
            }

            // Add edges from agent to sub-agents
            foreach (var subAgentId in agent.AvailableAgents)
            {
                edges.Add(new GraphEdgeDto
                {
                    Source = agent.Id,
                    Target = subAgentId,
                    Type = "uses-agent"
                });
            }
        }

        // Add tool nodes
        foreach (var tool in tools)
        {
            nodes.Add(new GraphNodeDto
            {
                Id = tool.Id,
                Label = tool.Name,
                Type = "tool",
                Score = Math.Round(tool.Metrics.OverallScore, 1)
            });
        }

        return Ok(new RelationshipGraphDto
        {
            Nodes = nodes,
            Edges = edges
        });
    }

    /// <summary>
    /// Promote a workflow to a tool or agent.
    /// </summary>
    [HttpPost("promote")]
    public async Task<IActionResult> PromoteWorkflow(
        [FromBody] PromoteRequest request,
        [FromQuery] string? projectPath = null)
    {
        if (request.DesignationType == "tool")
        {
            var tool = new ToolDefinition
            {
                Id = request.Id ?? request.BlockId,
                Name = request.Name,
                Description = request.Description ?? "",
                BlockId = request.BlockId,
                Category = request.Category ?? "general",
                Tags = request.Tags ?? new List<string>()
            };
            await _toolRegistry.SaveAsync(tool, projectPath);
            return Ok(new { message = $"Workflow promoted to tool '{tool.Id}'", type = "tool", id = tool.Id });
        }
        else if (request.DesignationType == "agent")
        {
            var agent = new AgentDefinition
            {
                Id = request.Id ?? request.BlockId,
                Name = request.Name,
                Description = request.Description ?? "",
                BlockId = request.BlockId,
                Category = request.Category ?? "general",
                Tags = request.Tags ?? new List<string>(),
                AvailableTools = request.AvailableTools ?? new List<string>()
            };
            await _agentRegistry.SaveAsync(agent, projectPath);
            return Ok(new { message = $"Workflow promoted to agent '{agent.Id}'", type = "agent", id = agent.Id });
        }

        return BadRequest(new { error = "Invalid designation type. Use 'tool' or 'agent'." });
    }

    private List<ActivityItemDto> GetRecentActivity(List<AgentDefinition> agents, List<ToolDefinition> tools)
    {
        var activities = new List<ActivityItemDto>();

        foreach (var agent in agents.Where(a => a.Metrics.LastRunAt.HasValue))
        {
            activities.Add(new ActivityItemDto
            {
                Id = agent.Id,
                Name = agent.Name,
                Type = "agent",
                Action = "run",
                Timestamp = agent.Metrics.LastRunAt!.Value,
                Score = Math.Round(agent.Metrics.OverallScore, 1)
            });
        }

        foreach (var tool in tools.Where(t => t.Metrics.LastRunAt.HasValue))
        {
            activities.Add(new ActivityItemDto
            {
                Id = tool.Id,
                Name = tool.Name,
                Type = "tool",
                Action = "run",
                Timestamp = tool.Metrics.LastRunAt!.Value,
                Score = Math.Round(tool.Metrics.OverallScore, 1)
            });
        }

        return activities
            .OrderByDescending(a => a.Timestamp)
            .Take(10)
            .ToList();
    }

    private CategoryBreakdownDto GetCategoryBreakdown(List<AgentDefinition> agents, List<ToolDefinition> tools)
    {
        return new CategoryBreakdownDto
        {
            Agents = agents
                .GroupBy(a => a.Category)
                .ToDictionary(g => g.Key, g => g.Count()),
            Tools = tools
                .GroupBy(t => t.Category)
                .ToDictionary(g => g.Key, g => g.Count())
        };
    }
}

// DTOs
public class FoundryOverviewDto
{
    public int AgentCount { get; set; }
    public int ToolCount { get; set; }
    public int TotalAgentRuns { get; set; }
    public int TotalToolRuns { get; set; }
    public double AvgAgentScore { get; set; }
    public double AvgToolScore { get; set; }
    public List<LeaderboardItemDto> TopAgents { get; set; } = new();
    public List<LeaderboardItemDto> TopTools { get; set; } = new();
    public List<ActivityItemDto> RecentActivity { get; set; } = new();
    public CategoryBreakdownDto CategoryBreakdown { get; set; } = new();
}

public class LeaderboardDto
{
    public List<LeaderboardItemDto> Agents { get; set; } = new();
    public List<LeaderboardItemDto> Tools { get; set; } = new();
}

public class LeaderboardItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public double Score { get; set; }
    public int Runs { get; set; }
    public double SuccessRate { get; set; }
    public DateTime? LastRunAt { get; set; }
}

public class ActivityItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public double Score { get; set; }
}

public class CategoryBreakdownDto
{
    public Dictionary<string, int> Agents { get; set; } = new();
    public Dictionary<string, int> Tools { get; set; } = new();
}

public class RelationshipGraphDto
{
    public List<GraphNodeDto> Nodes { get; set; } = new();
    public List<GraphEdgeDto> Edges { get; set; } = new();
}

public class GraphNodeDto
{
    public string Id { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public double Score { get; set; }
}

public class GraphEdgeDto
{
    public string Source { get; set; } = string.Empty;
    public string Target { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
}

public class PromoteRequest
{
    public string? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string BlockId { get; set; } = string.Empty;
    public string DesignationType { get; set; } = string.Empty; // "tool" or "agent"
    public string? Category { get; set; }
    public List<string>? Tags { get; set; }
    public List<string>? AvailableTools { get; set; }
}
