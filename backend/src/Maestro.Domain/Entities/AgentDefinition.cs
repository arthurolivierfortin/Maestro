namespace Maestro.Domain.Entities;

/// <summary>
/// Represents an agent - an autonomous orchestrator that uses tools to accomplish goals.
/// Agents make decisions, orchestrate workflows, and can use other agents as tools.
/// </summary>
public class AgentDefinition
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Version { get; set; } = "1.0.0";
    public string Designation { get; set; } = "agent";

    /// <summary>
    /// Reference to the underlying block/workflow that implements this agent.
    /// </summary>
    public string BlockId { get; set; } = string.Empty;

    /// <summary>
    /// List of capabilities this agent has.
    /// </summary>
    public List<string> Capabilities { get; set; } = new();

    /// <summary>
    /// Tool IDs this agent can use.
    /// </summary>
    public List<string> AvailableTools { get; set; } = new();

    /// <summary>
    /// Other agent IDs this agent can use as tools.
    /// </summary>
    public List<string> AvailableAgents { get; set; } = new();

    /// <summary>
    /// Agent configuration.
    /// </summary>
    public AgentConfig Config { get; set; } = new();

    /// <summary>
    /// Category for grouping (development, analysis, automation, etc.)
    /// </summary>
    public string Category { get; set; } = "general";

    /// <summary>
    /// Tags for search and filtering.
    /// </summary>
    public List<string> Tags { get; set; } = new();

    /// <summary>
    /// Author/creator of the agent.
    /// </summary>
    public string? Author { get; set; }

    /// <summary>
    /// Aggregated metrics from all runs.
    /// </summary>
    public AgentMetrics Metrics { get; set; } = new();

    /// <summary>
    /// When the agent was created.
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// When the agent was last updated.
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Configuration for an agent.
/// </summary>
public class AgentConfig
{
    /// <summary>
    /// Preferred LLM model for this agent.
    /// </summary>
    public string? Model { get; set; }

    /// <summary>
    /// Maximum execution steps before stopping.
    /// </summary>
    public int MaxSteps { get; set; } = 50;

    /// <summary>
    /// Token budget for the entire execution.
    /// </summary>
    public int MaxTokens { get; set; } = 10000;

    /// <summary>
    /// LLM temperature setting.
    /// </summary>
    public double Temperature { get; set; } = 0.7;

    /// <summary>
    /// Maximum execution time in milliseconds.
    /// </summary>
    public int TimeoutMs { get; set; } = 300000; // 5 minutes

    /// <summary>
    /// Whether to require approval for certain actions.
    /// </summary>
    public bool RequireApproval { get; set; } = false;

    /// <summary>
    /// System prompt override for the agent.
    /// </summary>
    public string? SystemPrompt { get; set; }
}

/// <summary>
/// Aggregated metrics for an agent.
/// </summary>
public class AgentMetrics
{
    public int TotalRuns { get; set; }
    public int CompletedRuns { get; set; }
    public int FailedRuns { get; set; }
    public int CancelledRuns { get; set; }

    /// <summary>
    /// Completion rate as percentage (0-100).
    /// </summary>
    public double CompletionRate => TotalRuns > 0 ? (double)CompletedRuns / TotalRuns * 100 : 0;

    /// <summary>
    /// Average execution time in milliseconds.
    /// </summary>
    public double AvgExecutionTimeMs { get; set; }

    /// <summary>
    /// Average token cost per execution.
    /// </summary>
    public double AvgTokenCost { get; set; }

    /// <summary>
    /// Average number of steps per run.
    /// </summary>
    public double AvgStepsPerRun { get; set; }

    /// <summary>
    /// Average number of tools used per run.
    /// </summary>
    public double AvgToolsUsedPerRun { get; set; }

    // Quality metrics (0-100)
    public double AvgTaskCompletionScore { get; set; }
    public double AvgEfficiencyScore { get; set; }
    public double AvgQualityScore { get; set; }

    /// <summary>
    /// Computed overall score based on weighted metrics.
    /// </summary>
    public double OverallScore
    {
        get
        {
            // Weighted: Completion 35%, Tool Selection 20%, Efficiency 25%, Quality 20%
            return (CompletionRate * 0.35) +
                   (AvgTaskCompletionScore * 0.20) +
                   (AvgEfficiencyScore * 0.25) +
                   (AvgQualityScore * 0.20);
        }
    }

    /// <summary>
    /// Breakdown of tool usage by this agent.
    /// </summary>
    public Dictionary<string, ToolUsageStats> ToolUsage { get; set; } = new();

    /// <summary>
    /// Last time this agent was executed.
    /// </summary>
    public DateTime? LastRunAt { get; set; }

    /// <summary>
    /// Update metrics with a new run result.
    /// </summary>
    public void RecordRun(AgentRunResult result)
    {
        TotalRuns++;

        switch (result.Status)
        {
            case "completed":
                CompletedRuns++;
                break;
            case "failed":
                FailedRuns++;
                break;
            case "cancelled":
                CancelledRuns++;
                break;
        }

        // Running averages
        AvgExecutionTimeMs = ((AvgExecutionTimeMs * (TotalRuns - 1)) + result.ExecutionTimeMs) / TotalRuns;
        AvgTokenCost = ((AvgTokenCost * (TotalRuns - 1)) + result.TokenCost) / TotalRuns;
        AvgStepsPerRun = ((AvgStepsPerRun * (TotalRuns - 1)) + result.StepsExecuted) / TotalRuns;
        AvgToolsUsedPerRun = ((AvgToolsUsedPerRun * (TotalRuns - 1)) + result.ToolsUsed.Count) / TotalRuns;

        // Quality scores (only for completed runs)
        if (result.Status == "completed")
        {
            var completedCount = CompletedRuns;
            AvgTaskCompletionScore = ((AvgTaskCompletionScore * (completedCount - 1)) + result.TaskCompletionScore) / completedCount;
            AvgEfficiencyScore = ((AvgEfficiencyScore * (completedCount - 1)) + result.EfficiencyScore) / completedCount;
            AvgQualityScore = ((AvgQualityScore * (completedCount - 1)) + result.QualityScore) / completedCount;
        }

        // Update tool usage
        foreach (var toolId in result.ToolsUsed)
        {
            if (!ToolUsage.ContainsKey(toolId))
            {
                ToolUsage[toolId] = new ToolUsageStats();
            }
            ToolUsage[toolId].Count++;
            if (result.Status == "completed")
            {
                ToolUsage[toolId].SuccessCount++;
            }
        }

        LastRunAt = DateTime.UtcNow;
    }
}

/// <summary>
/// Statistics for tool usage by an agent.
/// </summary>
public class ToolUsageStats
{
    public int Count { get; set; }
    public int SuccessCount { get; set; }
    public double SuccessRate => Count > 0 ? (double)SuccessCount / Count * 100 : 0;
}

/// <summary>
/// Result of an agent run for metrics recording.
/// </summary>
public class AgentRunResult
{
    public string Status { get; set; } = "completed"; // completed, failed, cancelled
    public long ExecutionTimeMs { get; set; }
    public int TokenCost { get; set; }
    public int StepsExecuted { get; set; }
    public List<string> ToolsUsed { get; set; } = new();
    public double TaskCompletionScore { get; set; }
    public double EfficiencyScore { get; set; }
    public double QualityScore { get; set; }
}
