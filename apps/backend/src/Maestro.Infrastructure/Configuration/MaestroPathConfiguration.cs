using System;
using System.Collections.Generic;
using System.IO;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Configuration
{
    /// <summary>
    /// Provides centralized path resolution for Maestro directories.
    /// Supports environment variable overrides and configuration file settings.
    /// </summary>
    public class MaestroPathConfiguration
    {
        private readonly IConfiguration? _configuration;
        private readonly ILogger<MaestroPathConfiguration>? _logger;
        
        private string? _globalBlocksPath;
        private string? _userBlocksPath;
        private string? _projectBlocksPath;
        private string? _repoRootPath;
        
        /// <summary>
        /// Creates a new instance of MaestroPathConfiguration.
        /// </summary>
        /// <param name="configuration">Optional configuration source for path settings.</param>
        /// <param name="logger">Optional logger for path resolution logging.</param>
        public MaestroPathConfiguration(
            IConfiguration? configuration = null,
            ILogger<MaestroPathConfiguration>? logger = null)
        {
            _configuration = configuration;
            _logger = logger;
            Initialize();
        }
        
        /// <summary>
        /// Gets the path to the global blocks directory.
        /// Resolution order: Environment variable → Configuration → Default (repo root/blocks).
        /// </summary>
        public string GlobalBlocksPath => _globalBlocksPath!;
        
        /// <summary>
        /// Gets the path to the user blocks directory (~/.maestro/blocks).
        /// Resolution order: Environment variable → Configuration → Default.
        /// </summary>
        public string UserBlocksPath => _userBlocksPath!;
        
        /// <summary>
        /// Gets the path to the project blocks directory (./.maestro/blocks).
        /// Resolution order: Environment variable → Configuration → Default.
        /// </summary>
        public string ProjectBlocksPath => _projectBlocksPath!;
        
        /// <summary>
        /// Gets the repository root path (used for global blocks resolution).
        /// </summary>
        public string RepoRootPath => _repoRootPath!;
        
        /// <summary>
        /// Gets all search paths for block discovery in priority order.
        /// Project blocks have highest priority, then user blocks, then global blocks.
        /// Also includes any additional paths from environment variable or configuration.
        /// </summary>
        public string[] GetSearchPaths()
        {
            var basePaths = new List<string> { ProjectBlocksPath, UserBlocksPath, GlobalBlocksPath };

            // Add any additional project paths from environment
            var additionalPaths = Environment.GetEnvironmentVariable(MaestroConstants.AdditionalProjectPathsEnvVar);
            if (!string.IsNullOrEmpty(additionalPaths))
            {
                // Split by both colon and semicolon for cross-platform compatibility
                var paths = additionalPaths.Split(new[] { ':', ';' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var path in paths)
                {
                    var trimmedPath = path.Trim();
                    if (!string.IsNullOrEmpty(trimmedPath) && Directory.Exists(trimmedPath))
                    {
                        basePaths.Add(trimmedPath);
                        _logger?.LogInformation("Added additional project path from env: {Path}", trimmedPath);
                    }
                }
            }

            // Add any additional project paths from configuration
            var configPaths = _configuration?.GetSection($"{MaestroConstants.ConfigurationSection}:{MaestroConstants.PathsConfigKey}:AdditionalProjects").Get<string[]>();
            if (configPaths != null)
            {
                foreach (var path in configPaths)
                {
                    var trimmedPath = path?.Trim();
                    if (!string.IsNullOrEmpty(trimmedPath) && Directory.Exists(trimmedPath) && !basePaths.Contains(trimmedPath))
                    {
                        basePaths.Add(trimmedPath);
                        _logger?.LogInformation("Added additional project path from config: {Path}", trimmedPath);
                    }
                }
            }

            return basePaths.ToArray();
        }
        
        /// <summary>
        /// Ensures all configured directories exist.
        /// Creates them if they don't exist.
        /// </summary>
        public void EnsureDirectoriesExist()
        {
            EnsureDirectoryExists(GlobalBlocksPath, "Global blocks");
            EnsureDirectoryExists(UserBlocksPath, "User blocks");
            EnsureDirectoryExists(ProjectBlocksPath, "Project blocks");
        }
        
        private void Initialize()
        {
            // Resolve repository root first (needed for global blocks path)
            _repoRootPath = ResolveRepoRootPath();
            
            // Resolve each path with fallback chain
            _globalBlocksPath = ResolveGlobalBlocksPath();
            _userBlocksPath = ResolveUserBlocksPath();
            _projectBlocksPath = ResolveProjectBlocksPath();
            
            LogPaths();
        }
        
        private string ResolveRepoRootPath()
        {
            // 1. Check environment variable
            var envPath = Environment.GetEnvironmentVariable(MaestroConstants.RepoRootEnvVar);
            if (!string.IsNullOrEmpty(envPath) && Directory.Exists(envPath))
            {
                return Path.GetFullPath(envPath);
            }
            
            // 2. Check configuration
            var configPath = _configuration?.GetValue<string>($"{MaestroConstants.ConfigurationSection}:{MaestroConstants.PathsConfigKey}:RepoRoot");
            if (!string.IsNullOrEmpty(configPath) && Directory.Exists(configPath))
            {
                return Path.GetFullPath(configPath);
            }
            
            // 3. Try to find repo root by looking for common markers
            return FindRepoRoot() ?? Directory.GetCurrentDirectory();
        }
        
        private string? FindRepoRoot()
        {
            // Start from current directory and walk up looking for repo markers
            var current = Directory.GetCurrentDirectory();
            var markers = new[] { ".git", "maestro.config.json" };
            
            while (!string.IsNullOrEmpty(current))
            {
                foreach (var marker in markers)
                {
                    var markerPath = Path.Combine(current, marker);
                    if (File.Exists(markerPath) || Directory.Exists(markerPath))
                    {
                        return current;
                    }
                }
                
                var parent = Directory.GetParent(current)?.FullName;
                if (parent == current) break; // Reached root
                current = parent;
            }
            
            return null;
        }
        
        private string ResolveGlobalBlocksPath()
        {
            // 1. Check environment variable
            var envPath = Environment.GetEnvironmentVariable(MaestroConstants.GlobalBlocksPathEnvVar);
            if (!string.IsNullOrEmpty(envPath))
            {
                return Path.GetFullPath(envPath);
            }
            
            // 2. Check configuration
            var configPath = _configuration?.GetValue<string>($"{MaestroConstants.ConfigurationSection}:{MaestroConstants.PathsConfigKey}:GlobalBlocks");
            if (!string.IsNullOrEmpty(configPath))
            {
                // If relative, resolve from repo root
                return Path.IsPathRooted(configPath) 
                    ? configPath 
                    : Path.GetFullPath(Path.Combine(_repoRootPath!, configPath));
            }
            
            // 3. Default: {repo_root}/blocks
            return Path.Combine(_repoRootPath!, MaestroConstants.DefaultGlobalBlocksRelativePath);
        }
        
        private string ResolveUserBlocksPath()
        {
            // 1. Check environment variable
            var envPath = Environment.GetEnvironmentVariable(MaestroConstants.UserBlocksPathEnvVar);
            if (!string.IsNullOrEmpty(envPath))
            {
                return Path.GetFullPath(envPath);
            }
            
            // 2. Check configuration
            var configPath = _configuration?.GetValue<string>($"{MaestroConstants.ConfigurationSection}:{MaestroConstants.PathsConfigKey}:UserBlocks");
            if (!string.IsNullOrEmpty(configPath))
            {
                return Path.GetFullPath(configPath);
            }
            
            // 3. Default: ~/.maestro/blocks
            var userHome = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            return Path.Combine(userHome, MaestroConstants.DefaultUserBlocksRelativePath);
        }
        
        private string ResolveProjectBlocksPath()
        {
            // 1. Check environment variable
            var envPath = Environment.GetEnvironmentVariable(MaestroConstants.ProjectBlocksPathEnvVar);
            if (!string.IsNullOrEmpty(envPath))
            {
                return Path.GetFullPath(envPath);
            }
            
            // 2. Check configuration
            var configPath = _configuration?.GetValue<string>($"{MaestroConstants.ConfigurationSection}:{MaestroConstants.PathsConfigKey}:ProjectBlocks");
            if (!string.IsNullOrEmpty(configPath))
            {
                // If relative, resolve from current directory
                return Path.IsPathRooted(configPath) 
                    ? configPath 
                    : Path.GetFullPath(configPath);
            }
            
            // 3. Default: ./.maestro/blocks (relative to current directory)
            return Path.Combine(Directory.GetCurrentDirectory(), MaestroConstants.DefaultProjectBlocksRelativePath);
        }
        
        private void EnsureDirectoryExists(string path, string description)
        {
            try
            {
                if (!Directory.Exists(path))
                {
                    Directory.CreateDirectory(path);
                    _logger?.LogInformation("{Description} directory created at: {Path}", description, path);
                }
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to create {Description} directory at: {Path}", description, path);
            }
        }
        
        private void LogPaths()
        {
            _logger?.LogInformation("Maestro path configuration:");
            _logger?.LogInformation("  Repository root: {Path}", _repoRootPath);
            _logger?.LogInformation("  Global blocks:   {Path}", _globalBlocksPath);
            _logger?.LogInformation("  User blocks:     {Path}", _userBlocksPath);
            _logger?.LogInformation("  Project blocks:  {Path}", _projectBlocksPath);
        }
    }
}
