using System.Runtime.InteropServices;

namespace Maestro.Infrastructure.Containers;

/// <summary>
/// Validates file paths to prevent directory traversal attacks.
/// Used by ProcessContainerRuntime to ensure commands stay within allowed roots.
/// </summary>
public static class PathValidator
{
    /// <summary>
    /// Checks whether a candidate path resides under the specified allowed root directory.
    /// Uses case-insensitive comparison on Windows and case-sensitive on Linux/macOS.
    /// </summary>
    /// <param name="candidatePath">The path to validate.</param>
    /// <param name="allowedRoot">The root directory the path must be under.</param>
    /// <returns>True if the candidate path is under the allowed root.</returns>
    public static bool IsPathUnderRoot(string candidatePath, string allowedRoot)
    {
        var resolvedCandidate = Path.GetFullPath(candidatePath)
            .Replace('\\', '/')
            .TrimEnd('/');

        var resolvedRoot = Path.GetFullPath(allowedRoot)
            .Replace('\\', '/')
            .TrimEnd('/');

        var comparison = RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
            ? StringComparison.OrdinalIgnoreCase
            : StringComparison.Ordinal;

        // The candidate must either equal the root or be a subdirectory of it
        return resolvedCandidate.Equals(resolvedRoot, comparison)
            || resolvedCandidate.StartsWith(resolvedRoot + "/", comparison);
    }

    /// <summary>
    /// Validates that the requested path is under the allowed root and returns the resolved absolute path.
    /// </summary>
    /// <param name="requestedPath">The path to validate.</param>
    /// <param name="allowedRoot">The root directory the path must be under.</param>
    /// <returns>The resolved absolute path.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the path escapes the allowed root.</exception>
    public static string ValidateAndResolve(string requestedPath, string allowedRoot)
    {
        var resolvedPath = Path.GetFullPath(requestedPath);

        if (!IsPathUnderRoot(resolvedPath, allowedRoot))
        {
            throw new InvalidOperationException(
                $"Path '{requestedPath}' resolves to '{resolvedPath}' which is outside the allowed root '{Path.GetFullPath(allowedRoot)}'.");
        }

        return resolvedPath;
    }
}
