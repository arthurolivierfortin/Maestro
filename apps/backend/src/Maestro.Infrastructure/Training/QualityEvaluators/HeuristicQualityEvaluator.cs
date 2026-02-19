using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;
using NJsonSchema;

namespace Maestro.Infrastructure.Training.QualityEvaluators;

/// <summary>
/// Quality evaluator that uses rule-based heuristics.
/// </summary>
public class HeuristicQualityEvaluator : IQualityEvaluator
{
    private readonly ILogger<HeuristicQualityEvaluator>? _logger;

    public HeuristicQualityEvaluator(ILogger<HeuristicQualityEvaluator>? logger = null)
    {
        _logger = logger;
    }

    public async Task<QualityScore> EvaluateAsync(
        object output,
        QualityEvaluationConfig config,
        CancellationToken ct = default)
    {
        var criteria = new List<QualityCriterion>();
        var heuristics = config.Heuristics ?? new HeuristicEvaluationConfig();

        // Convert output to string for analysis
        var outputStr = output?.ToString() ?? string.Empty;
        var outputJson = output is string str ? str : JsonSerializer.Serialize(output);

        // Check: Output not empty
        if (heuristics.CheckOutputNotEmpty)
        {
            var notEmpty = !string.IsNullOrWhiteSpace(outputStr);
            criteria.Add(new QualityCriterion
            {
                Name = "Output Not Empty",
                Score = notEmpty ? 100 : 0,
                Weight = 0.2,
                Passed = notEmpty,
                Description = notEmpty ? "Output contains content" : "Output is empty"
            });
        }

        // Check: Valid JSON
        if (heuristics.CheckJsonValid)
        {
            var isValidJson = IsValidJson(outputJson);
            criteria.Add(new QualityCriterion
            {
                Name = "Valid JSON",
                Score = isValidJson ? 100 : 0,
                Weight = 0.3,
                Passed = isValidJson,
                Description = isValidJson ? "Output is valid JSON" : "Output is not valid JSON"
            });
        }

        // Check: Schema compliance
        if (!string.IsNullOrEmpty(heuristics.CheckSchemaCompliance))
        {
            var schemaCompliance = await CheckSchemaComplianceAsync(outputJson, heuristics.CheckSchemaCompliance, ct);
            criteria.Add(new QualityCriterion
            {
                Name = "Schema Compliance",
                Score = schemaCompliance.score,
                Weight = 0.4,
                Passed = schemaCompliance.passed,
                Description = schemaCompliance.message
            });
        }

        // Additional checks
        criteria.AddRange(PerformAdditionalChecks(outputStr));

        // Calculate weighted score
        var totalWeight = criteria.Sum(c => c.Weight);
        var weightedScore = totalWeight > 0
            ? criteria.Sum(c => c.Score * c.Weight) / totalWeight
            : 0;

        var explanation = GenerateExplanation(criteria);

        _logger?.LogDebug("Heuristic evaluation completed: Score={Score}, Criteria={CriteriaCount}",
            (int)weightedScore, criteria.Count);

        return QualityScore.FromHeuristic((int)weightedScore, criteria, explanation);
    }

    private bool IsValidJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return false;
        }

        try
        {
            JsonDocument.Parse(json);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private async Task<(int score, bool passed, string message)> CheckSchemaComplianceAsync(
        string json,
        string schemaJson,
        CancellationToken ct)
    {
        try
        {
            var schema = await JsonSchema.FromJsonAsync(schemaJson, ct);
            var errors = schema.Validate(json);

            if (!errors.Any())
            {
                return (100, true, "Output conforms to schema");
            }

            var errorCount = errors.Count();
            var score = Math.Max(0, 100 - (errorCount * 20));
            var message = $"Schema validation: {errorCount} error(s) - {errors.First().ToString()}";

            return (score, false, message);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to validate against schema");
            return (50, false, $"Schema validation failed: {ex.Message}");
        }
    }

    private List<QualityCriterion> PerformAdditionalChecks(string output)
    {
        var criteria = new List<QualityCriterion>();

        // Length check - penalize very short or very long outputs
        var length = output.Length;
        int lengthScore;
        string lengthDesc;

        if (length < 10)
        {
            lengthScore = 20;
            lengthDesc = "Output is very short";
        }
        else if (length < 50)
        {
            lengthScore = 60;
            lengthDesc = "Output is relatively short";
        }
        else if (length > 100000)
        {
            lengthScore = 60;
            lengthDesc = "Output is very long";
        }
        else
        {
            lengthScore = 100;
            lengthDesc = "Output length is appropriate";
        }

        criteria.Add(new QualityCriterion
        {
            Name = "Output Length",
            Score = lengthScore,
            Weight = 0.1,
            Description = lengthDesc
        });

        // Check for common error patterns
        var hasErrorPatterns = ContainsErrorPatterns(output);
        criteria.Add(new QualityCriterion
        {
            Name = "No Error Patterns",
            Score = hasErrorPatterns ? 30 : 100,
            Weight = 0.2,
            Passed = !hasErrorPatterns,
            Description = hasErrorPatterns
                ? "Output contains potential error indicators"
                : "No error patterns detected"
        });

        return criteria;
    }

    private bool ContainsErrorPatterns(string output)
    {
        var errorPatterns = new[]
        {
            "error:",
            "exception:",
            "failed:",
            "Error:",
            "Exception:",
            "Failed:",
            "FAILED",
            "undefined",
            "null pointer",
            "NullReferenceException",
            "TypeError:",
            "SyntaxError:"
        };

        return errorPatterns.Any(p => output.Contains(p, StringComparison.OrdinalIgnoreCase));
    }

    private string GenerateExplanation(List<QualityCriterion> criteria)
    {
        var passed = criteria.Where(c => c.Passed == true).ToList();
        var failed = criteria.Where(c => c.Passed == false).ToList();

        var explanation = new List<string>();

        if (passed.Any())
        {
            explanation.Add($"Passed: {string.Join(", ", passed.Select(c => c.Name))}");
        }

        if (failed.Any())
        {
            explanation.Add($"Failed: {string.Join(", ", failed.Select(c => c.Name))}");
        }

        return string.Join(". ", explanation);
    }
}
