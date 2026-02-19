namespace Maestro.Domain.Configuration;

/// <summary>
/// Configuration for validation in a project session.
/// </summary>
public class ValidationConfig
{
    /// <summary>
    /// Whether to run tests after execution.
    /// </summary>
    public bool RunTests { get; set; } = false;

    /// <summary>
    /// The command to run tests (e.g., "npm test", "dotnet test").
    /// </summary>
    public string? TestCommand { get; set; }

    /// <summary>
    /// Whether to run linter after execution.
    /// </summary>
    public bool RunLinter { get; set; } = false;

    /// <summary>
    /// The command to run the linter (e.g., "npm run lint").
    /// </summary>
    public string? LinterCommand { get; set; }

    /// <summary>
    /// Whether to require a clean diff (no untracked files) before commit.
    /// </summary>
    public bool RequireCleanDiff { get; set; } = false;

    /// <summary>
    /// Maximum number of execution steps allowed.
    /// </summary>
    public int MaxSteps { get; set; } = 50;

    /// <summary>
    /// Timeout in milliseconds for the session execution.
    /// </summary>
    public int TimeoutMs { get; set; } = 600000; // 10 minutes

    /// <summary>
    /// Creates a default validation configuration.
    /// </summary>
    public static ValidationConfig Default => new();

    /// <summary>
    /// Creates a strict validation configuration with tests enabled.
    /// </summary>
    public static ValidationConfig WithTests(string testCommand = "npm test") => new()
    {
        RunTests = true,
        TestCommand = testCommand
    };
}
