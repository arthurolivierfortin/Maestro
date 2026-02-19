namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Permissions for an execution context (workspace or session).
/// Controls what commands and tools an agent can use via maestro-cli.
/// </summary>
public record ContextPermissions
{
    /// <summary>Allowed CLI commands (e.g., "run", "list-tools", "data").</summary>
    public List<string> AllowedCommands { get; init; } = new();

    /// <summary>Allowed tool blocks (e.g., "system:fitness-calculator", "*").</summary>
    public List<string> AllowedTools { get; init; } = new();

    /// <summary>Allowed blocks of any type (e.g., "training-loop", "*").</summary>
    public List<string> AllowedBlocks { get; init; } = new();

    /// <summary>Whether agent can create new blocks.</summary>
    public bool CanCreateBlocks { get; init; }

    /// <summary>Whether agent can create new sessions.</summary>
    public bool CanCreateSessions { get; init; }

    /// <summary>Allowed data collections for read/write (e.g., "experiments", "*").</summary>
    public List<string> DataCollections { get; init; } = new();

    /// <summary>Allowed filesystem paths relative to workspace (e.g., "blocks/", "data/").</summary>
    public List<string> AllowedPaths { get; init; } = new();

    /// <summary>
    /// Full access permissions (wildcard all).
    /// </summary>
    public static ContextPermissions Full => new()
    {
        AllowedCommands = new() { "*" },
        AllowedTools = new() { "*" },
        AllowedBlocks = new() { "*" },
        CanCreateBlocks = true,
        CanCreateSessions = true,
        DataCollections = new() { "*" },
        AllowedPaths = new() { "*" }
    };

    /// <summary>
    /// No permissions (empty).
    /// </summary>
    public static ContextPermissions None => new();

    /// <summary>
    /// Read-only permissions (list and describe only).
    /// </summary>
    public static ContextPermissions ReadOnly => new()
    {
        AllowedCommands = new() { "list-tools", "list-blocks", "describe", "data" },
        AllowedTools = new(),
        AllowedBlocks = new(),
        CanCreateBlocks = false,
        CanCreateSessions = false,
        DataCollections = new() { "*" },
        AllowedPaths = new()
    };

    /// <summary>
    /// Standard workspace permissions with reasonable defaults.
    /// </summary>
    public static ContextPermissions Standard => new()
    {
        AllowedCommands = new() { "run", "list-tools", "list-blocks", "describe", "data", "session", "block" },
        AllowedTools = new() { "*" },
        AllowedBlocks = new() { "*" },
        CanCreateBlocks = true,
        CanCreateSessions = true,
        DataCollections = new() { "*" },
        AllowedPaths = new() { "blocks/", "data/" }
    };

    /// <summary>
    /// Check if the specified command is allowed.
    /// </summary>
    public bool HasCommand(string command)
    {
        if (string.IsNullOrEmpty(command)) return false;
        return AllowedCommands.Contains("*") || AllowedCommands.Contains(command);
    }

    /// <summary>
    /// Check if the specified tool is allowed.
    /// </summary>
    public bool HasTool(string toolId)
    {
        if (string.IsNullOrEmpty(toolId)) return false;
        return AllowedTools.Contains("*") ||
               AllowedTools.Contains(toolId) ||
               AllowedTools.Any(pattern => MatchesPattern(toolId, pattern));
    }

    /// <summary>
    /// Check if the specified block is allowed.
    /// </summary>
    public bool HasBlock(string blockId)
    {
        if (string.IsNullOrEmpty(blockId)) return false;
        return AllowedBlocks.Contains("*") ||
               AllowedBlocks.Contains(blockId) ||
               AllowedBlocks.Any(pattern => MatchesPattern(blockId, pattern));
    }

    /// <summary>
    /// Check if the specified data collection is allowed.
    /// </summary>
    public bool HasDataCollection(string collection)
    {
        if (string.IsNullOrEmpty(collection)) return false;
        return DataCollections.Contains("*") || DataCollections.Contains(collection);
    }

    /// <summary>
    /// Check if the specified path is allowed.
    /// </summary>
    public bool HasPath(string path)
    {
        if (string.IsNullOrEmpty(path)) return false;
        if (AllowedPaths.Contains("*")) return true;

        // Normalize path separators
        var normalizedPath = path.Replace("\\", "/");
        return AllowedPaths.Any(allowed =>
        {
            var normalizedAllowed = allowed.Replace("\\", "/");
            return normalizedPath.StartsWith(normalizedAllowed, StringComparison.OrdinalIgnoreCase);
        });
    }

    /// <summary>
    /// Computes intersection of two permission sets (for session inheritance).
    /// Result has only permissions present in BOTH sets.
    /// </summary>
    public ContextPermissions Intersect(ContextPermissions other)
    {
        if (other == null) return this;

        return new ContextPermissions
        {
            AllowedCommands = IntersectLists(AllowedCommands, other.AllowedCommands),
            AllowedTools = IntersectLists(AllowedTools, other.AllowedTools),
            AllowedBlocks = IntersectLists(AllowedBlocks, other.AllowedBlocks),
            CanCreateBlocks = CanCreateBlocks && other.CanCreateBlocks,
            CanCreateSessions = CanCreateSessions && other.CanCreateSessions,
            DataCollections = IntersectLists(DataCollections, other.DataCollections),
            AllowedPaths = IntersectLists(AllowedPaths, other.AllowedPaths)
        };
    }

    /// <summary>
    /// Computes union of two permission sets.
    /// Result has permissions from EITHER set.
    /// </summary>
    public ContextPermissions Union(ContextPermissions other)
    {
        if (other == null) return this;

        return new ContextPermissions
        {
            AllowedCommands = UnionLists(AllowedCommands, other.AllowedCommands),
            AllowedTools = UnionLists(AllowedTools, other.AllowedTools),
            AllowedBlocks = UnionLists(AllowedBlocks, other.AllowedBlocks),
            CanCreateBlocks = CanCreateBlocks || other.CanCreateBlocks,
            CanCreateSessions = CanCreateSessions || other.CanCreateSessions,
            DataCollections = UnionLists(DataCollections, other.DataCollections),
            AllowedPaths = UnionLists(AllowedPaths, other.AllowedPaths)
        };
    }

    private static bool MatchesPattern(string value, string pattern)
    {
        if (string.IsNullOrEmpty(pattern)) return false;

        // Wildcard match (e.g., "system:*" matches "system:fitness-calculator")
        if (pattern.EndsWith("/*") || pattern.EndsWith(":*"))
        {
            var prefix = pattern[..^1]; // Remove the *
            return value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase);
        }

        // Exact match
        return pattern.Equals(value, StringComparison.OrdinalIgnoreCase);
    }

    private static List<string> IntersectLists(List<string> a, List<string> b)
    {
        // If either has wildcard, return the other (non-wildcard) list
        if (a.Contains("*")) return new List<string>(b);
        if (b.Contains("*")) return new List<string>(a);

        // Otherwise, return intersection
        return a.Intersect(b, StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static List<string> UnionLists(List<string> a, List<string> b)
    {
        // If either has wildcard, result is wildcard
        if (a.Contains("*") || b.Contains("*"))
            return new List<string> { "*" };

        // Otherwise, return union
        return a.Union(b, StringComparer.OrdinalIgnoreCase).ToList();
    }
}
