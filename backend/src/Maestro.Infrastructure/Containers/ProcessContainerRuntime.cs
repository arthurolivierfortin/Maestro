using System.Collections.Concurrent;
using System.Diagnostics;
using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Containers;

/// <summary>
/// Process-based runtime implementation for local development without Docker.
/// Runs commands directly on the host system with limited isolation.
/// </summary>
public class ProcessContainerRuntime : IContainerRuntime
{
    private readonly ILogger<ProcessContainerRuntime> _logger;
    private readonly ConcurrentDictionary<string, ProcessContainer> _containers = new();

    public ProcessContainerRuntime(ILogger<ProcessContainerRuntime> logger)
    {
        _logger = logger;
    }

    public string RuntimeType => "process";

    public Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default)
    {
        // Process runtime is always available
        return Task.FromResult(true);
    }

    public Task<string> CreateContainerAsync(
        RuntimeConfiguration config,
        CancellationToken cancellationToken = default)
    {
        var containerId = Guid.NewGuid().ToString("N");
        var container = new ProcessContainer
        {
            Id = containerId,
            Config = config,
            State = ContainerState.Created,
            CreatedAt = DateTime.UtcNow
        };

        _containers[containerId] = container;
        _logger.LogInformation("Created process container {ContainerId}", containerId);

        return Task.FromResult(containerId);
    }

    public Task StartContainerAsync(
        string containerId,
        CancellationToken cancellationToken = default)
    {
        if (!_containers.TryGetValue(containerId, out var container))
        {
            throw new InvalidOperationException($"Container not found: {containerId}");
        }

        container.State = ContainerState.Running;
        container.StartedAt = DateTime.UtcNow;
        _logger.LogInformation("Started process container {ContainerId}", containerId);

        return Task.CompletedTask;
    }

    public Task StopContainerAsync(
        string containerId,
        int timeoutSeconds = 10,
        CancellationToken cancellationToken = default)
    {
        if (!_containers.TryGetValue(containerId, out var container))
        {
            _logger.LogWarning("Container not found for stop: {ContainerId}", containerId);
            return Task.CompletedTask;
        }

        container.State = ContainerState.Exited;
        container.FinishedAt = DateTime.UtcNow;
        container.ExitCode = 0;
        _logger.LogInformation("Stopped process container {ContainerId}", containerId);

        return Task.CompletedTask;
    }

    public Task RemoveContainerAsync(
        string containerId,
        bool force = false,
        CancellationToken cancellationToken = default)
    {
        if (_containers.TryRemove(containerId, out _))
        {
            _logger.LogInformation("Removed process container {ContainerId}", containerId);
        }
        else
        {
            throw new InvalidOperationException($"Container not found: {containerId}");
        }

        return Task.CompletedTask;
    }

    public async Task<ContainerExecResult> ExecuteAsync(
        string containerId,
        ContainerExecRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!_containers.TryGetValue(containerId, out var container))
        {
            throw new InvalidOperationException($"Container not found: {containerId}");
        }

        if (container.State != ContainerState.Running)
        {
            throw new InvalidOperationException($"Container is not running: {containerId}");
        }

        var workDir = request.WorkingDirectory ?? container.Config.WorkDir ?? Directory.GetCurrentDirectory();

        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = request.Command,
                Arguments = string.Join(" ", request.Arguments.Select(EscapeArg)),
                WorkingDirectory = workDir,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                RedirectStandardInput = request.StandardInput != null,
                CreateNoWindow = true
            }
        };

        // Add environment variables from container config
        foreach (var env in container.Config.Environment)
        {
            process.StartInfo.Environment[env.Key] = env.Value;
        }

        // Add request-specific environment variables
        foreach (var env in request.Environment)
        {
            process.StartInfo.Environment[env.Key] = env.Value;
        }

        var stopwatch = Stopwatch.StartNew();
        var timedOut = false;

        try
        {
            process.Start();

            if (request.StandardInput != null)
            {
                await process.StandardInput.WriteAsync(request.StandardInput);
                process.StandardInput.Close();
            }

            var stdoutTask = process.StandardOutput.ReadToEndAsync();
            var stderrTask = process.StandardError.ReadToEndAsync();

            var timeout = request.Timeout ?? TimeSpan.FromMinutes(5);
            
            // Apply resource timeout if configured
            if (container.Config.Resources?.TimeoutSeconds is > 0 and int timeoutSec)
            {
                var resourceTimeout = TimeSpan.FromSeconds(timeoutSec);
                if (resourceTimeout < timeout)
                {
                    timeout = resourceTimeout;
                }
            }

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(timeout);

            try
            {
                await process.WaitForExitAsync(timeoutCts.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                timedOut = true;
                try { process.Kill(entireProcessTree: true); } catch { }
            }

            var stdout = await stdoutTask;
            var stderr = await stderrTask;
            stopwatch.Stop();

            return new ContainerExecResult
            {
                ExitCode = timedOut ? -1 : process.ExitCode,
                StandardOutput = stdout,
                StandardError = timedOut ? "Command timed out" : stderr,
                Duration = stopwatch.Elapsed,
                TimedOut = timedOut
            };
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "Failed to execute command in container {ContainerId}", containerId);
            
            return new ContainerExecResult
            {
                ExitCode = -1,
                StandardOutput = "",
                StandardError = ex.Message,
                Duration = stopwatch.Elapsed,
                TimedOut = false
            };
        }
    }

    public Task<ContainerStatus> GetStatusAsync(
        string containerId,
        CancellationToken cancellationToken = default)
    {
        if (!_containers.TryGetValue(containerId, out var container))
        {
            return Task.FromResult(new ContainerStatus
            {
                ContainerId = containerId,
                State = ContainerState.Unknown,
                Error = "Container not found"
            });
        }

        return Task.FromResult(new ContainerStatus
        {
            ContainerId = containerId,
            State = container.State,
            Name = $"process-{containerId[..8]}",
            Image = "local-process",
            CreatedAt = container.CreatedAt,
            StartedAt = container.StartedAt,
            FinishedAt = container.FinishedAt,
            ExitCode = container.ExitCode
        });
    }

    public Task<string> GetLogsAsync(
        string containerId,
        int? tail = null,
        CancellationToken cancellationToken = default)
    {
        // Process runtime doesn't maintain logs
        return Task.FromResult("Logs not available for process runtime");
    }

    public Task CopyToContainerAsync(
        string containerId,
        string sourcePath,
        string destinationPath,
        CancellationToken cancellationToken = default)
    {
        // For process runtime, just copy files locally
        if (!_containers.TryGetValue(containerId, out _))
        {
            throw new InvalidOperationException($"Container not found: {containerId}");
        }

        if (File.Exists(sourcePath))
        {
            var destDir = Path.GetDirectoryName(destinationPath);
            if (!string.IsNullOrEmpty(destDir) && !Directory.Exists(destDir))
            {
                Directory.CreateDirectory(destDir);
            }
            File.Copy(sourcePath, destinationPath, overwrite: true);
        }
        else if (Directory.Exists(sourcePath))
        {
            CopyDirectory(sourcePath, destinationPath);
        }
        else
        {
            throw new FileNotFoundException($"Source not found: {sourcePath}");
        }

        return Task.CompletedTask;
    }

    public Task CopyFromContainerAsync(
        string containerId,
        string sourcePath,
        string destinationPath,
        CancellationToken cancellationToken = default)
    {
        // For process runtime, source and destination are both local
        return CopyToContainerAsync(containerId, sourcePath, destinationPath, cancellationToken);
    }

    private static void CopyDirectory(string source, string destination)
    {
        if (!Directory.Exists(destination))
        {
            Directory.CreateDirectory(destination);
        }

        foreach (var file in Directory.GetFiles(source))
        {
            var destFile = Path.Combine(destination, Path.GetFileName(file));
            File.Copy(file, destFile, overwrite: true);
        }

        foreach (var dir in Directory.GetDirectories(source))
        {
            var destDir = Path.Combine(destination, Path.GetFileName(dir));
            CopyDirectory(dir, destDir);
        }
    }

    public Task<ContainerResourceStats?> GetResourceStatsAsync(
        string containerId,
        CancellationToken cancellationToken = default)
    {
        // Process-based containers don't have resource monitoring
        // Could potentially use Process.TotalProcessorTime and WorkingSet64 in the future
        return Task.FromResult<ContainerResourceStats?>(null);
    }

    private static string EscapeArg(string arg)
    {
        if (arg.Contains(' ') || arg.Contains('"'))
        {
            return $"\"{arg.Replace("\"", "\\\"")}\"";
        }
        return arg;
    }

    private class ProcessContainer
    {
        public required string Id { get; init; }
        public required RuntimeConfiguration Config { get; init; }
        public ContainerState State { get; set; }
        public DateTime CreatedAt { get; init; }
        public DateTime? StartedAt { get; set; }
        public DateTime? FinishedAt { get; set; }
        public int? ExitCode { get; set; }
    }
}
