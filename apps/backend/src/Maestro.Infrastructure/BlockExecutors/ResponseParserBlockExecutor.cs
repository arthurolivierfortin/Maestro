using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Parses a raw LLM response and returns structured output.
/// Reproduces EXACTLY the parsing logic from AgentBlockExecutor:
///   - ExtractJson for JSON extraction
///   - step-complete detection with summary extraction
///   - Multi-tool detection
///   - Trailing text capture
///   - Empty/non-JSON response → "retry"
///
/// Phase 53-C: Atomic block executor (not MultiNodeBlockExecutor).
/// </summary>
public class ResponseParserBlockExecutor : IBlockExecutor
{
    public string SupportedType => "response-parser";

    public Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        if (!inputs.TryGetValue("rawResponse", out var rawObj) || rawObj == null)
        {
            result.Outputs["type"] = "retry";
            result.Outputs["text"] = "";
            result.Logs.Add("No rawResponse input provided");
            return Task.FromResult(result);
        }

        var rawResponse = rawObj.ToString() ?? "";

        // Empty response → retry
        if (string.IsNullOrWhiteSpace(rawResponse))
        {
            result.Outputs["type"] = "retry";
            result.Outputs["text"] = "";
            result.Logs.Add("Empty response → retry");
            return Task.FromResult(result);
        }

        // Try to extract JSON
        var jsonContent = LLMBlockExecutorBase.ExtractJson(rawResponse);
        if (string.IsNullOrEmpty(jsonContent))
        {
            // Non-JSON response → text or retry
            if (rawResponse.Length > 20)
            {
                result.Outputs["type"] = "text";
                result.Outputs["text"] = rawResponse;
                result.Logs.Add("Non-JSON response → text");
            }
            else
            {
                result.Outputs["type"] = "retry";
                result.Outputs["text"] = rawResponse;
                result.Logs.Add("Short non-JSON response → retry");
            }
            return Task.FromResult(result);
        }

        try
        {
            using var doc = JsonDocument.Parse(jsonContent);
            if (doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty("tool", out var toolProp))
            {
                var toolId = toolProp.GetString() ?? "";
                var args = doc.RootElement.TryGetProperty("args", out var argsProp) ? argsProp : default;

                // step-complete detection
                if (toolId == "step-complete")
                {
                    // Multi-tool detection: maestro_cli before step-complete
                    var stepCompletePos = rawResponse.IndexOf("\"step-complete\"");
                    var maestroPos = rawResponse.IndexOf("maestro_cli");
                    if (maestroPos >= 0 && stepCompletePos >= 0 && maestroPos < stepCompletePos)
                    {
                        result.Outputs["type"] = "retry";
                        result.Outputs["text"] = "Multi-tool response detected: maestro_cli found before step-complete.";
                        result.Logs.Add("Multi-tool response detected → retry");
                        return Task.FromResult(result);
                    }

                    var summary = args.ValueKind == JsonValueKind.Object && args.TryGetProperty("summary", out var sumProp)
                        ? sumProp.GetString() ?? "Task completed"
                        : "Task completed";

                    // Trailing text capture (same logic as AgentBlockExecutor)
                    var jsonEndPos = rawResponse.IndexOf(jsonContent, StringComparison.Ordinal);
                    if (jsonEndPos >= 0)
                    {
                        var trailing = rawResponse.Substring(jsonEndPos + jsonContent.Length).Trim();
                        trailing = trailing.TrimStart('\n', '\r', '-', '#', ' ');
                        if (trailing.StartsWith("**"))
                        {
                            var closingBold = trailing.IndexOf("**", 2);
                            if (closingBold > 2)
                                trailing = trailing.Substring(2, closingBold - 2) + trailing.Substring(closingBold + 2);
                            else
                                trailing = trailing.TrimStart('*');
                        }
                        trailing = trailing.Trim();

                        if (!string.IsNullOrEmpty(trailing) && trailing.Length > 20 && !IsPromptArtifact(trailing))
                        {
                            summary = trailing;
                        }
                        else if (!string.IsNullOrEmpty(trailing) && trailing.Length > 5 && !IsPromptArtifact(trailing))
                        {
                            summary = summary + ". " + trailing;
                        }
                    }

                    result.Outputs["type"] = "step-complete";
                    result.Outputs["summary"] = summary;
                    result.Outputs["text"] = summary;
                    result.Outputs["toolId"] = "step-complete";
                    result.Outputs["args"] = args.ValueKind == JsonValueKind.Object ? args.ToString() : "{}";

                    // Extract structured fields from step-complete args so agents
                    // can capture them via set-variable nodes in their config.nodes.
                    if (args.ValueKind == JsonValueKind.Object)
                    {
                        if (args.TryGetProperty("blockId", out var bid))
                            result.Outputs["blockId"] = bid.GetString() ?? "";
                        if (args.TryGetProperty("fitness", out var fit))
                            result.Outputs["fitness"] = fit.ValueKind == JsonValueKind.Number
                                ? fit.GetDouble().ToString("F2")
                                : fit.GetString() ?? "";
                        if (args.TryGetProperty("blockPath", out var bp))
                            result.Outputs["blockPath"] = bp.GetString() ?? "";
                        if (args.TryGetProperty("testResults", out var tr))
                            result.Outputs["testResults"] = tr.ValueKind == JsonValueKind.String
                                ? tr.GetString() ?? ""
                                : tr.ToString();
                    }

                    result.Logs.Add($"step-complete: {summary}");
                    return Task.FromResult(result);
                }

                // Regular tool call
                result.Outputs["type"] = "tool-call";
                result.Outputs["toolId"] = toolId;
                result.Outputs["args"] = args.ValueKind == JsonValueKind.Object ? args.ToString() : "{}";
                result.Outputs["text"] = jsonContent;
                result.Logs.Add($"Tool call: {toolId}");

                // Multi-tool detection: extra tool calls after the parsed one
                var firstJsonEnd = rawResponse.IndexOf(jsonContent, StringComparison.Ordinal);
                if (firstJsonEnd >= 0)
                {
                    var afterFirst = rawResponse.Substring(firstJsonEnd + jsonContent.Length).Trim();
                    if (afterFirst.Contains("{\"tool\":"))
                    {
                        var extraCount = 0;
                        var searchPos = 0;
                        while ((searchPos = afterFirst.IndexOf("{\"tool\":", searchPos, StringComparison.Ordinal)) >= 0)
                        {
                            extraCount++;
                            searchPos += 8;
                        }
                        result.Outputs["extraToolCount"] = extraCount;
                        result.Logs.Add($"Multi-tool detected: {extraCount} extra tool call(s) in response");
                    }
                }

                return Task.FromResult(result);
            }
        }
        catch (JsonException ex)
        {
            result.Logs.Add($"JSON parse error: {ex.Message}");
        }

        // Valid JSON but no "tool" property → text
        result.Outputs["type"] = "text";
        result.Outputs["text"] = rawResponse;
        result.Logs.Add("JSON without tool property → text");
        return Task.FromResult(result);
    }

    /// <summary>
    /// Same prompt artifact detection as AgentBlockExecutor.
    /// </summary>
    private static bool IsPromptArtifact(string text)
    {
        ReadOnlySpan<string> markers = new[]
        {
            "[user]", "[assistant]", "[system]",
            "## Working Directory", "## Message", "## RepoPath",
            "## ConversationHistory", "## Conversation History",
            "\"role\":\"user\"", "\"role\":\"assistant\"", "\"role\":\"system\"",
            "\"role\": \"user\"", "\"role\": \"assistant\"", "\"role\": \"system\"",
        };

        foreach (var marker in markers)
        {
            if (text.Contains(marker, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }
}
