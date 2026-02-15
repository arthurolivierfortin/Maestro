using Maestro.Infrastructure.Configuration;

namespace Maestro.Api.Configuration;

/// <summary>
/// IHostedService that runs on first startup to initialize ~/.maestro/ directory structure.
/// Creates required directories and copies system content if missing.
/// </summary>
public class FirstRunInitializer : IHostedService
{
    private readonly MaestroPathConfiguration _pathConfig;
    private readonly ILogger<FirstRunInitializer> _logger;

    public FirstRunInitializer(MaestroPathConfiguration pathConfig, ILogger<FirstRunInitializer> logger)
    {
        _pathConfig = pathConfig;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            var maestroHome = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                ".maestro");

            // Create directory structure
            var directories = new[]
            {
                maestroHome,
                Path.Combine(maestroHome, "logs"),
                Path.Combine(maestroHome, "config"),
                Path.Combine(maestroHome, "blocks"),
                Path.Combine(maestroHome, "cache")
            };

            foreach (var dir in directories)
            {
                if (!Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                    _logger.LogInformation("Created directory: {Dir}", dir);
                }
            }

            // Copy system content to ~/.maestro/ if not present
            var systemContentSource = Path.Combine(_pathConfig.RepoRootPath, "content", "system");
            var systemContentDest = Path.Combine(maestroHome, "system");

            if (Directory.Exists(systemContentSource) && !Directory.Exists(systemContentDest))
            {
                CopyDirectory(systemContentSource, systemContentDest);
                _logger.LogInformation("Copied system content to {Dest}", systemContentDest);
            }

            // Create default config.json if missing
            var configFile = Path.Combine(maestroHome, "config.json");
            if (!File.Exists(configFile))
            {
                var defaultConfig = """
                {
                  "backendUrl": "http://localhost:5000",
                  "llmProvider": {
                    "url": "http://localhost:5010"
                  }
                }
                """;
                File.WriteAllText(configFile, defaultConfig);
                _logger.LogInformation("Created default config: {Path}", configFile);
            }

            _logger.LogInformation("First-run initialization complete. Home: {Home}", maestroHome);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "First-run initialization encountered an error (non-fatal)");
        }

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private static void CopyDirectory(string source, string destination)
    {
        Directory.CreateDirectory(destination);

        foreach (var file in Directory.GetFiles(source))
        {
            var destFile = Path.Combine(destination, Path.GetFileName(file));
            File.Copy(file, destFile, overwrite: false);
        }

        foreach (var dir in Directory.GetDirectories(source))
        {
            var destDir = Path.Combine(destination, Path.GetFileName(dir));
            CopyDirectory(dir, destDir);
        }
    }
}
