using Maestro.Application.Interfaces;

namespace Maestro.Application.DTOs;

/// <summary>
/// DTO for directory listing result.
/// </summary>
public record DirectoryListingDto
{
    public string CurrentPath { get; init; } = string.Empty;
    public string? ParentPath { get; init; }
    public List<DirectoryEntryDto> Directories { get; init; } = new();
    public List<FileEntryDto> Files { get; init; } = new();
    public bool IsMaestroProject { get; init; }
    public bool IsGitRepository { get; init; }

    public static DirectoryListingDto FromDomain(DirectoryListingResult result)
    {
        return new DirectoryListingDto
        {
            CurrentPath = result.CurrentPath,
            ParentPath = result.ParentPath,
            Directories = result.Directories.Select(DirectoryEntryDto.FromDomain).ToList(),
            Files = result.Files.Select(FileEntryDto.FromDomain).ToList(),
            IsMaestroProject = result.IsMaestroProject,
            IsGitRepository = result.IsGitRepository
        };
    }
}

/// <summary>
/// DTO for directory entry.
/// </summary>
public record DirectoryEntryDto
{
    public string Name { get; init; } = string.Empty;
    public string Path { get; init; } = string.Empty;
    public DateTime? LastModified { get; init; }
    public bool IsMaestroProject { get; init; }
    public bool IsGitRepository { get; init; }
    public bool IsHidden { get; init; }

    public static DirectoryEntryDto FromDomain(DirectoryEntryInfo info)
    {
        return new DirectoryEntryDto
        {
            Name = info.Name,
            Path = info.Path,
            LastModified = info.LastModified,
            IsMaestroProject = info.IsMaestroProject,
            IsGitRepository = info.IsGitRepository,
            IsHidden = info.IsHidden
        };
    }
}

/// <summary>
/// DTO for file entry.
/// </summary>
public record FileEntryDto
{
    public string Name { get; init; } = string.Empty;
    public string Path { get; init; } = string.Empty;
    public long Size { get; init; }
    public DateTime? LastModified { get; init; }
    public string? Extension { get; init; }
    public bool IsHidden { get; init; }

    public static FileEntryDto FromDomain(FileEntryInfo info)
    {
        return new FileEntryDto
        {
            Name = info.Name,
            Path = info.Path,
            Size = info.Size,
            LastModified = info.LastModified,
            Extension = info.Extension,
            IsHidden = info.IsHidden
        };
    }
}

/// <summary>
/// DTO for common directory info.
/// </summary>
public record CommonDirectoryDto
{
    public string Name { get; init; } = string.Empty;
    public string Path { get; init; } = string.Empty;
    public string? Icon { get; init; }

    public static CommonDirectoryDto FromDomain(Interfaces.CommonDirectoryInfo info)
    {
        return new CommonDirectoryDto
        {
            Name = info.Name,
            Path = info.Path,
            Icon = info.Icon
        };
    }
}

/// <summary>
/// Request to browse a directory.
/// </summary>
public record BrowseDirectoryRequest
{
    public string? Path { get; init; }
}
