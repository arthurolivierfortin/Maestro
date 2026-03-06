using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Writes content to a file on disk.
/// Phase 53 gap: was handled natively in old ToolBlockExecutor, now standalone.
/// </summary>
public class FileWriteBlockExecutor : IBlockExecutor
{
    public string SupportedType => "file-write";

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        var path = inputs.TryGetValue("path", out var pathObj) ? pathObj?.ToString() : null;
        var content = inputs.TryGetValue("content", out var contentObj) ? contentObj?.ToString() ?? "" : "";

        if (string.IsNullOrEmpty(path))
        {
            result.Success = false;
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

        try
        {
            var dir = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                Directory.CreateDirectory(dir);

            await File.WriteAllTextAsync(path, content, ct);
            result.Outputs["result"] = $"File written: {path} ({content.Length} chars)";
            result.Outputs["path"] = path;
            result.Outputs["size"] = content.Length;
            result.Logs.Add($"Wrote file: {path} ({content.Length} chars)");
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Outputs["error"] = $"Failed to write file: {ex.Message}";
            result.Logs.Add($"Error writing {path}: {ex.Message}");
        }

        return result;
    }
}
