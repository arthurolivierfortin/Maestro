namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Value object representing a block permission rule.
/// Controls which blocks/tools are available in a project.
/// </summary>
public record BlockPermission
{
    /// <summary>
    /// The block ID or pattern (supports wildcards like "tools/*").
    /// </summary>
    public required string BlockPattern { get; init; }

    /// <summary>
    /// The permission level for matching blocks.
    /// </summary>
    public BlockPermissionLevel Permission { get; init; } = BlockPermissionLevel.Allowed;

    /// <summary>
    /// Optional reason/description for this permission.
    /// </summary>
    public string? Reason { get; init; }

    /// <summary>
    /// Creates a permission allowing a block/pattern.
    /// </summary>
    public static BlockPermission Allow(string pattern, string? reason = null) =>
        new() { BlockPattern = pattern, Permission = BlockPermissionLevel.Allowed, Reason = reason };

    /// <summary>
    /// Creates a permission denying a block/pattern.
    /// </summary>
    public static BlockPermission Deny(string pattern, string? reason = null) =>
        new() { BlockPattern = pattern, Permission = BlockPermissionLevel.Denied, Reason = reason };

    /// <summary>
    /// Creates a permission requiring approval for a block/pattern.
    /// </summary>
    public static BlockPermission RequiresApproval(string pattern, string? reason = null) =>
        new() { BlockPattern = pattern, Permission = BlockPermissionLevel.RequiresApproval, Reason = reason };

    /// <summary>
    /// Checks if this rule matches a given block ID.
    /// </summary>
    public bool Matches(string blockId)
    {
        if (string.IsNullOrEmpty(blockId)) return false;

        // Exact match
        if (BlockPattern.Equals(blockId, StringComparison.OrdinalIgnoreCase))
            return true;

        // Wildcard match (e.g., "tools/*" matches "tools/git-diff")
        if (BlockPattern.EndsWith("/*"))
        {
            var prefix = BlockPattern[..^2];
            return blockId.StartsWith(prefix, StringComparison.OrdinalIgnoreCase);
        }

        // Wildcard match (e.g., "*" matches everything)
        if (BlockPattern == "*")
            return true;

        return false;
    }
}

/// <summary>
/// Permission level for blocks.
/// </summary>
public enum BlockPermissionLevel
{
    /// <summary>
    /// Block is allowed to execute.
    /// </summary>
    Allowed,

    /// <summary>
    /// Block is denied and cannot execute.
    /// </summary>
    Denied,

    /// <summary>
    /// Block execution requires user approval.
    /// </summary>
    RequiresApproval
}
