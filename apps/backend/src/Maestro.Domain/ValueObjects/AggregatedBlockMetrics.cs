namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Aggregated metrics across all executions of a block.
/// Universal — applies to every block type (inference, tool, agent, workflow, etc.).
/// Stored in BlockDefinition.Metadata["metrics"].
/// </summary>
public class AggregatedBlockMetrics
{
    // ── Core counters (universal) ──

    public int TotalRuns { get; set; }
    public int SuccessfulRuns { get; set; }
    public int FailedRuns { get; set; }
    public int CancelledRuns { get; set; }

    /// <summary>
    /// Success rate as percentage (0-100).
    /// </summary>
    public double SuccessRate => TotalRuns > 0 ? (double)SuccessfulRuns / TotalRuns * 100 : 0;

    // ── Performance averages (universal) ──

    public double AvgExecutionTimeMs { get; set; }
    public double AvgTokenCost { get; set; }
    public double AvgScore { get; set; }

    // ── Agent-specific (optional, null for non-agents) ──

    public double? AvgStepsPerRun { get; set; }
    public double? AvgToolsUsedPerRun { get; set; }
    public double? AvgTaskCompletionScore { get; set; }
    public double? AvgEfficiencyScore { get; set; }
    public double? AvgQualityScore { get; set; }

    /// <summary>
    /// Breakdown of tool usage (agent blocks only).
    /// </summary>
    public Dictionary<string, ToolUsageEntry>? ToolUsage { get; set; }

    // ── Relationships ──

    /// <summary>
    /// Block IDs that use this block (e.g. agents that call this tool).
    /// </summary>
    public List<string> UsedBy { get; set; } = new();

    // ── Timestamps ──

    public DateTime? LastRunAt { get; set; }

    /// <summary>
    /// Computed overall score based on weighted metrics.
    /// Formula adapts based on available data.
    /// </summary>
    public double OverallScore
    {
        get
        {
            // Agent-style scoring (has quality metrics)
            if (AvgTaskCompletionScore.HasValue && AvgEfficiencyScore.HasValue && AvgQualityScore.HasValue)
            {
                return (SuccessRate * 0.35) +
                       (AvgTaskCompletionScore.Value * 0.20) +
                       (AvgEfficiencyScore.Value * 0.25) +
                       (AvgQualityScore.Value * 0.20);
            }

            // Tool/inference-style scoring (simpler)
            var speedScore = AvgExecutionTimeMs > 0 ? Math.Min(100, 10000 / AvgExecutionTimeMs) : 50;
            var costScore = AvgTokenCost > 0 ? Math.Min(100, 5000 / AvgTokenCost) : 50;

            return (SuccessRate * 0.4) +
                   (speedScore * 0.2) +
                   (costScore * 0.2) +
                   (AvgScore * 0.2);
        }
    }

    /// <summary>
    /// Record a basic run result (works for any block type).
    /// </summary>
    public void RecordRun(bool success, long executionTimeMs, int tokenCost, double score)
    {
        TotalRuns++;
        if (success) SuccessfulRuns++;
        else FailedRuns++;

        AvgExecutionTimeMs = RunningAverage(AvgExecutionTimeMs, executionTimeMs, TotalRuns);
        AvgTokenCost = RunningAverage(AvgTokenCost, tokenCost, TotalRuns);

        if (success && score > 0)
        {
            AvgScore = RunningAverage(AvgScore, score, SuccessfulRuns);
        }

        LastRunAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Record an agent-style run result with extended metrics.
    /// </summary>
    public void RecordAgentRun(string status, long executionTimeMs, int tokenCost,
        int stepsExecuted, List<string> toolsUsed,
        double taskCompletionScore, double efficiencyScore, double qualityScore)
    {
        TotalRuns++;

        switch (status)
        {
            case "completed":
                SuccessfulRuns++;
                break;
            case "failed":
                FailedRuns++;
                break;
            case "cancelled":
                CancelledRuns++;
                break;
        }

        AvgExecutionTimeMs = RunningAverage(AvgExecutionTimeMs, executionTimeMs, TotalRuns);
        AvgTokenCost = RunningAverage(AvgTokenCost, tokenCost, TotalRuns);
        AvgStepsPerRun = RunningAverage(AvgStepsPerRun ?? 0, stepsExecuted, TotalRuns);
        AvgToolsUsedPerRun = RunningAverage(AvgToolsUsedPerRun ?? 0, toolsUsed.Count, TotalRuns);

        if (status == "completed")
        {
            AvgTaskCompletionScore = RunningAverage(AvgTaskCompletionScore ?? 0, taskCompletionScore, SuccessfulRuns);
            AvgEfficiencyScore = RunningAverage(AvgEfficiencyScore ?? 0, efficiencyScore, SuccessfulRuns);
            AvgQualityScore = RunningAverage(AvgQualityScore ?? 0, qualityScore, SuccessfulRuns);
        }

        // Track tool usage
        if (toolsUsed.Count > 0)
        {
            ToolUsage ??= new();
            foreach (var toolId in toolsUsed)
            {
                if (!ToolUsage.ContainsKey(toolId))
                    ToolUsage[toolId] = new ToolUsageEntry();
                ToolUsage[toolId].Count++;
                if (status == "completed")
                    ToolUsage[toolId].SuccessCount++;
            }
        }

        LastRunAt = DateTime.UtcNow;
    }

    private static double RunningAverage(double current, double newValue, int count)
    {
        if (count <= 1) return newValue;
        return ((current * (count - 1)) + newValue) / count;
    }
}

/// <summary>
/// Tool usage statistics within an agent's aggregated metrics.
/// </summary>
public class ToolUsageEntry
{
    public int Count { get; set; }
    public int SuccessCount { get; set; }
    public double SuccessRate => Count > 0 ? (double)SuccessCount / Count * 100 : 0;
}
