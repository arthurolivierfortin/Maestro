using System.Diagnostics;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;
using Maestro.Domain.ValueObjects;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Executes tool/script blocks in a sandboxed subprocess.
/// This is a scaffold implementation that provides timeouts and
/// working-directory isolation. Network restrictions are noted but
/// not enforced by this scaffold.
/// </summary>
public class ToolBlockExecutor : IBlockExecutor
{
    public string SupportedType => "tool";

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block,
        ExecutionContext context,
        Dictionary<string, object> inputs,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();

        // Basic config options
        var config = block.Config ?? new Dictionary<string, object?>();
        config.TryGetValue("script", out var scriptObj);
        var script = scriptObj as string ?? string.Empty;

        config.TryGetValue("timeoutMs", out var timeoutObj);
        var timeoutMs = timeoutObj is int t ? t : 30000;

        // Working directory: try metadata 'path' entry, else current directory
        string? workingDir = null;
        if (block.Metadata != null && block.Metadata.TryGetValue("path", out var pathObj) && pathObj is string pathStr)
            workingDir = pathStr;
        workingDir ??= Directory.GetCurrentDirectory();

        // Determine runtime: default to pwsh on Windows, bash on Unix
        var runtime = config.TryGetValue("runtime", out var r) && r is string rs ? rs : (OperatingSystem.IsWindows() ? "powershell" : "bash");

        var resultOutputs = new Dictionary<string, object?>();
        var logs = new List<string>();

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = runtime,
                Arguments = runtime switch
                {
                    "powershell" => $"-NoProfile -NonInteractive -Command \"{script}\"",
                    "pwsh" => $"-NoProfile -NonInteractive -Command \"{script}\"",
                    "bash" => $"-lc \"{script}\"",
                    _ => $"-NoProfile -NonInteractive -Command \"{script}\"",
                },
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                WorkingDirectory = workingDir,
                CreateNoWindow = true,
                UseShellExecute = false,
            };

            using var proc = new Process { StartInfo = psi };
            proc.Start();

            var outputTask = proc.StandardOutput.ReadToEndAsync();
            var errorTask = proc.StandardError.ReadToEndAsync();

            var completed = await Task.WhenAny(Task.Run(() => proc.WaitForExit()), Task.Delay(timeoutMs, ct));
            if (completed is Task delayTask && delayTask.IsCompleted && !proc.HasExited)
            {
                try { proc.Kill(true); } catch { }
                logs.Add($"Process killed after timeout {timeoutMs}ms");
            }

            var stdout = await outputTask;
            var stderr = await errorTask;

            if (!string.IsNullOrWhiteSpace(stdout)) logs.Add(stdout.Trim());
            if (!string.IsNullOrWhiteSpace(stderr)) logs.Add(stderr.Trim());

            resultOutputs["stdout"] = stdout;
            resultOutputs["stderr"] = stderr;

            sw.Stop();

            return new BlockExecutionResult
            {
                Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                Logs = logs,
                Success = true,
                DurationMs = sw.ElapsedMilliseconds
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            logs.Add(ex.Message);
            return new BlockExecutionResult
            {
                Outputs = resultOutputs.ToDictionary(kv => kv.Key, kv => kv.Value),
                Logs = logs,
                Success = false,
                DurationMs = sw.ElapsedMilliseconds
            };
        }
    }
}
