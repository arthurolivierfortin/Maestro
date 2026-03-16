using System.Text.Json;
using Maestro.Domain.ValueObjects;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Utility class for checking file access rules before file operations.
/// Phase 59-C: Enforces FileAccessRule permissions from session configuration.
///
/// Rules are checked by matching the file path against session FileAccessRules.
/// First matching rule wins. No match = ReadWrite (default, no restriction).
///
/// Permission matrix:
///   ReadWrite: read yes, write yes, list yes
///   ReadOnly:  read yes, write NO,  list yes
///   Hidden:    read NO,  write NO,  list NO
///   Excluded:  read NO,  write NO,  list NO
/// </summary>
public static class FileAccessChecker
{
    /// <summary>
    /// Key used to pass serialized FileAccessRules through ExecutionContext.Variables.
    /// </summary>
    public const string FileAccessRulesKey = "_fileAccessRules";

    /// <summary>
    /// Gets the effective file access permission for a given path.
    /// Returns ReadWrite if no rules match or no rules are configured.
    /// </summary>
    public static FileAccessPermission GetPermission(ExecutionContext context, string filePath, string workingDir)
    {
        var rules = GetRulesFromContext(context);
        if (rules == null || rules.Count == 0)
            return FileAccessPermission.ReadWrite;

        // Normalize the file path to be relative to workingDir for matching
        var relativePath = GetRelativePath(filePath, workingDir);

        foreach (var rule in rules)
        {
            if (MatchesRule(relativePath, filePath, rule))
                return rule.Permission;
        }

        return FileAccessPermission.ReadWrite; // Default: full access
    }

    /// <summary>
    /// Checks if a read operation is allowed for the given path.
    /// Returns null if allowed, or an error message if denied.
    /// </summary>
    public static string? CheckReadAccess(ExecutionContext context, string filePath, string workingDir)
    {
        var permission = GetPermission(context, filePath, workingDir);
        return permission switch
        {
            FileAccessPermission.ReadWrite => null,
            FileAccessPermission.ReadOnly => null, // Read is OK for ReadOnly
            FileAccessPermission.Hidden => $"File access denied: path is hidden by session file access rules",
            FileAccessPermission.Excluded => $"File access denied: path is excluded by session file access rules",
            _ => null
        };
    }

    /// <summary>
    /// Checks if a write/edit operation is allowed for the given path.
    /// Returns null if allowed, or an error message if denied.
    /// </summary>
    public static string? CheckWriteAccess(ExecutionContext context, string filePath, string workingDir)
    {
        var permission = GetPermission(context, filePath, workingDir);
        return permission switch
        {
            FileAccessPermission.ReadWrite => null,
            FileAccessPermission.ReadOnly => $"File access denied: path is read-only by session file access rules",
            FileAccessPermission.Hidden => $"File access denied: path is hidden by session file access rules",
            FileAccessPermission.Excluded => $"File access denied: path is excluded by session file access rules",
            _ => null
        };
    }

    /// <summary>
    /// Checks if a path should be visible in directory listings.
    /// Hidden and Excluded paths should not appear.
    /// </summary>
    public static bool IsVisibleInListing(ExecutionContext context, string filePath, string workingDir)
    {
        var permission = GetPermission(context, filePath, workingDir);
        return permission == FileAccessPermission.ReadWrite || permission == FileAccessPermission.ReadOnly;
    }

    /// <summary>
    /// Serializes FileAccessRules to a JSON string for passing through ExecutionContext.
    /// </summary>
    public static string SerializeRules(IReadOnlyList<FileAccessRule> rules)
    {
        var dtos = rules.Select(r => new FileAccessRuleDto
        {
            Path = r.Path,
            Type = r.Type.ToString(),
            Permission = r.Permission.ToString(),
            Reason = r.Reason
        }).ToArray();

        return JsonSerializer.Serialize(dtos);
    }

    /// <summary>
    /// Extracts FileAccessRules from the execution context.
    /// Returns null if no rules are set.
    /// </summary>
    private static IReadOnlyList<FileAccessRule>? GetRulesFromContext(ExecutionContext context)
    {
        if (!context.Variables.TryGetValue(FileAccessRulesKey, out var rulesObj) || rulesObj == null)
            return null;

        var rulesStr = rulesObj.ToString();
        if (string.IsNullOrEmpty(rulesStr))
            return null;

        try
        {
            var dtos = JsonSerializer.Deserialize<FileAccessRuleDto[]>(rulesStr);
            if (dtos == null || dtos.Length == 0)
                return null;

            return dtos.Select(d => new FileAccessRule
            {
                Path = d.Path,
                Type = Enum.TryParse<FileAccessType>(d.Type, ignoreCase: true, out var t) ? t : FileAccessType.File,
                Permission = Enum.TryParse<FileAccessPermission>(d.Permission, ignoreCase: true, out var p) ? p : FileAccessPermission.ReadWrite,
                Reason = d.Reason
            }).ToList();
        }
        catch
        {
            return null; // Malformed rules — fail open (no restriction)
        }
    }

    /// <summary>
    /// Matches a file path against a rule. Handles both File and Directory rule types.
    /// </summary>
    private static bool MatchesRule(string relativePath, string absolutePath, FileAccessRule rule)
    {
        var rulePath = NormalizePath(rule.Path);
        var normalizedRelative = NormalizePath(relativePath);
        var normalizedAbsolute = NormalizePath(absolutePath);

        if (rule.Type == FileAccessType.Directory)
        {
            // Directory rule: matches anything under this directory
            var dirPrefix = rulePath.EndsWith("/") ? rulePath : rulePath + "/";
            return normalizedRelative.StartsWith(dirPrefix, StringComparison.OrdinalIgnoreCase)
                || normalizedRelative.Equals(rulePath, StringComparison.OrdinalIgnoreCase)
                || normalizedAbsolute.StartsWith(dirPrefix, StringComparison.OrdinalIgnoreCase);
        }
        else
        {
            // File rule: exact match
            return normalizedRelative.Equals(rulePath, StringComparison.OrdinalIgnoreCase)
                || Path.GetFileName(normalizedAbsolute).Equals(rulePath, StringComparison.OrdinalIgnoreCase);
        }
    }

    private static string GetRelativePath(string filePath, string workingDir)
    {
        try
        {
            if (Path.IsPathRooted(filePath) && !string.IsNullOrEmpty(workingDir))
            {
                var fullWorking = Path.GetFullPath(workingDir);
                var fullFile = Path.GetFullPath(filePath);
                if (fullFile.StartsWith(fullWorking, StringComparison.OrdinalIgnoreCase))
                {
                    var relative = fullFile.Substring(fullWorking.Length).TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                    return relative;
                }
            }
            return filePath;
        }
        catch
        {
            return filePath;
        }
    }

    private static string NormalizePath(string path)
    {
        return path.Replace("\\", "/").TrimStart('/');
    }

    private class FileAccessRuleDto
    {
        public string Path { get; set; } = "";
        public string Type { get; set; } = "File";
        public string Permission { get; set; } = "ReadWrite";
        public string? Reason { get; set; }
    }
}
