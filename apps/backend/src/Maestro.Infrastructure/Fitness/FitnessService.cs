using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Fitness;

/// <summary>
/// Service for calculating and managing model fitness scores.
/// </summary>
public class FitnessService : IFitnessService
{
    private readonly IModelProfileRepository _profileRepository;
    private readonly ITaskEntropyRepository _entropyRepository;
    private readonly ILogger<FitnessService>? _logger;

    private FitnessConfig _config = FitnessConfig.Default;
    private readonly List<FitnessScore> _fitnessHistory = new();
    private readonly object _lock = new();

    public FitnessService(
        IModelProfileRepository profileRepository,
        ITaskEntropyRepository entropyRepository,
        ILogger<FitnessService>? logger = null)
    {
        _profileRepository = profileRepository;
        _entropyRepository = entropyRepository;
        _logger = logger;
    }

    public async Task<FitnessScore> CalculateFitnessAsync(
        WorkflowExecutionMetrics metrics,
        string modelId,
        string taskType,
        CancellationToken ct = default)
    {
        // Get or create model profile
        var profile = await _profileRepository.GetOrCreateAsync(modelId, "unknown", ct: ct);

        // Get or create task entropy
        var entropy = await _entropyRepository.GetOrCreateAsync(modelId, "model", ct);

        // Update entropy with this task
        entropy = await _entropyRepository.RecordTaskAsync(modelId, "model", taskType, ct);

        return await CalculateFitnessAsync(metrics, profile, entropy, _config, ct);
    }

    public Task<FitnessScore> CalculateFitnessAsync(
        WorkflowExecutionMetrics metrics,
        ModelProfile profile,
        TaskEntropy entropy,
        FitnessConfig? config = null,
        CancellationToken ct = default)
    {
        config ??= _config;

        var fitnessScore = FitnessScore.Calculate(metrics, profile, entropy, config);

        _logger?.LogDebug(
            "Calculated fitness for model {ModelId}: P={Performance:F3}, S={Specialization:F3}, W={Composability:F3}, Total={Total:F3}",
            profile.ModelId,
            fitnessScore.Performance,
            fitnessScore.Specialization,
            fitnessScore.Composability,
            fitnessScore.TotalFitness);

        return Task.FromResult(fitnessScore);
    }

    public Task<AggregateFitnessStats> GetModelFitnessStatsAsync(
        string modelId,
        string? taskType = null,
        CancellationToken ct = default)
    {
        lock (_lock)
        {
            var relevantScores = _fitnessHistory
                .Where(s => s.ModelId == modelId)
                .Where(s => taskType == null || s.TaskType == taskType)
                .ToList();

            var stats = AggregateFitnessStats.Calculate(relevantScores);
            return Task.FromResult(stats);
        }
    }

    public async Task<IReadOnlyList<ModelFitnessRanking>> GetLeaderboardAsync(
        string? taskType = null,
        int limit = 10,
        CancellationToken ct = default)
    {
        var profiles = await _profileRepository.GetAllAsync(ct);
        var rankings = new List<ModelFitnessRanking>();

        lock (_lock)
        {
            var modelGroups = _fitnessHistory
                .Where(s => taskType == null || s.TaskType == taskType)
                .GroupBy(s => s.ModelId)
                .ToList();

            foreach (var group in modelGroups)
            {
                var modelId = group.Key;
                var scores = group.ToList();
                var profile = profiles.FirstOrDefault(p => p.ModelId == modelId);

                if (scores.Count == 0) continue;

                var stats = AggregateFitnessStats.Calculate(scores);

                rankings.Add(new ModelFitnessRanking
                {
                    ModelId = modelId,
                    DisplayName = profile?.DisplayName ?? modelId,
                    Provider = profile?.Provider ?? "unknown",
                    AverageFitness = stats.AverageFitness,
                    ExecutionCount = stats.SampleCount,
                    BestFitness = stats.MaxFitness,
                    TaskType = taskType,
                    Breakdown = stats.AverageBreakdown
                });
            }
        }

        // Sort by average fitness descending and assign ranks
        var sortedRankings = rankings
            .OrderByDescending(r => r.AverageFitness)
            .Take(limit)
            .Select((r, index) => r with { Rank = index + 1 })
            .ToList();

        return sortedRankings;
    }

    public Task<FitnessConfig> GetConfigAsync(CancellationToken ct = default)
    {
        return Task.FromResult(_config);
    }

    public Task<FitnessConfig> UpdateConfigAsync(FitnessConfig config, CancellationToken ct = default)
    {
        // Normalize weights if necessary
        if (!config.AreWeightsValid())
        {
            config = config.NormalizeWeights();
        }

        _config = config with { UpdatedAt = DateTimeOffset.UtcNow };

        _logger?.LogInformation(
            "Updated fitness config: Lambda={Lambda}, Weights=[P={PW}, S={SW}, W={CW}]",
            _config.Lambda,
            _config.PerformanceWeight,
            _config.SpecializationWeight,
            _config.ComposabilityWeight);

        return Task.FromResult(_config);
    }

    public Task RecordFitnessAsync(FitnessScore score, CancellationToken ct = default)
    {
        lock (_lock)
        {
            _fitnessHistory.Add(score);

            // Keep history bounded (last 10000 entries)
            if (_fitnessHistory.Count > 10000)
            {
                _fitnessHistory.RemoveRange(0, _fitnessHistory.Count - 10000);
            }
        }

        _logger?.LogDebug(
            "Recorded fitness score for model {ModelId}, task {TaskType}: {Fitness:F3}",
            score.ModelId,
            score.TaskType,
            score.TotalFitness);

        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<FitnessScore>> GetFitnessHistoryAsync(
        string modelId,
        string? taskType = null,
        int limit = 100,
        CancellationToken ct = default)
    {
        lock (_lock)
        {
            var history = _fitnessHistory
                .Where(s => s.ModelId == modelId)
                .Where(s => taskType == null || s.TaskType == taskType)
                .OrderByDescending(s => s.CalculatedAt)
                .Take(limit)
                .ToList();

            return Task.FromResult<IReadOnlyList<FitnessScore>>(history);
        }
    }
}
