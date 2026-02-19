namespace LLMProvider.Application.Options;

/// <summary>
/// Configuration options for the statistics system.
/// </summary>
public sealed class StatisticsOptions
{
    public const string SectionName = "Statistics";

    public bool PersistenceEnabled { get; set; } = true;
    public int PersistenceIntervalSeconds { get; set; } = 60;
    public string DataDirectory { get; set; } = "data/statistics";
    public int MaxRecentRequests { get; set; } = 10000;
}
