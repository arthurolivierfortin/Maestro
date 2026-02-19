using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Training.QualityEvaluators;

/// <summary>
/// Quality evaluator that uses an LLM to assess output quality.
/// </summary>
public class LLMQualityEvaluator : IQualityEvaluator
{
    private readonly ILLMGateway _llmGateway;
    private readonly ILogger<LLMQualityEvaluator>? _logger;

    public LLMQualityEvaluator(ILLMGateway llmGateway, ILogger<LLMQualityEvaluator>? logger = null)
    {
        _llmGateway = llmGateway;
        _logger = logger;
    }

    public async Task<QualityScore> EvaluateAsync(
        object output,
        QualityEvaluationConfig config,
        CancellationToken ct = default)
    {
        var llmConfig = config.LLMEvaluation;
        if (llmConfig == null)
        {
            _logger?.LogWarning("LLM evaluation config is missing");
            return QualityScore.FromLLM(50, "unknown", "LLM evaluation config not provided", 0.3);
        }

        var outputStr = output is string str ? str : JsonSerializer.Serialize(output);

        // Build the evaluation prompt
        var prompt = BuildEvaluationPrompt(outputStr, llmConfig);

        try
        {
            var request = new LLMRequest { Prompt = prompt };
            var response = await _llmGateway.SendAsync(request, ct);

            // Parse the response to extract score and explanation
            var (score, explanation, confidence) = ParseEvaluationResponse(
                response.Content,
                llmConfig.ScoreMin,
                llmConfig.ScoreMax);

            _logger?.LogDebug("LLM evaluation completed: Score={Score}, Confidence={Confidence}",
                score, confidence);

            return QualityScore.FromLLM(score, llmConfig.ModelId, explanation, confidence);
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "LLM evaluation failed");
            return QualityScore.FromLLM(50, llmConfig.ModelId, $"Evaluation failed: {ex.Message}", 0.2);
        }
    }

    private string BuildEvaluationPrompt(string output, LLMEvaluationConfig config)
    {
        var criteriaSection = "";
        if (config.Criteria != null && config.Criteria.Any())
        {
            criteriaSection = $@"
Evaluate based on these criteria:
{string.Join("\n", config.Criteria.Select((c, i) => $"{i + 1}. {c}"))}
";
        }

        var customPrompt = !string.IsNullOrEmpty(config.EvaluationPrompt)
            ? config.EvaluationPrompt
            : "Evaluate the quality of the following output.";

        return $@"{customPrompt}

{criteriaSection}

Output to evaluate:
```
{output}
```

Provide your evaluation in the following JSON format:
{{
  ""score"": <number between {config.ScoreMin} and {config.ScoreMax}>,
  ""explanation"": ""<brief explanation of the score>"",
  ""confidence"": <number between 0 and 1 indicating confidence in your evaluation>
}}

Only respond with the JSON object, no additional text.";
    }

    private (int score, string explanation, double confidence) ParseEvaluationResponse(
        string response,
        int minScore,
        int maxScore)
    {
        try
        {
            // Try to extract JSON from response
            var jsonStart = response.IndexOf('{');
            var jsonEnd = response.LastIndexOf('}');

            if (jsonStart >= 0 && jsonEnd > jsonStart)
            {
                var json = response.Substring(jsonStart, jsonEnd - jsonStart + 1);
                var parsed = JsonSerializer.Deserialize<EvaluationResponse>(json);

                if (parsed != null)
                {
                    var score = Math.Clamp(parsed.Score, minScore, maxScore);
                    // Normalize to 0-100
                    var normalizedScore = (int)((score - minScore) / (double)(maxScore - minScore) * 100);
                    return (normalizedScore, parsed.Explanation ?? "No explanation provided", parsed.Confidence);
                }
            }

            // Fallback: try to extract score from text
            var scoreMatch = System.Text.RegularExpressions.Regex.Match(response, @"score[:\s]+(\d+)");
            if (scoreMatch.Success && int.TryParse(scoreMatch.Groups[1].Value, out var extractedScore))
            {
                var normalizedScore = (int)((extractedScore - minScore) / (double)(maxScore - minScore) * 100);
                return (normalizedScore, response, 0.5);
            }

            _logger?.LogWarning("Could not parse evaluation response: {Response}", response);
            return (50, response, 0.3);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to parse evaluation response");
            return (50, $"Parse error: {response}", 0.2);
        }
    }

    private class EvaluationResponse
    {
        public int Score { get; set; }
        public string? Explanation { get; set; }
        public double Confidence { get; set; } = 0.7;
    }
}
