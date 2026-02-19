using LLMProvider.Application.DTOs.Statistics;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.Interfaces;

/// <summary>
/// Provides read-only access to statistics and performance metrics.
/// </summary>
public interface IStatisticsService
{
    StatisticsSnapshot GetSnapshot();
    ModelStatistics? GetModelStatistics(ModelId modelId);
    QueueStatistics GetQueueStatistics();
    SwitchingStatistics GetSwitchingStatistics();
    PerformanceProfile? GetPerformanceProfile(ModelId modelId);
    IReadOnlyList<PerformanceProfile> GetAllPerformanceProfiles();
}
