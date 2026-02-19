using Microsoft.AspNetCore.Mvc;
using Maestro.Domain.Entities;
using Maestro.Application.Interfaces;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for Agent Foundry overview and dashboard.
/// Phase 18: Refactored to use IBlockDiscoveryService instead of separate registries.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class FoundryController : ControllerBase
{
    private readonly IBlockDiscoveryService _blockDiscovery;

    public FoundryController(IBlockDiscoveryService blockDiscovery)
    {
        _blockDiscovery = blockDiscovery;
    }

    /// <summary>
    /// Get overview dashboard data.
    /// </summary>
    [HttpGet("overview")]
    public async Task<ActionResult<FoundryOverviewDto>> GetOverview()
    {
        var allBlocks = (await _blockDiscovery.DiscoverAllAsync()).ToList();

        var agents = allBlocks.Where(b => b.Designation == "agent").ToList();
        var tools = allBlocks.Where(b => b.Designation == "tool").ToList();

        var agentMetrics = agents.Select(a => a.GetAggregatedMetrics()).Where(m => m != null).ToList();
        var toolMetrics = tools.Select(t => t.GetAggregatedMetrics()).Where(m => m != null).ToList();

        var totalAgentRuns = agentMetrics.Sum(m => m!.TotalRuns);
        var totalToolRuns = toolMetrics.Sum(m => m!.TotalRuns);

        var avgAgentScore = agentMetrics.Count > 0
            ? agentMetrics.Average(m => m!.OverallScore)
            : 0;
        var avgToolScore = toolMetrics.Count > 0
            ? toolMetrics.Average(m => m!.OverallScore)
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
                .Select(a => new { Block = a, Metrics = a.GetAggregatedMetrics() })
                .Where(x => x.Metrics != null)
                .OrderByDescending(x => x.Metrics!.OverallScore)
                .Take(5)
                .Select(x => new LeaderboardItemDto
                {
                    Id = x.Block.Id,
                    Name = x.Block.Name,
                    Type = "agent",
                    Score = Math.Round(x.Metrics!.OverallScore, 1),
                    Runs = x.Metrics!.TotalRuns,
                    SuccessRate = Math.Round(x.Metrics!.SuccessRate, 1)
                }).ToList(),
            TopTools = tools
                .Select(t => new { Block = t, Metrics = t.GetAggregatedMetrics() })
                .Where(x => x.Metrics != null)
                .OrderByDescending(x => x.Metrics!.OverallScore)
                .Take(5)
                .Select(x => new LeaderboardItemDto
                {
                    Id = x.Block.Id,
                    Name = x.Block.Name,
                    Type = "tool",
                    Score = Math.Round(x.Metrics!.OverallScore, 1),
                    Runs = x.Metrics!.TotalRuns,
                    SuccessRate = Math.Round(x.Metrics!.SuccessRate, 1)
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
    public async Task<ActionResult<LeaderboardDto>> GetLeaderboard([FromQuery] int limit = 10)
    {
        var allBlocks = (await _blockDiscovery.DiscoverAllAsync()).ToList();

        var agents = allBlocks
            .Where(b => b.Designation == "agent")
            .Select(b => new { Block = b, Metrics = b.GetAggregatedMetrics() })
            .Where(x => x.Metrics != null)
            .OrderByDescending(x => x.Metrics!.OverallScore)
            .Take(limit);

        var tools = allBlocks
            .Where(b => b.Designation == "tool")
            .Select(b => new { Block = b, Metrics = b.GetAggregatedMetrics() })
            .Where(x => x.Metrics != null)
            .OrderByDescending(x => x.Metrics!.OverallScore)
            .Take(limit);

        var leaderboard = new LeaderboardDto
        {
            Agents = agents.Select(x => new LeaderboardItemDto
            {
                Id = x.Block.Id,
                Name = x.Block.Name,
                Type = "agent",
                Category = x.Block.Category ?? "general",
                Score = Math.Round(x.Metrics!.OverallScore, 1),
                Runs = x.Metrics!.TotalRuns,
                SuccessRate = Math.Round(x.Metrics!.SuccessRate, 1),
                LastRunAt = x.Metrics!.LastRunAt
            }).ToList(),
            Tools = tools.Select(x => new LeaderboardItemDto
            {
                Id = x.Block.Id,
                Name = x.Block.Name,
                Type = "tool",
                Category = x.Block.Category ?? "general",
                Score = Math.Round(x.Metrics!.OverallScore, 1),
                Runs = x.Metrics!.TotalRuns,
                SuccessRate = Math.Round(x.Metrics!.SuccessRate, 1),
                LastRunAt = x.Metrics!.LastRunAt
            }).ToList()
        };

        return Ok(leaderboard);
    }

    /// <summary>
    /// Get agent-tool relationship graph.
    /// Phase 18: Relationships are now based on block config, not separate registries.
    /// </summary>
    [HttpGet("relationships")]
    public async Task<ActionResult<RelationshipGraphDto>> GetRelationships()
    {
        var allBlocks = (await _blockDiscovery.DiscoverAllAsync()).ToList();

        var agents = allBlocks.Where(b => b.Designation == "agent").ToList();
        var tools = allBlocks.Where(b => b.Designation == "tool").ToList();

        var nodes = new List<GraphNodeDto>();
        var edges = new List<GraphEdgeDto>();

        foreach (var agent in agents)
        {
            var metrics = agent.GetAggregatedMetrics();
            nodes.Add(new GraphNodeDto
            {
                Id = agent.Id,
                Label = agent.Name,
                Type = "agent",
                Score = metrics != null ? Math.Round(metrics.OverallScore, 1) : 0
            });

            // Phase 18: Tool references now in config.tools or config.agent.availableTools
            var availableTools = GetAvailableToolsFromConfig(agent);
            foreach (var toolId in availableTools)
            {
                edges.Add(new GraphEdgeDto
                {
                    Source = agent.Id,
                    Target = toolId,
                    Type = "uses-tool"
                });
            }
        }

        foreach (var tool in tools)
        {
            var metrics = tool.GetAggregatedMetrics();
            nodes.Add(new GraphNodeDto
            {
                Id = tool.Id,
                Label = tool.Name,
                Type = "tool",
                Score = metrics != null ? Math.Round(metrics.OverallScore, 1) : 0
            });
        }

        return Ok(new RelationshipGraphDto
        {
            Nodes = nodes,
            Edges = edges
        });
    }

    /// <summary>
    /// Promote a block by setting its designation.
    /// Phase 18: Now delegates to block designation instead of creating separate entities.
    /// </summary>
    [HttpPost("promote")]
    public async Task<IActionResult> PromoteWorkflow([FromBody] PromoteRequest request)
    {
        if (request.DesignationType != "tool" && request.DesignationType != "agent")
        {
            return BadRequest(new { error = "Invalid designation type. Use 'tool' or 'agent'." });
        }

        var block = await _blockDiscovery.GetByIdAsync(request.BlockId);
        if (block == null)
        {
            return NotFound(new { error = $"Block '{request.BlockId}' not found" });
        }

        block.SetDesignation(request.DesignationType);
        if (request.Category != null) block.SetCategory(request.Category);
        if (request.Tags != null) block.SetTags(request.Tags);

        return Ok(new { message = $"Block promoted to {request.DesignationType} '{block.Id}'", type = request.DesignationType, id = block.Id });
    }

    private static List<string> GetAvailableToolsFromConfig(BlockDefinition block)
    {
        var tools = new List<string>();
        if (block.Config == null) return tools;

        // Check config.tools (common pattern)
        if (block.Config.TryGetValue("tools", out var toolsObj) && toolsObj is System.Text.Json.JsonElement toolsArr)
        {
            if (toolsArr.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var item in toolsArr.EnumerateArray())
                {
                    if (item.ValueKind == System.Text.Json.JsonValueKind.String)
                        tools.Add(item.GetString()!);
                }
            }
        }

        // Check config.agent.availableTools
        if (block.Config.TryGetValue("agent", out var agentObj) && agentObj is System.Text.Json.JsonElement agentEl)
        {
            if (agentEl.ValueKind == System.Text.Json.JsonValueKind.Object &&
                agentEl.TryGetProperty("availableTools", out var atProp) &&
                atProp.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var item in atProp.EnumerateArray())
                {
                    if (item.ValueKind == System.Text.Json.JsonValueKind.String)
                        tools.Add(item.GetString()!);
                }
            }
        }

        return tools;
    }

    private static List<ActivityItemDto> GetRecentActivity(List<BlockDefinition> agents, List<BlockDefinition> tools)
    {
        var activities = new List<ActivityItemDto>();

        foreach (var agent in agents)
        {
            var metrics = agent.GetAggregatedMetrics();
            if (metrics?.LastRunAt != null)
            {
                activities.Add(new ActivityItemDto
                {
                    Id = agent.Id,
                    Name = agent.Name,
                    Type = "agent",
                    Action = "run",
                    Timestamp = metrics.LastRunAt.Value,
                    Score = Math.Round(metrics.OverallScore, 1)
                });
            }
        }

        foreach (var tool in tools)
        {
            var metrics = tool.GetAggregatedMetrics();
            if (metrics?.LastRunAt != null)
            {
                activities.Add(new ActivityItemDto
                {
                    Id = tool.Id,
                    Name = tool.Name,
                    Type = "tool",
                    Action = "run",
                    Timestamp = metrics.LastRunAt.Value,
                    Score = Math.Round(metrics.OverallScore, 1)
                });
            }
        }

        return activities
            .OrderByDescending(a => a.Timestamp)
            .Take(10)
            .ToList();
    }

    private static CategoryBreakdownDto GetCategoryBreakdown(List<BlockDefinition> agents, List<BlockDefinition> tools)
    {
        return new CategoryBreakdownDto
        {
            Agents = agents
                .GroupBy(a => a.Category ?? "general")
                .ToDictionary(g => g.Key, g => g.Count()),
            Tools = tools
                .GroupBy(t => t.Category ?? "general")
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
