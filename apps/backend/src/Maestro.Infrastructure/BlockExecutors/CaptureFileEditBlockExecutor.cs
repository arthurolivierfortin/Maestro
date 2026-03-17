using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Phase 62-A: Captures file-edit calls. If a previous write to the same path exists
/// in _capturedToolCalls, applies the replacement on the captured content.
/// Otherwise records the edit for later inspection.
/// </summary>
public class CaptureFileEditBlockExecutor : IBlockExecutor
{
    public string SupportedType => "capture-file-edit";

    public Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        var path = inputs.TryGetValue("path", out var pathObj) ? pathObj?.ToString() ?? "" : "";
        var oldString = inputs.TryGetValue("old_string", out var oldObj) ? oldObj?.ToString() ?? "" : "";
        var newString = inputs.TryGetValue("new_string", out var newObj) ? newObj?.ToString() ?? "" : "";

        if (string.IsNullOrEmpty(path))
        {
            result.Success = false;
            result.Outputs["error"] = "Missing required input: path";
            return Task.FromResult(result);
        }

        var captures = CaptureHelper.GetCaptures(context);

        // Try to find a previous write to this path and apply the replacement
        bool applied = false;
        if (!string.IsNullOrEmpty(oldString))
        {
            for (int i = captures.Count - 1; i >= 0; i--)
            {
                var c = captures[i];
                if (c.TryGetValue("path", out var p) &&
                    CaptureFileReadBlockExecutor.PathsMatch(p, path) &&
                    c.TryGetValue("toolId", out var tid) && tid == "file-write" &&
                    c.TryGetValue("content", out var content) &&
                    content.Contains(oldString))
                {
                    // Apply the replacement on the captured content
                    captures[i]["content"] = content.Replace(oldString, newString);
                    applied = true;
                    break;
                }
            }
        }

        // Always record the edit in captures
        captures.Add(new Dictionary<string, string>
        {
            ["toolId"] = "file-edit",
            ["path"] = path,
            ["old_string"] = oldString,
            ["new_string"] = newString,
            ["applied"] = applied.ToString().ToLowerInvariant(),
            ["timestamp"] = DateTime.UtcNow.ToString("o")
        });
        CaptureHelper.SetCaptures(context, captures);

        var suffix = applied ? " (replacement applied on captured content)" : "";
        result.Outputs["result"] = $"File edited: {path}{suffix}";
        result.Outputs["path"] = path;
        result.Logs.Add($"[capture] file-edit: {path}{suffix}");

        return Task.FromResult(result);
    }
}
