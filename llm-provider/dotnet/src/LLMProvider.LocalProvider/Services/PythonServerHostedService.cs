using System.Diagnostics;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LLMProvider.LocalProvider.Services;

/// <summary>
/// Hosted service that manages the Python FastAPI server lifecycle.
/// Automatically starts the server when the .NET app starts and stops it on shutdown.
/// </summary>
public sealed class PythonServerHostedService : IHostedService, IDisposable
{
    private readonly LocalProviderOptions _options;
    private readonly ILogger<PythonServerHostedService> _logger;
    private readonly HttpClient _httpClient;
    private Process? _pythonProcess;
    private bool _disposed;

    public PythonServerHostedService(
        IOptions<LocalProviderOptions> options,
        ILogger<PythonServerHostedService> logger)
    {
        _options = options.Value;
        _logger = logger;
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(5)
        };
    }

    /// <summary>
    /// Indicates whether the Python server is running.
    /// </summary>
    public bool IsRunning => _pythonProcess is not null && !_pythonProcess.HasExited;

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!_options.AutoStart)
        {
            _logger.LogInformation("Python server auto-start is disabled");
            return;
        }

        // Check if server is already running
        if (await IsServerRunningAsync())
        {
            _logger.LogInformation("Python server is already running at {BaseUrl}", _options.BaseUrl);
            return;
        }

        _logger.LogInformation("Starting Python server...");

        try
        {
            await StartPythonServerAsync(cancellationToken);
            _logger.LogInformation("Python server started successfully at {BaseUrl}", _options.BaseUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start Python server");
            // Don't throw - the .NET app can still work with Azure provider
        }
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_pythonProcess is null || _pythonProcess.HasExited)
        {
            return;
        }

        _logger.LogInformation("Stopping Python server...");

        try
        {
            // Try graceful shutdown first
            _pythonProcess.CloseMainWindow();

            // Wait a bit for graceful shutdown
            var exitTask = _pythonProcess.WaitForExitAsync(cancellationToken);
            var timeoutTask = Task.Delay(5000, cancellationToken);

            if (await Task.WhenAny(exitTask, timeoutTask) == timeoutTask)
            {
                // Force kill if not exited
                _logger.LogWarning("Python server did not exit gracefully, killing process");
                _pythonProcess.Kill(entireProcessTree: true);
            }

            _logger.LogInformation("Python server stopped");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error stopping Python server");
        }
    }

    private async Task<bool> IsServerRunningAsync()
    {
        try
        {
            var response = await _httpClient.GetAsync($"{_options.BaseUrl}/health");
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private async Task StartPythonServerAsync(CancellationToken cancellationToken)
    {
        // Determine project path
        var projectPath = _options.ProjectPath;
        if (string.IsNullOrWhiteSpace(projectPath))
        {
            // Try to find the project path relative to the current directory
            projectPath = FindProjectPath();
        }

        if (string.IsNullOrWhiteSpace(projectPath))
        {
            throw new InvalidOperationException(
                "Could not determine LLM-Provider project path. " +
                "Please set Providers:Local:ProjectPath in configuration.");
        }

        var serverScript = Path.Combine(projectPath, "api", "server.py");
        if (!File.Exists(serverScript))
        {
            throw new FileNotFoundException($"Python server script not found at: {serverScript}");
        }

        // Build environment variables
        var envVars = new Dictionary<string, string>
        {
            ["PYTHONUNBUFFERED"] = "1"
        };

        if (_options.PreloadModel && !string.IsNullOrWhiteSpace(_options.DefaultModel))
        {
            envVars["LLM_PRELOAD_MODEL"] = _options.DefaultModel;
        }

        // Start the Python process
        var startInfo = new ProcessStartInfo
        {
            FileName = _options.PythonPath,
            Arguments = $"-m uvicorn api.server:app --host 0.0.0.0 --port {_options.Port}",
            WorkingDirectory = projectPath,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };

        foreach (var (key, value) in envVars)
        {
            startInfo.EnvironmentVariables[key] = value;
        }

        _pythonProcess = new Process { StartInfo = startInfo };

        // Log output
        _pythonProcess.OutputDataReceived += (_, args) =>
        {
            if (!string.IsNullOrEmpty(args.Data))
            {
                _logger.LogDebug("[Python] {Output}", args.Data);
            }
        };

        _pythonProcess.ErrorDataReceived += (_, args) =>
        {
            if (!string.IsNullOrEmpty(args.Data))
            {
                // Uvicorn logs to stderr by default
                _logger.LogDebug("[Python] {Output}", args.Data);
            }
        };

        _pythonProcess.Start();
        _pythonProcess.BeginOutputReadLine();
        _pythonProcess.BeginErrorReadLine();

        // Wait for the server to be ready
        var maxRetries = 30;
        for (var i = 0; i < maxRetries; i++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (_pythonProcess.HasExited)
            {
                throw new InvalidOperationException(
                    $"Python server process exited unexpectedly with code {_pythonProcess.ExitCode}");
            }

            if (await IsServerRunningAsync())
            {
                return;
            }

            await Task.Delay(1000, cancellationToken);
        }

        throw new TimeoutException("Python server did not become ready within the timeout period");
    }

    private static string? FindProjectPath()
    {
        // Try to find the project root by looking for api/server.py
        var currentDir = Directory.GetCurrentDirectory();

        // Check common patterns
        var possiblePaths = new[]
        {
            currentDir,
            Path.GetFullPath(Path.Combine(currentDir, "..")),
            Path.GetFullPath(Path.Combine(currentDir, "..", "..")),
            Path.GetFullPath(Path.Combine(currentDir, "..", "..", "..")),
        };

        foreach (var path in possiblePaths)
        {
            var serverPath = Path.Combine(path, "api", "server.py");
            if (File.Exists(serverPath))
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

        _pythonProcess?.Dispose();
        _httpClient.Dispose();
        _disposed = true;
    }
}
