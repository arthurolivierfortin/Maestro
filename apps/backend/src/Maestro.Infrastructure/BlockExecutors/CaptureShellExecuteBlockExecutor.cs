using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Phase 62-A: Captures shell-execute calls without running them.
/// Returns simulated terminal output for contract tests.
/// </summary>
public class CaptureShellExecuteBlockExecutor : IBlockExecutor
{
    public string SupportedType => "capture-shell-execute";

    public Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        var command = inputs.TryGetValue("command", out var cmdObj) ? cmdObj?.ToString() ?? "" : "";
        var workingDir = inputs.TryGetValue("workingDir", out var wdObj) ? wdObj?.ToString() ?? "" : "";

        if (string.IsNullOrEmpty(command))
        {
            result.Success = false;
            result.Outputs["error"] = "Missing required input: command";
            return Task.FromResult(result);
        }

        // Append to _capturedToolCalls
        var captures = CaptureHelper.GetCaptures(context);
        var capture = new Dictionary<string, string>
        {
            ["toolId"] = "shell-execute",
            ["command"] = command,
            ["timestamp"] = DateTime.UtcNow.ToString("o")
        };
        if (!string.IsNullOrEmpty(workingDir))
            capture["workingDir"] = workingDir;

        captures.Add(capture);
        CaptureHelper.SetCaptures(context, captures);

        result.Outputs["result"] = $"$ {command}\n(captured — not executed)";
        result.Logs.Add($"[capture] shell-execute: {command}");

        return Task.FromResult(result);
    }
}
