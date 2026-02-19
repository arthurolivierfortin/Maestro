using Maestro.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Services;

/// <summary>
/// File system browser implementation.
/// Provides directory listing and navigation for project folder selection.
/// Supports both native and Docker-mounted filesystems.
/// </summary>
public class FileSystemBrowser : IFileSystemBrowser
{
    private readonly ILogger<FileSystemBrowser>? _logger;
    private readonly bool _isRunningInDocker;
    private readonly string? _hostMountPath;
    private readonly string? _hostUsersPath;
    private readonly string? _hostHomePath;

    public FileSystemBrowser(ILogger<FileSystemBrowser>? logger = null)
    {
        _logger = logger;

        // Detect if running in Docker via environment variable or /.dockerenv file
        _isRunningInDocker = Environment.GetEnvironmentVariable("MAESTRO_RUNNING_IN_DOCKER") == "true"
                            || File.Exists("/.dockerenv");

        _hostMountPath = Environment.GetEnvironmentVariable("MAESTRO_HOST_MOUNT_PATH");
        _hostUsersPath = Environment.GetEnvironmentVariable("MAESTRO_HOST_USERS_PATH");
        _hostHomePath = Environment.GetEnvironmentVariable("MAESTRO_HOST_HOME_PATH");

        if (_isRunningInDocker)
        {
            _logger?.LogInformation("FileSystemBrowser running in Docker mode. Host mount: {HostMount}, Users: {UsersPath}, Home: {HomePath}",
                _hostMountPath, _hostUsersPath, _hostHomePath);
        }
    }

    public Task<DirectoryListingResult> ListDirectoryAsync(string? path = null, CancellationToken ct = default)
    {
        try
        {
            // If no path provided, return drives/roots
            if (string.IsNullOrEmpty(path))
            {
                return Task.FromResult(ListRoots());
            }

            var fullPath = Path.GetFullPath(path);
            if (!Directory.Exists(fullPath))
            {
                throw new DirectoryNotFoundException($"Directory not found: {fullPath}");
            }

            var dirInfo = new System.IO.DirectoryInfo(fullPath);
            var parentPath = dirInfo.Parent?.FullName;

            var directories = new List<DirectoryEntryInfo>();
            var files = new List<FileEntryInfo>();

            // List directories
            try
            {
                foreach (var dir in dirInfo.EnumerateDirectories())
                {
                    try
                    {
                        var isHidden = (dir.Attributes & FileAttributes.Hidden) != 0;
                        var isMaestroProject = Directory.Exists(Path.Combine(dir.FullName, ".maestro"));
                        var isGitRepo = Directory.Exists(Path.Combine(dir.FullName, ".git"));

                        directories.Add(new DirectoryEntryInfo
                        {
                            Name = dir.Name,
                            Path = dir.FullName,
                            LastModified = dir.LastWriteTimeUtc,
                            IsMaestroProject = isMaestroProject,
                            IsGitRepository = isGitRepo,
                            IsHidden = isHidden
                        });
                    }
                    catch (UnauthorizedAccessException)
                    {
                        // Skip directories we can't access
                    }
                }
            }
            catch (UnauthorizedAccessException)
            {
                _logger?.LogWarning("Access denied listing directories in {Path}", fullPath);
            }

            // List files (limited to show structure)
            try
            {
                foreach (var file in dirInfo.EnumerateFiles().Take(100))
                {
                    try
                    {
                        var isHidden = (file.Attributes & FileAttributes.Hidden) != 0;

                        files.Add(new FileEntryInfo
                        {
                            Name = file.Name,
                            Path = file.FullName,
                            Size = file.Length,
                            LastModified = file.LastWriteTimeUtc,
                            Extension = file.Extension,
                            IsHidden = isHidden
                        });
                    }
                    catch (UnauthorizedAccessException)
                    {
                        // Skip files we can't access
                    }
                }
            }
            catch (UnauthorizedAccessException)
            {
                _logger?.LogWarning("Access denied listing files in {Path}", fullPath);
            }

            // Sort directories and files by name
            directories = directories.OrderBy(d => d.IsHidden).ThenBy(d => d.Name).ToList();
            files = files.OrderBy(f => f.IsHidden).ThenBy(f => f.Name).ToList();

            var isMaestroProjectCurrent = Directory.Exists(Path.Combine(fullPath, ".maestro"));
            var isGitRepoCurrent = Directory.Exists(Path.Combine(fullPath, ".git"));

            return Task.FromResult(new DirectoryListingResult
            {
                CurrentPath = fullPath,
                ParentPath = parentPath,
                Directories = directories,
                Files = files,
                IsMaestroProject = isMaestroProjectCurrent,
                IsGitRepository = isGitRepoCurrent
            });
        }
        catch (Exception ex) when (ex is not DirectoryNotFoundException)
        {
            _logger?.LogError(ex, "Error listing directory {Path}", path);
            throw;
        }
    }

    public Task<IEnumerable<CommonDirectoryInfo>> GetCommonDirectoriesAsync(CancellationToken ct = default)
    {
        var directories = new List<CommonDirectoryInfo>();

        // When running in Docker, use mounted host paths instead of container paths
        if (_isRunningInDocker)
        {
            return Task.FromResult(GetCommonDirectoriesForDocker());
        }

        // Native mode: use Environment.GetFolderPath
        var userHome = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);

        // Helper function to add special folder if it exists
        void TryAddSpecialFolder(Environment.SpecialFolder folder, string displayName, string icon)
        {
            var path = Environment.GetFolderPath(folder);
            if (!string.IsNullOrEmpty(path) && Directory.Exists(path))
            {
                directories.Add(new CommonDirectoryInfo
                {
                    Name = displayName,
                    Path = path,
                    Icon = icon
                });
            }
        }

        // Helper function to try common path patterns if SpecialFolder doesn't work
        void TryAddCommonPath(string displayName, string icon, params string[] pathPatterns)
        {
            foreach (var pattern in pathPatterns)
            {
                if (Directory.Exists(pattern))
                {
                    directories.Add(new CommonDirectoryInfo
                    {
                        Name = displayName,
                        Path = pattern,
                        Icon = icon
                    });
                    return; // Only add first match
                }
            }
        }

        // Add all common special folders (cross-platform)
        // These are ordered as they typically appear in native file explorers

        // 1. User Home Directory (always first)
        TryAddSpecialFolder(Environment.SpecialFolder.UserProfile, "Home", "home");

        // 2. Desktop
        TryAddSpecialFolder(Environment.SpecialFolder.Desktop, "Desktop", "desktop");

        // 3. Documents
        TryAddSpecialFolder(Environment.SpecialFolder.MyDocuments, "Documents", "file-text");

        // 4. Downloads (SpecialFolder enum doesn't exist in all .NET versions, try common paths)
        if (!string.IsNullOrEmpty(userHome))
        {
            TryAddCommonPath("Downloads", "download",
                Path.Combine(userHome, "Downloads"),
                Path.Combine(userHome, "downloads")
            );
        }

        // 5. Pictures
        TryAddSpecialFolder(Environment.SpecialFolder.MyPictures, "Pictures", "image");

        // 6. Music
        TryAddSpecialFolder(Environment.SpecialFolder.MyMusic, "Music", "music");

        // 7. Videos
        TryAddSpecialFolder(Environment.SpecialFolder.MyVideos, "Videos", "video");

        // 8. Development directories (show ALL that exist, not just first one)
        if (!string.IsNullOrEmpty(userHome))
        {
            AddDevelopmentDirectories(directories, userHome);
        }

        return Task.FromResult(directories.AsEnumerable());
    }

    /// <summary>
    /// Get common directories when running in Docker with mounted host filesystem.
    /// Uses the mounted paths at /host/home and /host/Users.
    /// </summary>
    private IEnumerable<CommonDirectoryInfo> GetCommonDirectoriesForDocker()
    {
        var directories = new List<CommonDirectoryInfo>();

        // Use mounted host home directory
        var hostHome = _hostHomePath;
        if (string.IsNullOrEmpty(hostHome) || !Directory.Exists(hostHome))
        {
            _logger?.LogWarning("Host home directory not mounted. Quick access will be limited.");
            return directories;
        }

        _logger?.LogDebug("Getting common directories from host home: {HostHome}", hostHome);

        // 1. Home directory
        directories.Add(new CommonDirectoryInfo
        {
            Name = "Home",
            Path = hostHome,
            Icon = "home"
        });

        // Helper to add directory if it exists
        void TryAddPath(string displayName, string icon, params string[] subPaths)
        {
            foreach (var subPath in subPaths)
            {
                var fullPath = Path.Combine(hostHome, subPath);
                if (Directory.Exists(fullPath))
                {
                    directories.Add(new CommonDirectoryInfo
                    {
                        Name = displayName,
                        Path = fullPath,
                        Icon = icon
                    });
                    return; // Only add first match
                }
            }
        }

        // 2. Desktop
        TryAddPath("Desktop", "desktop", "Desktop");

        // 3. Documents
        TryAddPath("Documents", "file-text", "Documents", "My Documents");

        // 4. Downloads
        TryAddPath("Downloads", "download", "Downloads");

        // 5. Pictures
        TryAddPath("Pictures", "image", "Pictures", "My Pictures");

        // 6. Music
        TryAddPath("Music", "music", "Music", "My Music");

        // 7. Videos
        TryAddPath("Videos", "video", "Videos", "My Videos");

        // 8. OneDrive (Windows specific, very common)
        TryAddPath("OneDrive", "cloud", "OneDrive", "OneDrive - Personal");

        // 9. Development directories
        AddDevelopmentDirectories(directories, hostHome);

        return directories;
    }

    /// <summary>
    /// Add common development directories to the list.
    /// </summary>
    private void AddDevelopmentDirectories(List<CommonDirectoryInfo> directories, string basePath)
    {
        var devDirs = new[]
        {
            Path.Combine(basePath, "Projects"),
            Path.Combine(basePath, "projects"),
            Path.Combine(basePath, "Development"),
            Path.Combine(basePath, "dev"),
            Path.Combine(basePath, "Code"),
            Path.Combine(basePath, "code"),
            Path.Combine(basePath, "workspace"),
            Path.Combine(basePath, "repos"),
            Path.Combine(basePath, "git"),
            Path.Combine(basePath, "src"),
            Path.Combine(basePath, "source")
        };

        foreach (var dir in devDirs)
        {
            if (Directory.Exists(dir))
            {
                // Avoid duplicates if folder name is same but different case
                var folderName = Path.GetFileName(dir);
                if (!directories.Any(d => d.Name.Equals(folderName, StringComparison.OrdinalIgnoreCase)))
                {
                    directories.Add(new CommonDirectoryInfo
                    {
                        Name = folderName,
                        Path = dir,
                        Icon = "code"
                    });
                }
            }
        }
    }

    public Task<bool> DirectoryExistsAsync(string path, CancellationToken ct = default)
    {
        try
        {
            var fullPath = Path.GetFullPath(path);
            return Task.FromResult(Directory.Exists(fullPath));
        }
        catch
        {
            return Task.FromResult(false);
        }
    }

    private DirectoryListingResult ListRoots()
    {
        var directories = new List<DirectoryEntryInfo>();

        // If running in Docker, show the mounted host filesystem
        if (_isRunningInDocker)
        {
            _logger?.LogDebug("Listing roots in Docker mode");

            // Add host Users folder (Windows) if mounted
            if (!string.IsNullOrEmpty(_hostUsersPath) && Directory.Exists(_hostUsersPath))
            {
                // List user folders under /host/Users
                try
                {
                    foreach (var userDir in Directory.GetDirectories(_hostUsersPath))
                    {
                        var userName = Path.GetFileName(userDir);
                        // Skip system folders
                        if (userName == "Public" || userName == "Default" || userName == "Default User" || userName == "All Users")
                            continue;

                        directories.Add(new DirectoryEntryInfo
                        {
                            Name = $"📁 {userName} (Windows User)",
                            Path = userDir,
                            IsHidden = false
                        });
                    }
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex, "Could not enumerate host Users directory");
                }
            }

            // Add host home folder if mounted (fallback)
            if (!string.IsNullOrEmpty(_hostHomePath) && Directory.Exists(_hostHomePath))
            {
                directories.Add(new DirectoryEntryInfo
                {
                    Name = "🏠 Host Home",
                    Path = _hostHomePath,
                    IsHidden = false
                });
            }

            // Add the current project workspace
            if (Directory.Exists("/app"))
            {
                directories.Add(new DirectoryEntryInfo
                {
                    Name = "📦 Maestro Workspace",
                    Path = "/app",
                    IsHidden = false
                });
            }

            // If no host mounts found, show container filesystem with a warning
            if (directories.Count == 0)
            {
                _logger?.LogWarning("No host filesystem mounted. FileBrowser will show container filesystem.");
                directories.Add(new DirectoryEntryInfo
                {
                    Name = "⚠️ Container Root (no host mount)",
                    Path = "/",
                    IsHidden = false
                });
            }
        }
        else if (OperatingSystem.IsWindows())
        {
            // Native Windows: List drives
            foreach (var drive in DriveInfo.GetDrives())
            {
                if (drive.IsReady)
                {
                    directories.Add(new DirectoryEntryInfo
                    {
                        Name = string.IsNullOrEmpty(drive.VolumeLabel)
                            ? drive.Name.TrimEnd('\\')
                            : $"{drive.VolumeLabel} ({drive.Name.TrimEnd('\\')})",
                        Path = drive.RootDirectory.FullName,
                        IsHidden = false
                    });
                }
            }
        }
        else
        {
            // Native Unix-like systems: start from root
            directories.Add(new DirectoryEntryInfo
            {
                Name = "/",
                Path = "/",
                IsHidden = false
            });

            // Also add home directory
            var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            if (!string.IsNullOrEmpty(home) && Directory.Exists(home))
            {
                directories.Add(new DirectoryEntryInfo
                {
                    Name = "Home (~)",
                    Path = home,
                    IsHidden = false
                });
            }
        }

        return new DirectoryListingResult
        {
            CurrentPath = string.Empty,
            ParentPath = null,
            Directories = directories,
            Files = Array.Empty<FileEntryInfo>()
        };
    }
}
