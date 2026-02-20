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
}
