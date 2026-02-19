using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Service for calculating and managing model fitness scores.
/// </summary>
public interface IFitnessService
{
    /// <summary>
    /// Calculate fitness score for a workflow execution.
    /// </summary>
    Task<FitnessScore> CalculateFitnessAsync(
        WorkflowExecutionMetrics metrics,
        string modelId,
        string taskType,
        CancellationToken ct = default);

    /// <summary>
    /// Calculate fitness score using explicit model profile.
    /// </summary>
    Task<FitnessScore> CalculateFitnessAsync(
        WorkflowExecutionMetrics metrics,
        ModelProfile profile,
        TaskEntropy entropy,
        FitnessConfig? config = null,
        CancellationToken ct = default);

    /// <summary>
    /// Get aggregate fitness statistics for a model.
    /// </summary>
    Task<AggregateFitnessStats> GetModelFitnessStatsAsync(
        string modelId,
        string? taskType = null,
        CancellationToken ct = default);

    /// <summary>
    /// Get the fitness leaderboard for a specific task type.
    /// </summary>
    Task<IReadOnlyList<ModelFitnessRanking>> GetLeaderboardAsync(
        string? taskType = null,
        int limit = 10,
        CancellationToken ct = default);

    /// <summary>
    /// Get the current fitness configuration.
    /// </summary>
    Task<FitnessConfig> GetConfigAsync(CancellationToken ct = default);

    /// <summary>
    /// Update the fitness configuration.
    /// </summary>
    Task<FitnessConfig> UpdateConfigAsync(FitnessConfig config, CancellationToken ct = default);

    /// <summary>
    /// Record a fitness score for historical tracking.
    /// </summary>
    Task RecordFitnessAsync(FitnessScore score, CancellationToken ct = default);

    /// <summary>
    /// Get historical fitness scores for a model.
    /// </summary>
    Task<IReadOnlyList<FitnessScore>> GetFitnessHistoryAsync(
        string modelId,
        string? taskType = null,
        int limit = 100,
        CancellationToken ct = default);
}

/// <summary>
/// Represents a model's fitness ranking on the leaderboard.
/// </summary>
public record ModelFitnessRanking
{
    /// <summary>
    /// Rank position (1 = best).
    /// </summary>
    public int Rank { get; init; }

    /// <summary>
    /// The model ID.
    /// </summary>
    public string ModelId { get; init; } = string.Empty;

    /// <summary>
    /// Human-readable model name.
    /// </summary>
    public string DisplayName { get; init; } = string.Empty;

    /// <summary>
    /// The model provider.
    /// </summary>
    public string Provider { get; init; } = string.Empty;

    /// <summary>
    /// Average fitness score.
    /// </summary>
    public double AverageFitness { get; init; }

    /// <summary>
    /// Number of executions this ranking is based on.
    /// </summary>
    public int ExecutionCount { get; init; }

    /// <summary>
    /// Best fitness score achieved.
    /// </summary>
    public double BestFitness { get; init; }

    /// <summary>
    /// Task type this ranking is for (null = overall).
    /// </summary>
    public string? TaskType { get; init; }

    /// <summary>
    /// Average breakdown of fitness components.
    /// </summary>
    public FitnessBreakdown? Breakdown { get; init; }

    /// <summary>
    /// When the ranking was last updated.
    /// </summary>
    public DateTimeOffset UpdatedAt { get; init; } = DateTimeOffset.UtcNow;
}
