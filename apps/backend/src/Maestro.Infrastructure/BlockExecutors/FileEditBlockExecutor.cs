using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Performs string replacement edits on files.
/// Phase 53 gap: was handled natively in old ToolBlockExecutor, now standalone.
/// </summary>
public class FileEditBlockExecutor : IBlockExecutor
{
    public string SupportedType => "file-edit";

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        var path = inputs.TryGetValue("path", out var pathObj) ? pathObj?.ToString() : null;
        var oldString = inputs.TryGetValue("old_string", out var oldObj) ? oldObj?.ToString() : null;
        var newString = inputs.TryGetValue("new_string", out var newObj) ? newObj?.ToString() ?? "" : "";

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

        if (!File.Exists(path))
        {
            result.Success = false;
            result.Outputs["error"] = $"File not found: {path}";
            return result;
        }

        try
        {
            var content = await File.ReadAllTextAsync(path, ct);

            if (string.IsNullOrEmpty(oldString))
            {
                // Full file replacement
                await File.WriteAllTextAsync(path, newString, ct);
                result.Outputs["result"] = $"File overwritten: {path}";
            }
            else if (content.Contains(oldString))
            {
                var updated = content.Replace(oldString, newString);
                await File.WriteAllTextAsync(path, updated, ct);
                result.Outputs["result"] = $"Edit applied to {path}";
            }
            else
            {
                result.Success = false;
                result.Outputs["error"] = $"old_string not found in {path}";
                return result;
            }

            result.Outputs["path"] = path;
            result.Logs.Add($"Edited file: {path}");
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Outputs["error"] = $"Failed to edit file: {ex.Message}";
            result.Logs.Add($"Error editing {path}: {ex.Message}");
        }

        return result;
    }
}
