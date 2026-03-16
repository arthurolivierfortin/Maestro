namespace Maestro.Domain.Entities;

/// <summary>
/// Cost limits for controlling LLM spending.
/// Persisted in .maestro/cost-config.json.
/// </summary>
public class CostLimits
{
    /// <summary>USD max per session.</summary>
    public decimal? MaxPerSession { get; set; }

    /// <summary>USD max per day (all sessions).</summary>
    public decimal? MaxPerDay { get; set; }

    /// <summary>USD max per week.</summary>
    public decimal? MaxPerWeek { get; set; }

    /// <summary>USD max per month.</summary>
    public decimal? MaxPerMonth { get; set; }
}
