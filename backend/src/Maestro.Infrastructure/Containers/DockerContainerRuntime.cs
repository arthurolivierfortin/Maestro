using System.Diagnostics;
using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Containers;

/// <summary>
/// Docker-based container runtime implementation.
/// Uses Docker CLI for container operations.
/// </summary>
public class DockerContainerRuntime : IContainerRuntime
{
    private readonly ILogger<DockerContainerRuntime> _logger;
    private readonly string _dockerPath;
    private bool? _isAvailable;

    public DockerContainerRuntime(ILogger<DockerContainerRuntime> logger)
    {
        _logger = logger;
        _dockerPath = FindDockerPath();
    }

    public string RuntimeType => "docker";

    public async Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default)
    {
        if (_isAvailable.HasValue)
            return _isAvailable.Value;

        try
        {
            var result = await RunDockerCommandAsync("version", cancellationToken: cancellationToken);
            _isAvailable = result.ExitCode == 0;
            
            if (_isAvailable.Value)
            {
                _logger.LogInformation("Docker runtime is available");
            }
            else
            {
                _logger.LogWarning("Docker command failed: {Error}", result.StandardError);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Docker is not available");
            _isAvailable = false;
        }

        return _isAvailable.Value;
    }

    public async Task<string> CreateContainerAsync(
        RuntimeConfiguration config,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(config.Image))
        {
            throw new InvalidOperationException("Docker image is required for container creation");
        }

        var args = new List<string> { "create" };

        // Add name if we want to track it (generate unique name)
        var containerName = $"maestro-{Guid.NewGuid():N}";
        args.Add("--name");
        args.Add(containerName);

        // Working directory
        if (!string.IsNullOrEmpty(config.WorkDir))
        {
            args.Add("-w");
            args.Add(config.WorkDir);
        }

        // Environment variables
        foreach (var env in config.Environment)
        {
            args.Add("-e");
            args.Add($"{env.Key}={env.Value}");
        }

        // Resource limits
        if (config.Resources != null)
        {
            if (!string.IsNullOrEmpty(config.Resources.CpuLimit))
            {
                args.Add("--cpus");
                args.Add(config.Resources.CpuLimit);
            }

            if (!string.IsNullOrEmpty(config.Resources.MemoryLimit))
            {
                args.Add("--memory");
                args.Add(config.Resources.MemoryLimit);
            }
        }

        // Network mode
        if (!string.IsNullOrEmpty(config.NetworkMode))
        {
            args.Add("--network");
            args.Add(config.NetworkMode);
        }
        else
        {
            // Default to no network for security
            args.Add("--network");
            args.Add("none");
        }

        // Security options
        args.Add("--security-opt");
        args.Add("no-new-privileges:true");

        // Read-only filesystem by default
        args.Add("--read-only");

        // Add tmpfs for /tmp
        args.Add("--tmpfs");
        args.Add("/tmp:rw,noexec,nosuid,size=100m");

        // Image
        args.Add(config.Image);

        // Default command (keep container running)
        args.Add("tail");
        args.Add("-f");
        args.Add("/dev/null");

        var result = await RunDockerCommandAsync(
            string.Join(" ", args.Select(EscapeArg)),
            cancellationToken: cancellationToken);

        if (result.ExitCode != 0)
        {
            throw new InvalidOperationException($"Failed to create container: {result.StandardError}");
        }

        var containerId = result.StandardOutput.Trim();
        _logger.LogInformation("Created container {ContainerId} with name {ContainerName}", containerId, containerName);
        
        return containerId;
    }

    public async Task StartContainerAsync(
        string containerId,
        CancellationToken cancellationToken = default)
    {
        var result = await RunDockerCommandAsync($"start {containerId}", cancellationToken: cancellationToken);
        
        if (result.ExitCode != 0)
        {
            throw new InvalidOperationException($"Failed to start container: {result.StandardError}");
        }

        _logger.LogInformation("Started container {ContainerId}", containerId);
    }

    public async Task StopContainerAsync(
        string containerId,
        int timeoutSeconds = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await RunDockerCommandAsync(
            $"stop -t {timeoutSeconds} {containerId}",
            cancellationToken: cancellationToken);
        
        if (result.ExitCode != 0)
        {
            _logger.LogWarning("Failed to stop container {ContainerId}: {Error}", containerId, result.StandardError);
        }
        else
        {
            _logger.LogInformation("Stopped container {ContainerId}", containerId);
        }
    }

    public async Task RemoveContainerAsync(
        string containerId,
        bool force = false,
        CancellationToken cancellationToken = default)
    {
        var forceFlag = force ? "-f " : "";
        var result = await RunDockerCommandAsync(
            $"rm {forceFlag}{containerId}",
            cancellationToken: cancellationToken);
        
        if (result.ExitCode != 0)
        {
            throw new InvalidOperationException($"Failed to remove container: {result.StandardError}");
        }

        _logger.LogInformation("Removed container {ContainerId}", containerId);
    }

    public async Task<ContainerExecResult> ExecuteAsync(
        string containerId,
        ContainerExecRequest command,
        CancellationToken cancellationToken = default)
    {
        var args = new List<string> { "exec" };

        // Working directory
        if (!string.IsNullOrEmpty(command.WorkingDirectory))
        {
            args.Add("-w");
            args.Add(command.WorkingDirectory);
        }

        // Environment variables
        foreach (var env in command.Environment)
        {
            args.Add("-e");
            args.Add($"{env.Key}={env.Value}");
        }

        // Container ID
        args.Add(containerId);

        // Command
        args.Add(command.Command);
        args.AddRange(command.Arguments);

        var timeout = command.Timeout ?? TimeSpan.FromMinutes(5);
        var stopwatch = Stopwatch.StartNew();

        var result = await RunDockerCommandAsync(
            string.Join(" ", args.Select(EscapeArg)),
            timeout,
            command.StandardInput,
            cancellationToken);

        stopwatch.Stop();

        return new ContainerExecResult
        {
            ExitCode = result.ExitCode,
            StandardOutput = result.StandardOutput,
            StandardError = result.StandardError,
            Duration = stopwatch.Elapsed,
            TimedOut = result.TimedOut
        };
    }

    public async Task<ContainerStatus> GetStatusAsync(
        string containerId,
        CancellationToken cancellationToken = default)
    {
        var result = await RunDockerCommandAsync(
            $"inspect --format \"{{{{.State.Status}}}}|{{{{.Name}}}}|{{{{.Config.Image}}}}|{{{{.Created}}}}|{{{{.State.StartedAt}}}}|{{{{.State.FinishedAt}}}}|{{{{.State.ExitCode}}}}|{{{{.State.Error}}}}\" {containerId}",
            cancellationToken: cancellationToken);

        if (result.ExitCode != 0)
        {
            return new ContainerStatus
            {
                ContainerId = containerId,
                State = ContainerState.Unknown,
                Error = result.StandardError
            };
        }

        var parts = result.StandardOutput.Trim().Split('|');
        var stateStr = parts.Length > 0 ? parts[0] : "unknown";

        return new ContainerStatus
        {
            ContainerId = containerId,
            State = ParseContainerState(stateStr),
            Name = parts.Length > 1 ? parts[1].TrimStart('/') : null,
            Image = parts.Length > 2 ? parts[2] : null,
            CreatedAt = parts.Length > 3 ? TryParseDateTime(parts[3]) : null,
            StartedAt = parts.Length > 4 ? TryParseDateTime(parts[4]) : null,
            FinishedAt = parts.Length > 5 ? TryParseDateTime(parts[5]) : null,
            ExitCode = parts.Length > 6 ? int.TryParse(parts[6], out var code) ? code : null : null,
            Error = parts.Length > 7 && !string.IsNullOrEmpty(parts[7]) ? parts[7] : null
        };
    }

    public async Task<string> GetLogsAsync(
        string containerId,
        int? tail = null,
        CancellationToken cancellationToken = default)
    {
        var tailArg = tail.HasValue ? $"--tail {tail.Value}" : "";
        var result = await RunDockerCommandAsync(
            $"logs {tailArg} {containerId}",
            cancellationToken: cancellationToken);

        return result.StandardOutput + result.StandardError;
    }

    public async Task CopyToContainerAsync(
        string containerId,
        string sourcePath,
        string destinationPath,
        CancellationToken cancellationToken = default)
    {
        var result = await RunDockerCommandAsync(
            $"cp {EscapeArg(sourcePath)} {containerId}:{EscapeArg(destinationPath)}",
            cancellationToken: cancellationToken);

        if (result.ExitCode != 0)
        {
            throw new InvalidOperationException($"Failed to copy to container: {result.StandardError}");
        }
    }

    public async Task CopyFromContainerAsync(
        string containerId,
        string sourcePath,
        string destinationPath,
        CancellationToken cancellationToken = default)
    {
        var result = await RunDockerCommandAsync(
            $"cp {containerId}:{EscapeArg(sourcePath)} {EscapeArg(destinationPath)}",
            cancellationToken: cancellationToken);

        if (result.ExitCode != 0)
        {
            throw new InvalidOperationException($"Failed to copy from container: {result.StandardError}");
        }
    }

    private async Task<DockerResult> RunDockerCommandAsync(
        string arguments,
        TimeSpan? timeout = null,
        string? stdin = null,
        CancellationToken cancellationToken = default)
    {
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = _dockerPath,
                Arguments = arguments,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                RedirectStandardInput = stdin != null,
                CreateNoWindow = true
            }
        };

        _logger.LogDebug("Running: docker {Arguments}", arguments);

        process.Start();

        if (stdin != null)
        {
            await process.StandardInput.WriteAsync(stdin);
            process.StandardInput.Close();
        }

        var stdoutTask = process.StandardOutput.ReadToEndAsync();
        var stderrTask = process.StandardError.ReadToEndAsync();

        var actualTimeout = timeout ?? TimeSpan.FromMinutes(5);
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(actualTimeout);

        try
        {
            await process.WaitForExitAsync(timeoutCts.Token);
            var stdout = await stdoutTask;
            var stderr = await stderrTask;

            return new DockerResult(process.ExitCode, stdout, stderr, false);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // Timed out
            try { process.Kill(entireProcessTree: true); } catch { }
            return new DockerResult(-1, "", "Command timed out", true);
        }
    }

    private static string FindDockerPath()
    {
        // Check common locations
        var paths = new[]
        {
            "docker",
            "/usr/bin/docker",
            "/usr/local/bin/docker",
            @"C:\Program Files\Docker\Docker\resources\bin\docker.exe"
        };

        foreach (var path in paths)
        {
            if (File.Exists(path) || path == "docker")
            {
                return path;
            }
        }

        return "docker";
    }

    private static string EscapeArg(string arg)
    {
        if (arg.Contains(' ') || arg.Contains('"'))
        {
            return $"\"{arg.Replace("\"", "\\\"")}\"";
        }
        return arg;
    }

    private static ContainerState ParseContainerState(string state)
    {
        return state.ToLowerInvariant() switch
        {
            "created" => ContainerState.Created,
            "running" => ContainerState.Running,
            "paused" => ContainerState.Paused,
            "restarting" => ContainerState.Restarting,
            "exited" => ContainerState.Exited,
            "dead" => ContainerState.Dead,
            "removing" => ContainerState.Removing,
            _ => ContainerState.Unknown
        };
    }

    private static DateTime? TryParseDateTime(string value)
    {
        if (string.IsNullOrEmpty(value) || value == "0001-01-01T00:00:00Z")
            return null;
        
        return DateTime.TryParse(value, out var dt) ? dt : null;
    }

    private record DockerResult(int ExitCode, string StandardOutput, string StandardError, bool TimedOut);
}
