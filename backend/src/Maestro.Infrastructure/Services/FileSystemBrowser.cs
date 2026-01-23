using Maestro.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Services;

/// <summary>
/// File system browser implementation.
/// Provides directory listing and navigation for project folder selection.
/// </summary>
public class FileSystemBrowser : IFileSystemBrowser
{
    private readonly ILogger<FileSystemBrowser>? _logger;

    public FileSystemBrowser(ILogger<FileSystemBrowser>? logger = null)
    {
        _logger = logger;
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

        // User home directory
        var userHome = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        if (!string.IsNullOrEmpty(userHome) && Directory.Exists(userHome))
        {
            directories.Add(new CommonDirectoryInfo
            {
                Name = "Home",
                Path = userHome,
                Icon = "home"
            });
        }

        // Desktop
        var desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
        if (!string.IsNullOrEmpty(desktop) && Directory.Exists(desktop))
        {
            directories.Add(new CommonDirectoryInfo
            {
                Name = "Desktop",
                Path = desktop,
                Icon = "desktop"
            });
        }

        // Documents
        var documents = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        if (!string.IsNullOrEmpty(documents) && Directory.Exists(documents))
        {
            directories.Add(new CommonDirectoryInfo
            {
                Name = "Documents",
                Path = documents,
                Icon = "folder"
            });
        }

        // Common development directories
        var devDirs = new[]
        {
            Path.Combine(userHome, "Projects"),
            Path.Combine(userHome, "projects"),
            Path.Combine(userHome, "Development"),
            Path.Combine(userHome, "dev"),
            Path.Combine(userHome, "Code"),
            Path.Combine(userHome, "code"),
            Path.Combine(userHome, "workspace"),
            Path.Combine(userHome, "repos"),
            Path.Combine(userHome, "git")
        };

        foreach (var dir in devDirs)
        {
            if (Directory.Exists(dir))
            {
                directories.Add(new CommonDirectoryInfo
                {
                    Name = Path.GetFileName(dir),
                    Path = dir,
                    Icon = "code"
                });
                break; // Only add the first found development directory
            }
        }

        return Task.FromResult(directories.AsEnumerable());
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

        if (OperatingSystem.IsWindows())
        {
            // List drives on Windows
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
            // On Unix-like systems, start from root
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
