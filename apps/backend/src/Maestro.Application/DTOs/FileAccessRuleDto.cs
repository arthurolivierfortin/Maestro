using Maestro.Domain.ValueObjects;

namespace Maestro.Application.DTOs;

/// <summary>
/// Data Transfer Object for file access rules.
/// </summary>
public record FileAccessRuleDto
{
    public string Path { get; init; } = string.Empty;
    public string Type { get; init; } = "file";
    public string Permission { get; init; } = "readwrite";
    public string? Reason { get; init; }

    public static FileAccessRuleDto FromDomain(FileAccessRule rule)
    {
        return new FileAccessRuleDto
        {
            Path = rule.Path,
            Type = rule.Type.ToString().ToLowerInvariant(),
            Permission = rule.Permission.ToString().ToLowerInvariant(),
            Reason = rule.Reason
        };
    }

    public FileAccessRule ToDomain()
    {
        return new FileAccessRule
        {
            Path = Path,
            Type = Enum.TryParse<FileAccessType>(Type, true, out var t) ? t : FileAccessType.File,
            Permission = Enum.TryParse<FileAccessPermission>(Permission, true, out var p) ? p : FileAccessPermission.ReadWrite,
            Reason = Reason
        };
    }
}

/// <summary>
/// Request to update file access rules.
/// </summary>
public record UpdateFileAccessRulesRequest
{
    public List<FileAccessRuleDto> Rules { get; init; } = new();
}
