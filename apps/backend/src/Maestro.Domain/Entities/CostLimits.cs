namespace Maestro.Domain.Entities;

/// <summary>
/// Configuration for a single cost limit: value, enforcement behavior, and auto-resume.
/// </summary>
public class CostLimitConfig
{
    /// <summary>USD limit value. Null means no limit configured.</summary>
    public decimal? Value { get; set; }

    /// <summary>"block" (default) stops execution, "warn" logs a warning but continues.</summary>
    public string Enforcement { get; set; } = "block";

    /// <summary>If true, sessions stopped by this limit auto-resume when the time period resets.</summary>
    public bool AutoResume { get; set; } = false;

    /// <summary>Returns true if this limit is actually configured (has a value).</summary>
    public bool IsConfigured => Value.HasValue;
}

/// <summary>
/// Cost limits for controlling LLM spending.
/// Persisted in .maestro/cost-config.json.
/// Each limit is a CostLimitConfig with value, enforcement mode, and auto-resume flag.
/// </summary>
public class CostLimits
{
    /// <summary>USD max per session.</summary>
    public CostLimitConfig MaxPerSession { get; set; } = new();

    /// <summary>USD max per day (all sessions).</summary>
    public CostLimitConfig MaxPerDay { get; set; } = new();

    /// <summary>USD max per week.</summary>
    public CostLimitConfig MaxPerWeek { get; set; } = new();

    /// <summary>USD max per month.</summary>
    public CostLimitConfig MaxPerMonth { get; set; } = new();
}
