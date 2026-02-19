namespace LLMProvider.Application.DTOs.Statistics;

/// <summary>
/// Current state of the request queue.
/// </summary>
public sealed record QueueStatistics(
    int CurrentDepth,
    Dictionary<string, int> DepthByModel,
    string? CurrentModel,
    double AvgWaitTimeMs,
    int TotalEnqueued,
    int TotalProcessed);
