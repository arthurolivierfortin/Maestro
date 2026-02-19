using Maestro.Domain.Enums;

namespace Maestro.Domain.Configuration;

/// <summary>
/// Configuration for access control in a project session.
/// </summary>
public class AccessConfig
{
    /// <summary>
    /// The access level for this session.
    /// </summary>
    public AccessLevel Level { get; set; } = AccessLevel.Controlled;

    /// <summary>
    /// Glob patterns for paths that are allowed to be accessed.
    /// If empty, all paths are allowed (subject to denied paths).
    /// </summary>
    public IList<string> AllowedPaths { get; set; } = new List<string>();

    /// <summary>
    /// Glob patterns for paths that are denied access.
    /// Takes precedence over allowed paths.
    /// </summary>
    public IList<string> DeniedPaths { get; set; } = new List<string>();

    /// <summary>
    /// Glob patterns for paths that require explicit approval before modification.
    /// </summary>
    public IList<string> RequireApprovalPaths { get; set; } = new List<string>();

    /// <summary>
    /// Shell commands that are allowed (if empty, all commands are allowed).
    /// Supports wildcards: "git *", "npm *", etc.
    /// </summary>
    public IList<string> AllowedCommands { get; set; } = new List<string>();

    /// <summary>
    /// Shell commands that are denied.
    /// Takes precedence over allowed commands.
    /// </summary>
    public IList<string> DeniedCommands { get; set; } = new List<string>();

    /// <summary>
    /// Whether to allow network access (for sandbox mode).
    /// </summary>
    public bool AllowNetworkAccess { get; set; } = true;

    /// <summary>
    /// Maximum execution time for shell commands in milliseconds.
    /// </summary>
    public int CommandTimeoutMs { get; set; } = 60000;

    /// <summary>
    /// Creates a default access configuration with controlled access.
    /// </summary>
    public static AccessConfig Default => new()
    {
        Level = AccessLevel.Controlled,
        DeniedPaths = new List<string> { ".env", "*.env", "secrets/**", "**/.git/**" },
        DeniedCommands = new List<string> { "rm -rf /", "rm -rf /*", "shutdown", "reboot" }
    };

    /// <summary>
    /// Creates a read-only access configuration.
    /// </summary>
    public static AccessConfig ReadOnly => new()
    {
        Level = AccessLevel.ReadOnly
    };

    /// <summary>
    /// Creates a full access configuration (use with caution).
    /// </summary>
    public static AccessConfig Full => new()
    {
        Level = AccessLevel.Full
    };
}
