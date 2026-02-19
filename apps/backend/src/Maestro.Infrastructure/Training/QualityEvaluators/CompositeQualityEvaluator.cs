using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Training.QualityEvaluators;

/// <summary>
/// Quality evaluator that delegates to the appropriate evaluator based on configuration.
/// </summary>
public class CompositeQualityEvaluator : IQualityEvaluator
{
    private readonly HeuristicQualityEvaluator _heuristicEvaluator;
    private readonly LLMQualityEvaluator? _llmEvaluator;
    private readonly ILogger<CompositeQualityEvaluator>? _logger;

    public CompositeQualityEvaluator(
        HeuristicQualityEvaluator heuristicEvaluator,
        LLMQualityEvaluator? llmEvaluator = null,
        ILogger<CompositeQualityEvaluator>? logger = null)
    {
        _heuristicEvaluator = heuristicEvaluator;
        _llmEvaluator = llmEvaluator;
        _logger = logger;
    }

    public async Task<QualityScore> EvaluateAsync(
        object output,
        QualityEvaluationConfig config,
        CancellationToken ct = default)
    {
        if (!config.Enabled)
        {
            return new QualityScore
            {
                Score = 0,
                Method = QualityEvaluationMethod.None,
                Explanation = "Quality evaluation is disabled"
            };
        }

        return config.Method.ToLower() switch
        {
            "heuristic" => await _heuristicEvaluator.EvaluateAsync(output, config, ct),
            "llm" when _llmEvaluator != null => await _llmEvaluator.EvaluateAsync(output, config, ct),
            "llm" when _llmEvaluator == null => await FallbackToHeuristic(output, config, ct),
            "combined" => await EvaluateCombinedAsync(output, config, ct),
            _ => await _heuristicEvaluator.EvaluateAsync(output, config, ct)
        };
    }

    private async Task<QualityScore> FallbackToHeuristic(
        object output,
        QualityEvaluationConfig config,
        CancellationToken ct)
    {
        _logger?.LogWarning("LLM evaluator not available, falling back to heuristic evaluation");
        return await _heuristicEvaluator.EvaluateAsync(output, config, ct);
    }

    private async Task<QualityScore> EvaluateCombinedAsync(
        object output,
        QualityEvaluationConfig config,
        CancellationToken ct)
    {
        var heuristicScore = await _heuristicEvaluator.EvaluateAsync(output, config, ct);

        if (_llmEvaluator == null)
        {
            return heuristicScore;
        }

        var llmScore = await _llmEvaluator.EvaluateAsync(output, config, ct);

        // Combine scores with weighted average
        // Heuristic: 40%, LLM: 60% (LLM is given more weight as it's more nuanced)
        var combinedScore = (int)(heuristicScore.Score * 0.4 + llmScore.Score * 0.6);
        var combinedConfidence = (heuristicScore.Confidence * 0.4 + llmScore.Confidence * 0.6);

        var combinedCriteria = new List<QualityCriterion>(heuristicScore.Criteria);
        combinedCriteria.Add(new QualityCriterion
        {
            Name = "LLM Assessment",
            Score = llmScore.Score,
            Weight = 0.6,
            Description = llmScore.Explanation
        });

        return new QualityScore
        {
            Score = combinedScore,
            Method = QualityEvaluationMethod.LLM,
            Criteria = combinedCriteria,
            Explanation = $"Combined evaluation: Heuristic={heuristicScore.Score}, LLM={llmScore.Score}",
            Confidence = combinedConfidence,
            EvaluatorModelId = llmScore.EvaluatorModelId
        };
    }
}
