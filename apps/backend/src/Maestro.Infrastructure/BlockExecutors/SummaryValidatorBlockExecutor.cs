using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Validates step-complete summaries. Rejects raw JSON arrays — they indicate
/// the agent produced structured output instead of a conversational response.
/// Used in agent config.nodes to catch this pattern and redirect to retry.
/// </summary>
public class SummaryValidatorBlockExecutor : IBlockExecutor
{
    public string SupportedType => "summary-validator";

    public Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();
        var summary = inputs.TryGetValue("summary", out var s) ? s?.ToString() ?? "" : "";
        var trimmed = summary.Trim();

        // A raw JSON array (e.g., ["hello","hi","query"]) is NOT a valid conversational response.
        // It means the agent produced test values via step-complete instead of explaining.
        // Short arrays (< 300 chars) are almost certainly wrong; longer ones might be legitimate.
        if (trimmed.StartsWith("[") && trimmed.EndsWith("]") && trimmed.Length < 300)
        {
            result.Outputs["valid"] = "false";
            result.Outputs["reason"] = "Summary is a JSON array, not a conversational response. Answer the question in plain text with explanations.";
            result.Logs.Add($"[summary-validator] Rejected JSON array summary ({trimmed.Length} chars)");
        }
        else
        {
            result.Outputs["valid"] = "true";
            result.Outputs["reason"] = "";
            result.Logs.Add("[summary-validator] Summary OK");
        }

        return Task.FromResult(result);
    }
}
