using System.Collections.Generic;

namespace Maestro.Application.DTOs;

public class BlockExecutionResult
{
    public Dictionary<string, object> Outputs { get; set; } = new();
    public List<string> Logs { get; set; } = new();
    public bool Success { get; set; } = true;
    public long DurationMs { get; set; }
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public int TotalTokens { get; set; }
    public decimal EstimatedCostUsd { get; set; }

    /// <summary>
    /// If true, execution was stopped due to a cost limit being exceeded (enforcement="block").
    /// This is NOT an error — the session remains in idle state and can be resumed.
    /// Distinguished from Success=false (which indicates a real execution error).
    /// </summary>
    public bool CostLimitStopped { get; set; }
}
