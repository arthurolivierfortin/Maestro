using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Reads a file from disk. Extracted from NodeExecutionEngine.ExecuteLoadNodeAsync.
/// Same logic: reads from path, returns content, estimates token count.
///
/// Phase 53-C: Atomic block executor.
/// </summary>
public class FileReadBlockExecutor : IBlockExecutor
{
    public string SupportedType => "file-read";

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        var path = inputs.TryGetValue("path", out var pathObj) ? pathObj?.ToString() : null;

        if (string.IsNullOrEmpty(path))
        {
            result.Success = false;
            result.Outputs["content"] = "";
            result.Outputs["error"] = "Missing required input: path";
            return result;
        }

        // Resolve relative paths against workingDir
        if (!Path.IsPathRooted(path))
        {
            var workingDir = context.Variables.TryGetValue("workingDir", out var wdObj)
                ? wdObj?.ToString() ?? Directory.GetCurrentDirectory()
                : Directory.GetCurrentDirectory();
            path = Path.Combine(workingDir, path);
        }

        // Phase 59-C: Check FileAccessRule before reading
        var accessCheckDir = context.Variables.TryGetValue("workingDir", out var wdCheck)
            ? wdCheck?.ToString() ?? "" : "";
        var readDenied = FileAccessChecker.CheckReadAccess(context, path, accessCheckDir);
        if (readDenied != null)
        {
            // For Hidden/Excluded files, return "not found" to avoid leaking existence
            result.Outputs["content"] = $"(file not found: {path})";
            result.Logs.Add($"File access denied (read): {path}");
            return result;
        }

        if (!File.Exists(path))
        {
            result.Outputs["content"] = $"(file not found: {path})";
            result.Logs.Add($"File not found: {path}");
            return result;
        }

        try
        {
            var content = await File.ReadAllTextAsync(path, ct);
            result.Outputs["content"] = content;
            result.Outputs["path"] = path;
            result.Outputs["size"] = content.Length;
            result.Logs.Add($"Read file: {path} ({content.Length} chars)");
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Outputs["content"] = "";
            result.Outputs["error"] = $"Failed to read file: {ex.Message}";
            result.Logs.Add($"Error reading {path}: {ex.Message}");
        }

        return result;
    }
}
