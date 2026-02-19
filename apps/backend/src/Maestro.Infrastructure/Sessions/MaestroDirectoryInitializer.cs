using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Sessions;

/// <summary>
/// Initializes the .maestro/ directory structure within a bound repository.
/// Called when a session binds to a repository to ensure standard directories exist.
/// </summary>
public static class MaestroDirectoryInitializer
{
    /// <summary>
    /// Standard subdirectories created within .maestro/.
    /// </summary>
    private static readonly string[] StandardDirectories =
    {
        "blocks",
        "docs",
        "logs",
        "artifacts",
        "metrics"
    };

    /// <summary>
    /// Ensures the .maestro/ directory and its standard subdirectories exist
    /// within the given repository path.
    /// </summary>
    /// <param name="repositoryPath">Root of the bound repository.</param>
    /// <param name="logger">Optional logger.</param>
    /// <returns>The path to the .maestro/ directory.</returns>
    public static string Initialize(string repositoryPath, ILogger? logger = null)
    {
        var maestroDir = Path.Combine(repositoryPath, ".maestro");

        if (!Directory.Exists(maestroDir))
        {
            Directory.CreateDirectory(maestroDir);
            logger?.LogInformation("Created .maestro directory at {Path}", maestroDir);
        }

        foreach (var subDir in StandardDirectories)
        {
            var subDirPath = Path.Combine(maestroDir, subDir);
            if (!Directory.Exists(subDirPath))
            {
                Directory.CreateDirectory(subDirPath);
                logger?.LogDebug("Created .maestro/{SubDir} at {Path}", subDir, subDirPath);
            }
        }

        // Create .gitkeep files so empty directories are tracked by git
        foreach (var subDir in StandardDirectories)
        {
            var gitkeep = Path.Combine(maestroDir, subDir, ".gitkeep");
            if (!File.Exists(gitkeep))
            {
                File.WriteAllText(gitkeep, string.Empty);
            }
        }

        return maestroDir;
    }
}
