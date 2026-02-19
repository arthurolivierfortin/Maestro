namespace LLMProvider.Application.DTOs.Statistics;

/// <summary>
/// Aggregated statistics about model switching.
/// </summary>
public sealed record SwitchingStatistics(
    int TotalSwitches,
    int SwitchesAvoided,
    TimeSpan AvgSwitchDuration,
    IReadOnlyList<SwitchEvent> RecentDecisions);
