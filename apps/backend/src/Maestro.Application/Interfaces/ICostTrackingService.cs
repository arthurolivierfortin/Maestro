using Maestro.Application.DTOs;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Tracks LLM costs: records entries, aggregates summaries, enforces limits.
/// Storage: .maestro/cost-history.jsonl (entries) + .maestro/cost-config.json (limits + overrides).
/// </summary>
public interface ICostTrackingService
{
    /// <summary>
    /// Append a cost entry to the JSONL history file.
    /// </summary>
    Task RecordCostAsync(CostEntryDto entry);

    /// <summary>
    /// Get aggregated cost summary (today, week, month, allTime, by provider/model).
    /// </summary>
    Task<CostSummaryDto> GetSummaryAsync();

    /// <summary>
    /// Get all cost entries for a specific session.
    /// </summary>
    Task<List<CostEntryDto>> GetSessionCostsAsync(string sessionId);

    /// <summary>
    /// Read current cost limits from config.
    /// </summary>
    Task<CostLimitsDto> GetLimitsAsync();

    /// <summary>
    /// Write cost limits to config.
    /// </summary>
    Task SetLimitsAsync(CostLimitsDto limits);

    /// <summary>
    /// Check whether any limit is exceeded for the given session.
    /// Does NOT throw — returns a result indicating which limit was exceeded.
    /// </summary>
    Task<CostLimitCheckResult> CheckLimitAsync(string sessionId, decimal currentSessionCost);
}
