namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Value object representing a file or directory access rule.
/// Controls visibility and permissions for files/folders in container context.
/// </summary>
public record FileAccessRule
{
    /// <summary>
    /// The relative path from project root.
    /// </summary>
    public required string Path { get; init; }

    /// <summary>
    /// Whether this rule applies to a file or directory.
    /// </summary>
    public FileAccessType Type { get; init; } = FileAccessType.File;

    /// <summary>
    /// The access rule to apply.
    /// </summary>
    public FileAccessPermission Permission { get; init; } = FileAccessPermission.ReadWrite;

    /// <summary>
    /// Optional reason/description for this rule.
    /// </summary>
    public string? Reason { get; init; }

    /// <summary>
    /// Creates a rule to hide a file/folder (not visible to agents).
    /// </summary>
    public static FileAccessRule Hidden(string path, FileAccessType type = FileAccessType.File, string? reason = null) =>
        new() { Path = path, Type = type, Permission = FileAccessPermission.Hidden, Reason = reason };

    /// <summary>
    /// Creates a rule to make a file/folder read-only.
    /// </summary>
    public static FileAccessRule ReadOnly(string path, FileAccessType type = FileAccessType.File, string? reason = null) =>
        new() { Path = path, Type = type, Permission = FileAccessPermission.ReadOnly, Reason = reason };

    /// <summary>
    /// Creates a rule to exclude a file/folder from container mount.
    /// </summary>
    public static FileAccessRule Excluded(string path, FileAccessType type = FileAccessType.Directory, string? reason = null) =>
        new() { Path = path, Type = type, Permission = FileAccessPermission.Excluded, Reason = reason };
}

/// <summary>
/// Type of file system entry.
/// </summary>
public enum FileAccessType
{
    File,
    Directory
}

/// <summary>
/// Access permission level for file/directory.
/// </summary>
public enum FileAccessPermission
{
    /// <summary>
    /// Full read/write access (default).
    /// </summary>
    ReadWrite,

    /// <summary>
    /// Read-only access.
    /// </summary>
    ReadOnly,

    /// <summary>
    /// Hidden from agents (not visible in file listings).
    /// </summary>
    Hidden,

    /// <summary>
    /// Completely excluded from container mount.
    /// </summary>
    Excluded
}
