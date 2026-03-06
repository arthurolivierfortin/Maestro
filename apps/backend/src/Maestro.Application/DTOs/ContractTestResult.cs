using Maestro.Domain.ValueObjects;

namespace Maestro.Application.DTOs;

/// <summary>
/// Result of running a contract's tests against a block.
/// </summary>
public class ContractTestResult
{
    public string ContractId { get; set; } = string.Empty;
    public string ContractVersion { get; set; } = string.Empty;
    public string BlockId { get; set; } = string.Empty;

    /// <summary>
    /// Full fitness score computed by FitnessScore.Calculate().
    /// Incorporates performance, specialization, composability, and cost factors.
    /// Cannot reach 1.0 because cost always reduces the score.
    /// </summary>
    public double Fitness { get; set; }

    /// <summary>
    /// Raw performance score = weighted average of feature scores (0.0-1.0).
    /// This is the P (Performance) component before FitnessScore adjustments.
    /// </summary>
    public double PerformanceScore { get; set; }

    /// <summary>
    /// Full fitness breakdown from FitnessScore.Calculate().
    /// </summary>
    public FitnessBreakdown? FitnessBreakdown { get; set; }

    /// <summary>
    /// Whether the block passes the contract (all thresholds met).
    /// </summary>
    public bool Passed { get; set; }

    /// <summary>
    /// Whether the block has all requiredCapabilities.
    /// </summary>
    public bool MeetsRequiredCapabilities { get; set; }

    /// <summary>
    /// Per-feature score breakdown.
    /// </summary>
    public List<FeatureTestResult> Features { get; set; } = new();

    /// <summary>
    /// Individual test results.
    /// </summary>
    public List<SingleTestResult> TestResults { get; set; } = new();

    public int TotalTests { get; set; }
    public int PassedTests { get; set; }
    public int FailedTests { get; set; }
    public int SkippedTests { get; set; }

    public long DurationMs { get; set; }
    public decimal EstimatedCostUsd { get; set; }
    public DateTimeOffset ExecutedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Reasons why the block failed (empty if passed).
    /// </summary>
    public List<string> FailureReasons { get; set; } = new();
}

public class FeatureTestResult
{
    public string FeatureId { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Whether the block has all required capabilities for this feature.
    /// </summary>
    public bool Active { get; set; }

    /// <summary>
    /// Score = tests_passed / tests_total (0.0 - 1.0).
    /// </summary>
    public double Score { get; set; }

    public double Weight { get; set; }
    public double MinimumScore { get; set; }

    /// <summary>
    /// Whether this feature meets its minimumScore threshold.
    /// </summary>
    public bool MeetsThreshold { get; set; }

    public int TestsPassed { get; set; }
    public int TestsTotal { get; set; }
}

public class SingleTestResult
{
    public string TestId { get; set; } = string.Empty;
    public string FeatureId { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool Passed { get; set; }
    public bool Skipped { get; set; }

    /// <summary>
    /// The check type used (contains, tool-call, etc.).
    /// </summary>
    public string? CheckType { get; set; }

    /// <summary>
    /// The block's response (truncated if long).
    /// </summary>
    public string? Response { get; set; }

    /// <summary>
    /// Why the check failed (null if passed).
    /// </summary>
    public string? FailureReason { get; set; }

    public long DurationMs { get; set; }
}
