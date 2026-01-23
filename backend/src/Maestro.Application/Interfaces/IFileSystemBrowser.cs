namespace Maestro.Application.Interfaces;

/// <summary>
/// Service for browsing the file system.
/// Used for project folder selection.
/// </summary>
public interface IFileSystemBrowser
{
    /// <summary>
    /// Lists the contents of a directory.
    /// </summary>
    /// <param name="path">The directory path to list (null for roots/drives).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Directory listing result.</returns>
    Task<DirectoryListingResult> ListDirectoryAsync(string? path = null, CancellationToken ct = default);

    /// <summary>
    /// Gets common/favorite directories (home, documents, etc.).
    /// </summary>
    Task<IEnumerable<CommonDirectoryInfo>> GetCommonDirectoriesAsync(CancellationToken ct = default);

    /// <summary>
    /// Checks if a path exists and is a directory.
    /// </summary>
    Task<bool> DirectoryExistsAsync(string path, CancellationToken ct = default);
}

/// <summary>
/// Result of a directory listing operation.
/// </summary>
public record DirectoryListingResult
{
    /// <summary>
    /// The current path being listed.
    /// </summary>
    public required string CurrentPath { get; init; }

    /// <summary>
    /// The parent directory path (null if at root).
    /// </summary>
    public string? ParentPath { get; init; }

    /// <summary>
    /// List of directories in the current path.
    /// </summary>
    public IReadOnlyList<DirectoryEntryInfo> Directories { get; init; } = Array.Empty<DirectoryEntryInfo>();

    /// <summary>
    /// List of files in the current path.
    /// </summary>
    public IReadOnlyList<FileEntryInfo> Files { get; init; } = Array.Empty<FileEntryInfo>();

    /// <summary>
    /// Whether this directory contains a .maestro folder (is a project).
    /// </summary>
    public bool IsMaestroProject { get; init; }

    /// <summary>
    /// Whether this directory is a git repository.
    /// </summary>
    public bool IsGitRepository { get; init; }
}

/// <summary>
/// Information about a directory entry.
/// </summary>
public record DirectoryEntryInfo
{
    /// <summary>
    /// Directory name.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// Full path to the directory.
    /// </summary>
    public required string Path { get; init; }

    /// <summary>
    /// Last modified date.
    /// </summary>
    public DateTime? LastModified { get; init; }

    /// <summary>
    /// Whether this is a Maestro project directory.
    /// </summary>
    public bool IsMaestroProject { get; init; }

    /// <summary>
    /// Whether this is a git repository.
    /// </summary>
    public bool IsGitRepository { get; init; }

    /// <summary>
    /// Whether this directory is hidden.
    /// </summary>
    public bool IsHidden { get; init; }
}

/// <summary>
/// Information about a file entry.
/// </summary>
public record FileEntryInfo
{
    /// <summary>
    /// File name.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// Full path to the file.
    /// </summary>
    public required string Path { get; init; }

    /// <summary>
    /// File size in bytes.
    /// </summary>
    public long Size { get; init; }

    /// <summary>
    /// Last modified date.
    /// </summary>
    public DateTime? LastModified { get; init; }

    /// <summary>
    /// File extension.
    /// </summary>
    public string? Extension { get; init; }

    /// <summary>
    /// Whether this file is hidden.
    /// </summary>
    public bool IsHidden { get; init; }
}

/// <summary>
/// Information about a common/favorite directory.
/// </summary>
public record CommonDirectoryInfo
{
    /// <summary>
    /// Display name.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// Full path.
    /// </summary>
    public required string Path { get; init; }

    /// <summary>
    /// Icon identifier.
    /// </summary>
    public string? Icon { get; init; }
}
