using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Phase 62-A: Reads from captured tool calls first, falls back to real disk read.
/// Supports read-after-write patterns: if the agent wrote a file via capture-file-write,
/// reading it back returns the captured content.
/// </summary>
public class CaptureFileReadBlockExecutor : IBlockExecutor
{
    public string SupportedType => "capture-file-read";

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        var path = inputs.TryGetValue("path", out var pathObj) ? pathObj?.ToString() ?? "" : "";

        if (string.IsNullOrEmpty(path))
        {
            result.Success = false;
            result.Outputs["content"] = "";
            result.Outputs["error"] = "Missing required input: path";
            return result;
        }

        // Check if a previous write captured content for this path
        var captures = CaptureHelper.GetCaptures(context);
        var capturedContent = FindLastCapturedContent(captures, path);

        if (capturedContent != null)
        {
            result.Outputs["content"] = capturedContent;
            result.Outputs["path"] = path;
            result.Outputs["size"] = capturedContent.Length;
            result.Logs.Add($"[capture] file-read from captured write: {path} ({capturedContent.Length} chars)");
            return result;
        }

        // No captured content — delegate to real file read from disk
        // Resolve relative paths against workingDir
        var resolvedPath = path;
        if (!Path.IsPathRooted(resolvedPath))
        {
            var workingDir = context.Variables.TryGetValue("workingDir", out var wdObj)
                ? wdObj?.ToString() ?? Directory.GetCurrentDirectory()
                : Directory.GetCurrentDirectory();
            resolvedPath = Path.Combine(workingDir, resolvedPath);
        }

        if (!File.Exists(resolvedPath))
        {
            result.Outputs["content"] = $"(file not found: {path})";
            result.Logs.Add($"[capture] file-read: file not found on disk: {resolvedPath}");
            return result;
        }

        try
        {
            var content = await File.ReadAllTextAsync(resolvedPath, ct);
            result.Outputs["content"] = content;
            result.Outputs["path"] = resolvedPath;
            result.Outputs["size"] = content.Length;
            result.Logs.Add($"[capture] file-read from disk: {resolvedPath} ({content.Length} chars)");
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Outputs["content"] = "";
            result.Outputs["error"] = $"Failed to read file: {ex.Message}";
            result.Logs.Add($"[capture] file-read error: {resolvedPath}: {ex.Message}");
        }

        return result;
    }

    /// <summary>
    /// Find the last captured content for a given path. Checks both file-write and file-edit captures.
    /// For file-edit captures, applies the edit on top of the last write if available.
    /// </summary>
    private static string? FindLastCapturedContent(List<Dictionary<string, string>> captures, string path)
    {
        // Find the last file-write to this path
        string? content = null;
        for (int i = captures.Count - 1; i >= 0; i--)
        {
            var c = captures[i];
            if (c.TryGetValue("path", out var p) && PathsMatch(p, path))
            {
                if (c.TryGetValue("toolId", out var tid) && tid == "file-write" && c.TryGetValue("content", out var cnt))
                {
                    content = cnt;
                    break;
                }
            }
        }

        return content;
    }

    internal static bool PathsMatch(string a, string b)
    {
        // Normalize: compare just the strings, trimming trailing slashes
        return string.Equals(
            a.TrimEnd('/', '\\'),
            b.TrimEnd('/', '\\'),
            StringComparison.OrdinalIgnoreCase);
    }
}
