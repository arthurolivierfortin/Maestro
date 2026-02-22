namespace Maestro.Domain.ValueObjects;

/// <summary>
/// A named checkpoint within a sandbox image.
/// Represents a specific git ref (branch, tag, commit) with optional state metadata.
/// </summary>
public record SandboxCheckpoint
{
    /// <summary>Unique identifier within the image (e.g., "clean-main", "mid-feature").</summary>
    public string Id { get; init; } = string.Empty;

    /// <summary>Human-readable description of this checkpoint state.</summary>
    public string? Description { get; init; }

    /// <summary>Git ref: branch name, tag, commit SHA, or relative ref (e.g., "main~5").</summary>
    public string GitRef { get; init; } = string.Empty;

    /// <summary>Expected working tree state: clean, dirty, or conflict.</summary>
    public string GitState { get; init; } = "clean";

    /// <summary>Files affected in this checkpoint (for dirty/conflict states).</summary>
    public List<string>? AffectedFiles { get; init; }

    /// <summary>Branch to merge for conflict state scenarios.</summary>
    public string? ConflictBranch { get; init; }
}
