using System.Diagnostics;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LLMProvider.Web.Services;

/// <summary>
/// Hosted service that launches the TUI monitor in a separate terminal window when the backend starts.
/// </summary>
public sealed class MonitorHostedService : IHostedService, IDisposable
{
    private readonly ILogger<MonitorHostedService> _logger;
    private readonly IConfiguration _configuration;
    private Process? _monitorProcess;
    private bool _disposed;

    public MonitorHostedService(ILogger<MonitorHostedService> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        var enabled = _configuration.GetValue("Monitor:AutoStart", true);
        if (!enabled)
        {
            _logger.LogInformation("Monitor auto-start is disabled");
            return Task.CompletedTask;
        }

        var monitorPath = FindMonitorPath();
        if (monitorPath is null)
        {
            _logger.LogWarning("Monitor project not found, skipping auto-start");
            return Task.CompletedTask;
        }

        try
        {
            LaunchMonitor(monitorPath);
            _logger.LogInformation("TUI Monitor launched in a new terminal window");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to launch TUI Monitor (non-fatal)");
        }

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        if (_monitorProcess is not null && !_monitorProcess.HasExited)
        {
            _logger.LogInformation("Stopping TUI Monitor...");
            try
            {
                _monitorProcess.Kill(entireProcessTree: true);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Error stopping monitor process");
            }
        }

        return Task.CompletedTask;
    }

    private void LaunchMonitor(string monitorPath)
    {
        var backendUrl = _configuration["Monitor:BackendUrl"] ?? "http://localhost:5000";
        var logDir = Path.Combine(Directory.GetCurrentDirectory(), "logs");

        // On Windows, open in a new cmd window
        // On Linux/Mac, try to open a new terminal
        if (OperatingSystem.IsWindows())
        {
            _monitorProcess = Process.Start(new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/c \"title LLM-Provider Monitor && cd /d \"{monitorPath}\" && npx tsx src/index.ts --url {backendUrl}\"",
                UseShellExecute = true,
                CreateNoWindow = false,
            });
        }
        else
        {
            // Fallback: just start it in background - user can attach manually
            _monitorProcess = Process.Start(new ProcessStartInfo
            {
                FileName = "npx",
                Arguments = $"tsx src/index.ts --url {backendUrl} --headless",
                WorkingDirectory = monitorPath,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            });
        }
    }

    private static string? FindMonitorPath()
    {
        var currentDir = Directory.GetCurrentDirectory();

        var possiblePaths = new[]
        {
            Path.GetFullPath(Path.Combine(currentDir, "..", "..", "..", "monitor")),
            Path.GetFullPath(Path.Combine(currentDir, "monitor")),
            Path.GetFullPath(Path.Combine(currentDir, "..", "monitor")),
            Path.GetFullPath(Path.Combine(currentDir, "..", "..", "monitor")),
        };

        foreach (var path in possiblePaths)
        {
            if (File.Exists(Path.Combine(path, "package.json")))
            {
                return path;
            }
        }

        return null;
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _monitorProcess?.Dispose();
        _disposed = true;
    }
}
