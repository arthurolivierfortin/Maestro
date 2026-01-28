namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a tool - a workflow designated for specific, well-defined tasks.
/// Tools are the building blocks that agents use to accomplish goals.
/// </summary>
public class ToolDefinition
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Version { get; set; } = "1.0.0";
    public string Designation { get; set; } = "tool";

    /// <summary>
    /// Reference to the underlying block/workflow that implements this tool.
    /// </summary>
    public string BlockId { get; set; } = string.Empty;

    /// <summary>
    /// JSON Schema for tool inputs (strict validation).
    /// </summary>
    public Dictionary<string, object> InputSchema { get; set; } = new();

    /// <summary>
    /// JSON Schema for tool outputs.
    /// </summary>
    public Dictionary<string, object> OutputSchema { get; set; } = new();

    /// <summary>
    /// Category for grouping (git, code, file, llm, etc.)
    /// </summary>
    public string Category { get; set; } = "general";

    /// <summary>
    /// Tags for search and filtering.
    /// </summary>
    public List<string> Tags { get; set; } = new();

    /// <summary>
    /// Author/creator of the tool.
    /// </summary>
    public string? Author { get; set; }

    /// <summary>
    /// Aggregated metrics from all runs.
    /// </summary>
    public ToolMetrics Metrics { get; set; } = new();

    /// <summary>
    /// When the tool was created.
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// When the tool was last updated.
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Aggregated metrics for a tool.
/// </summary>
public class ToolMetrics
{
    public int TotalRuns { get; set; }
    public int SuccessfulRuns { get; set; }
    public int FailedRuns { get; set; }

    /// <summary>
    /// Success rate as percentage (0-100).
    /// </summary>
    public double SuccessRate => TotalRuns > 0 ? (double)SuccessfulRuns / TotalRuns * 100 : 0;

    /// <summary>
    /// Average execution time in milliseconds.
    /// </summary>
    public double AvgExecutionTimeMs { get; set; }

    /// <summary>
    /// Average token cost per execution.
    /// </summary>
    public double AvgTokenCost { get; set; }

    /// <summary>
    /// Average quality score (0-100).
    /// </summary>
    public double AvgScore { get; set; }

    /// <summary>
    /// Computed overall score based on weighted metrics.
    /// </summary>
    public double OverallScore
    {
        get
        {
            // Weighted: Success 40%, Speed 20%, Cost 20%, Quality 20%
            var speedScore = AvgExecutionTimeMs > 0 ? Math.Min(100, 10000 / AvgExecutionTimeMs) : 50;
            var costScore = AvgTokenCost > 0 ? Math.Min(100, 5000 / AvgTokenCost) : 50;

            return (SuccessRate * 0.4) +
                   (speedScore * 0.2) +
                   (costScore * 0.2) +
                   (AvgScore * 0.2);
        }
    }

    /// <summary>
    /// Last time this tool was executed.
    /// </summary>
    public DateTime? LastRunAt { get; set; }

    /// <summary>
    /// List of agent IDs that use this tool.
    /// </summary>
    public List<string> UsedByAgents { get; set; } = new();

    /// <summary>
    /// Update metrics with a new run result.
    /// </summary>
    public void RecordRun(bool success, long executionTimeMs, int tokenCost, double score)
    {
        TotalRuns++;
        if (success) SuccessfulRuns++;
        else FailedRuns++;

        // Running average for execution time
        AvgExecutionTimeMs = ((AvgExecutionTimeMs * (TotalRuns - 1)) + executionTimeMs) / TotalRuns;

        // Running average for token cost
        AvgTokenCost = ((AvgTokenCost * (TotalRuns - 1)) + tokenCost) / TotalRuns;

        // Running average for score (only count successful runs for quality)
        if (success && score > 0)
        {
            var successCount = SuccessfulRuns;
            AvgScore = ((AvgScore * (successCount - 1)) + score) / successCount;
        }

        LastRunAt = DateTime.UtcNow;
    }
}
