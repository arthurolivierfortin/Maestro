namespace Maestro.Application.DTOs;

/// <summary>
/// A single cost entry recorded after block execution.
/// </summary>
public class CostEntryDto
{
    public string SessionId { get; set; } = string.Empty;
    public string BlockId { get; set; } = string.Empty;
    public string ModelId { get; set; } = string.Empty;
    public string ProviderId { get; set; } = string.Empty;
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public decimal CostUsd { get; set; }
    public DateTime Timestamp { get; set; }
}

/// <summary>
/// Aggregated period summary (today, thisWeek, thisMonth, allTime).
/// </summary>
public class CostPeriodDto
{
    public decimal TotalCost { get; set; }
    public int TotalTokens { get; set; }
    public int RequestCount { get; set; }
}

/// <summary>
/// Provider or model breakdown entry.
/// </summary>
public class CostBreakdownDto
{
    public decimal TotalCost { get; set; }
    public int TotalTokens { get; set; }
}

/// <summary>
/// Full cost summary returned by GET /api/costs/summary.
/// </summary>
public class CostSummaryDto
{
    public CostPeriodDto Today { get; set; } = new();
    public CostPeriodDto ThisWeek { get; set; } = new();
    public CostPeriodDto ThisMonth { get; set; } = new();
    public CostPeriodDto AllTime { get; set; } = new();
    public Dictionary<string, CostBreakdownDto> ByProvider { get; set; } = new();
    public Dictionary<string, CostBreakdownDto> ByModel { get; set; } = new();
    public CostLimitsDto? Limits { get; set; }
}

/// <summary>
/// Cost limits configuration (read/write via API).
/// </summary>
public class CostLimitsDto
{
    public decimal? MaxPerSession { get; set; }
    public decimal? MaxPerDay { get; set; }
    public decimal? MaxPerWeek { get; set; }
    public decimal? MaxPerMonth { get; set; }
}

/// <summary>
/// Result of checking a cost limit.
/// </summary>
public class CostLimitCheckResult
{
    public bool Exceeded { get; set; }
    public string LimitType { get; set; } = string.Empty;
    public decimal CurrentValue { get; set; }
    public decimal MaxValue { get; set; }

    public static CostLimitCheckResult Ok() => new() { Exceeded = false };
}
