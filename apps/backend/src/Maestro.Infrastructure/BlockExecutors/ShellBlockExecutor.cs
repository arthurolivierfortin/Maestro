using System.Diagnostics;
using System.Text;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Microsoft.Extensions.Logging;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Executes a shell command. Extracted from NodeExecutionEngine.RunShellAsync.
/// Same logic: cross-platform (Windows cmd.exe, Linux/Mac bash),
/// timeout support, stdout capture.
///
/// Phase 53-C: Atomic block executor.
/// </summary>
public class ShellBlockExecutor : IBlockExecutor
{
    private readonly ILogger<ShellBlockExecutor> _logger;

    public string SupportedType => "shell";

    public ShellBlockExecutor(ILogger<ShellBlockExecutor> logger)
    {
        _logger = logger;
    }

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        // Try inputs first, then fall back to block config (for git-diff, git-log etc.)
        string? command = null;
        if (inputs.TryGetValue("command", out var cmdObj) && cmdObj != null && !string.IsNullOrEmpty(cmdObj.ToString()))
        {
            command = cmdObj.ToString()!;
        }
        else if (block.Config != null)
        {
            // Build command from config.command + config.args
            var configCmd = block.Config.TryGetValue("command", out var cc) ? cc?.ToString() : null;
            if (!string.IsNullOrEmpty(configCmd))
            {
                var args = "";
                if (block.Config.TryGetValue("args", out var argsObj) && argsObj != null)
                {
                    if (argsObj is System.Text.Json.JsonElement je && je.ValueKind == System.Text.Json.JsonValueKind.Array)
                        args = string.Join(" ", je.EnumerateArray().Select(a => a.GetString() ?? ""));
                    else
                        args = argsObj.ToString() ?? "";
                }
                command = string.IsNullOrEmpty(args) ? configCmd : $"{configCmd} {args}";
            }
        }

        if (string.IsNullOrEmpty(command))
        {
            result.Success = false;
            result.Outputs["stdout"] = "";
            result.Outputs["stderr"] = "(error: shell block missing inputs.command and config.command)";
            result.Outputs["exitCode"] = -1;
            return result;
        }
        var workingDir = inputs.TryGetValue("workingDirectory", out var wdObj)
            ? wdObj?.ToString() ?? Directory.GetCurrentDirectory()
            : (context.Variables.TryGetValue("workingDir", out var ctxWd) ? ctxWd?.ToString() ?? Directory.GetCurrentDirectory() : Directory.GetCurrentDirectory());

        var timeoutSec = 60;
        if (inputs.TryGetValue("timeoutSeconds", out var tsObj))
        {
            if (tsObj is int tsi) timeoutSec = tsi;
            else if (tsObj is long tsl) timeoutSec = (int)tsl;
            else int.TryParse(tsObj?.ToString(), out timeoutSec);
            if (timeoutSec <= 0) timeoutSec = 60;
        }

        result.Logs.Add($"Shell: {command} (timeout: {timeoutSec}s, dir: {workingDir})");

        var (stdout, stderr, exitCode) = await RunShellAsync(workingDir, command, timeoutSec);

        result.Outputs["stdout"] = stdout;
        result.Outputs["stderr"] = stderr;
        result.Outputs["exitCode"] = exitCode;
        result.Success = exitCode == 0;
        result.Logs.Add($"Shell exit code: {exitCode}, stdout: {stdout.Length} chars");

        return result;
    }

    /// <summary>
    /// Extracted from NodeExecutionEngine.RunShellAsync — same logic exactly.
    /// </summary>
    private async Task<(string stdout, string stderr, int exitCode)> RunShellAsync(
        string workingDirectory, string command, int timeoutSeconds = 60)
    {
        try
        {
            var isWindows = OperatingSystem.IsWindows();
            var shell = isWindows ? "cmd.exe" : "/bin/bash";
            var shellArgs = isWindows ? $"/c {command}" : $"-c \"{command.Replace("\"", "\\\"")}\"";

            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = shell,
                    Arguments = shellArgs,
                    WorkingDirectory = workingDirectory,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };

            var stdout = new StringBuilder();
            var stderr = new StringBuilder();
            process.OutputDataReceived += (_, e) => { if (e.Data != null) stdout.AppendLine(e.Data); };
            process.ErrorDataReceived += (_, e) => { if (e.Data != null) stderr.AppendLine(e.Data); };

            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));
            try
            {
                await process.WaitForExitAsync(cts.Token);
            }
            catch (OperationCanceledException)
            {
                process.Kill(true);
                return ("(command timed out)", "", -1);
            }

            return (stdout.ToString().TrimEnd(), stderr.ToString().TrimEnd(), process.ExitCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Shell command failed: {Command}", command);
            return ($"(error: {ex.Message})", ex.Message, -1);
        }
    }
}
