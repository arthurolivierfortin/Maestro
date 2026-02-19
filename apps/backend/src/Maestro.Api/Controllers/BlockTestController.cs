using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.Testing;

namespace Maestro.Api.Controllers;

/// <summary>
/// Controller for block testing with iterative evaluation and improvement.
/// Supports all block types: tool, agent, workflow, task.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class BlockTestController : ControllerBase
{
    private readonly FileSystemBlockTestRepository _testRepository;
    private readonly IBlockDiscoveryService _discoveryService;
    private readonly ILogger<BlockTestController> _logger;

    public BlockTestController(
        FileSystemBlockTestRepository testRepository,
        IBlockDiscoveryService discoveryService,
        ILogger<BlockTestController> logger)
    {
        _testRepository = testRepository;
        _discoveryService = discoveryService;
        _logger = logger;
    }

    /// <summary>
    /// List all test runs.
    /// </summary>
    [HttpGet("runs")]
    public ActionResult<List<BlockTestRunDto>> ListTestRuns(
        [FromQuery] string? blockId = null,
        [FromQuery] string? blockType = null,
        [FromQuery] string? status = null)
    {
        var runs = _testRepository.GetAll().Values.AsEnumerable();

        if (!string.IsNullOrEmpty(blockId))
            runs = runs.Where(r => r.BlockId == blockId);

        if (!string.IsNullOrEmpty(blockType))
            runs = runs.Where(r => r.BlockType.Equals(blockType, StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<BlockTestRunStatus>(status, true, out var statusEnum))
            runs = runs.Where(r => r.Status == statusEnum);

        return runs
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => BlockTestRunDto.FromDomain(r, includeIterations: false))
            .ToList();
    }

    /// <summary>
    /// Get a specific test run with all iterations.
    /// </summary>
    [HttpGet("runs/{id}")]
    public ActionResult<BlockTestRunDto> GetTestRun(string id)
    {
        var run = _testRepository.GetById(id);
        if (run == null)
            return NotFound(new { message = $"Test run {id} not found" });

        return BlockTestRunDto.FromDomain(run);
    }

    /// <summary>
    /// Create and start a new test run for any block type.
    /// </summary>
    [HttpPost("runs")]
    public async Task<ActionResult<BlockTestRunDto>> CreateTestRun(
        [FromBody] CreateBlockTestRunRequest request,
        CancellationToken ct)
    {
        // Load the block to get test configuration
        var block = await _discoveryService.GetByIdAsync(request.BlockId, ct);
        if (block == null)
            return NotFound(new { message = $"Block {request.BlockId} not found" });

        // Extract test criteria from block's testConfig
        var criteria = new List<EvaluationCriterion>();
        if (block.Config?.TryGetValue("testConfig", out var testConfigObj) == true)
        {
            try
            {
                var testConfigJson = JsonSerializer.Serialize(testConfigObj);
                var testConfig = JsonSerializer.Deserialize<JsonElement>(testConfigJson);
                if (testConfig.TryGetProperty("evaluationCriteria", out var criteriaEl))
                {
                    foreach (var c in criteriaEl.EnumerateArray())
                    {
                        criteria.Add(new EvaluationCriterion
                        {
                            Id = c.GetProperty("id").GetString() ?? "",
                            Name = c.GetProperty("name").GetString() ?? "",
                            Description = c.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "",
                            Weight = c.TryGetProperty("weight", out var w) ? w.GetDouble() : 1.0
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse test config for block {BlockId}", request.BlockId);
            }
        }

        // Create the test run
        var run = new BlockTestRun
        {
            Name = request.Name ?? $"Test {block.Name} - {DateTime.Now:yyyy-MM-dd HH:mm}",
            BlockId = request.BlockId,
            BlockType = block.BlockType,
            VariantId = request.VariantId ?? "v1",
            VariantDescription = request.VariantDescription,
            TotalIterations = request.Iterations,
            EvaluatorType = request.EvaluatorType,
            EvaluatorModelId = request.EvaluatorModelId,
            Criteria = criteria.Any() ? criteria : GetDefaultCriteria(block.BlockType),
            Tags = request.Tags ?? new List<string>()
        };

        run.Start();
        _testRepository.Save(run);

        _logger.LogInformation("Created test run {RunId} for {BlockType} block {BlockId} with {Iterations} iterations",
            run.Id, block.BlockType, request.BlockId, request.Iterations);

        // Execute iterations (in a real implementation, this would be async/background)
        await ExecuteIterations(run, block, request.InputOverrides, ct);

        _testRepository.Save(run);
        return CreatedAtAction(nameof(GetTestRun), new { id = run.Id }, BlockTestRunDto.FromDomain(run));
    }

    /// <summary>
    /// Submit evaluation for an iteration.
    /// </summary>
    [HttpPost("runs/{runId}/evaluate")]
    public ActionResult<BlockTestRunDto> SubmitEvaluation(
        string runId,
        [FromBody] SubmitBlockEvaluationRequest request)
    {
        var run = _testRepository.GetById(runId);
        if (run == null)
            return NotFound(new { message = $"Test run {runId} not found" });

        var iteration = run.Iterations.FirstOrDefault(i => i.Id == request.IterationId);
        if (iteration == null)
            return NotFound(new { message = $"Iteration {request.IterationId} not found" });

        // Build quality score
        var method = request.EvaluatorType.ToLowerInvariant() switch
        {
            "llm" or "llm-provider" => QualityEvaluationMethod.LLM,
            "human" or "manual" => QualityEvaluationMethod.Human,
            "claude-code" => QualityEvaluationMethod.Human, // Claude Code counts as human-level evaluation
            "heuristic" => QualityEvaluationMethod.Heuristic,
            "automated" => QualityEvaluationMethod.Automated,
            _ => QualityEvaluationMethod.Custom
        };

        var criteria = request.CriteriaScores?.Select(c => new QualityCriterion
        {
            Name = c.Name,
            Score = c.Score,
            Description = c.Comment
        }).ToList() ?? new List<QualityCriterion>();

        var evaluation = new QualityScore
        {
            Score = request.OverallScore,
            Method = method,
            Criteria = criteria,
            Explanation = request.Explanation,
            EvaluatorModelId = request.EvaluatorModelId,
            Confidence = request.Confidence,
            EvaluatedAt = DateTimeOffset.UtcNow
        };

        run.SubmitEvaluation(request.IterationId, evaluation);

        _logger.LogInformation("Submitted evaluation for iteration {IterationId} in run {RunId}: score={Score}",
            request.IterationId, runId, request.OverallScore);

        // Check if all iterations are evaluated
        if (run.EvaluatedIterations >= run.TotalIterations)
        {
            run.Complete();
            _logger.LogInformation("Test run {RunId} completed with overall score {Score}",
                runId, run.Metrics?.OverallScore);
        }

        _testRepository.Save(run);
        return BlockTestRunDto.FromDomain(run);
    }

    /// <summary>
    /// Submit bulk evaluations.
    /// </summary>
    [HttpPost("runs/{runId}/evaluate/bulk")]
    public ActionResult<BlockTestRunDto> SubmitBulkEvaluation(
        string runId,
        [FromBody] SubmitBulkBlockEvaluationRequest request)
    {
        var run = _testRepository.GetById(runId);
        if (run == null)
            return NotFound(new { message = $"Test run {runId} not found" });

        foreach (var eval in request.Evaluations)
        {
            eval.EvaluatorType ??= "manual";
            var iteration = run.Iterations.FirstOrDefault(i => i.Id == eval.IterationId);
            if (iteration == null) continue;

            var method = eval.EvaluatorType.ToLowerInvariant() switch
            {
                "llm" => QualityEvaluationMethod.LLM,
                "human" or "manual" or "claude-code" => QualityEvaluationMethod.Human,
                _ => QualityEvaluationMethod.Custom
            };

            var evaluation = new QualityScore
            {
                Score = eval.OverallScore,
                Method = method,
                Explanation = eval.Explanation,
                Confidence = eval.Confidence,
                EvaluatedAt = DateTimeOffset.UtcNow
            };

            run.SubmitEvaluation(eval.IterationId, evaluation);
        }

        if (run.EvaluatedIterations >= run.TotalIterations)
            run.Complete();

        _testRepository.Save(run);
        return BlockTestRunDto.FromDomain(run);
    }

    /// <summary>
    /// Submit improvement suggestions for a test run.
    /// </summary>
    [HttpPost("runs/{runId}/improve")]
    public ActionResult<BlockTestRunDto> SubmitImprovement(
        string runId,
        [FromBody] SubmitBlockImprovementRequest request)
    {
        var run = _testRepository.GetById(runId);
        if (run == null)
            return NotFound(new { message = $"Test run {runId} not found" });

        run.ImprovementSuggestions.AddRange(request.Suggestions);

        _logger.LogInformation("Added {Count} improvement suggestions to run {RunId}",
            request.Suggestions.Count, runId);

        _testRepository.Save(run);
        return BlockTestRunDto.FromDomain(run);
    }

    /// <summary>
    /// Compare multiple test runs.
    /// </summary>
    [HttpGet("compare")]
    public ActionResult<BlockTestRunComparisonDto> CompareRuns([FromQuery] string runIds)
    {
        var ids = runIds.Split(',', StringSplitOptions.RemoveEmptyEntries);
        var runs = ids
            .Select(id => _testRepository.GetById(id))
            .Where(r => r != null)
            .ToList();

        if (!runs.Any())
            return NotFound(new { message = "No valid runs found" });

        var comparison = new BlockTestRunComparisonDto
        {
            Runs = runs.Select(r => BlockTestRunDto.FromDomain(r!, includeIterations: false)).ToList(),
            ScoresByVariant = runs
                .Where(r => r!.Metrics != null)
                .ToDictionary(r => r!.VariantId, r => (double)r.Metrics!.OverallScore)
        };

        var bestRun = runs.Where(r => r!.Metrics != null).OrderByDescending(r => r!.Metrics!.OverallScore).FirstOrDefault();
        if (bestRun != null)
        {
            comparison.BestRunId = bestRun.Id;
            comparison.BestScore = bestRun.Metrics!.OverallScore;
        }

        return comparison;
    }

    /// <summary>
    /// Get iterations pending evaluation.
    /// </summary>
    [HttpGet("runs/{runId}/pending")]
    public ActionResult<List<BlockTestIterationDto>> GetPendingEvaluations(string runId)
    {
        var run = _testRepository.GetById(runId);
        if (run == null)
            return NotFound(new { message = $"Test run {runId} not found" });

        return run.Iterations
            .Where(i => i.Evaluation == null)
            .Select(BlockTestIterationDto.FromDomain)
            .ToList();
    }

    /// <summary>
    /// Delete a test run.
    /// </summary>
    [HttpDelete("runs/{id}")]
    public ActionResult DeleteTestRun(string id)
    {
        if (!_testRepository.Delete(id))
            return NotFound(new { message = $"Test run {id} not found" });

        return NoContent();
    }

    private async Task ExecuteIterations(
        BlockTestRun run,
        BlockDefinition block,
        Dictionary<string, object>? inputOverrides,
        CancellationToken ct)
    {
        // Get sample inputs from block config or use overrides
        var baseInputs = inputOverrides ?? new Dictionary<string, object>();

        if (block.Config?.TryGetValue("testConfig", out var testConfigObj) == true)
        {
            try
            {
                var testConfigJson = JsonSerializer.Serialize(testConfigObj);
                var testConfig = JsonSerializer.Deserialize<JsonElement>(testConfigJson);
                if (testConfig.TryGetProperty("sampleInputs", out var samplesEl) && samplesEl.GetArrayLength() > 0)
                {
                    var sample = samplesEl[0];
                    foreach (var prop in sample.EnumerateObject())
                    {
                        if (!baseInputs.ContainsKey(prop.Name))
                            baseInputs[prop.Name] = prop.Value.ToString();
                    }
                }
            }
            catch { /* ignore */ }
        }

        for (int i = 1; i <= run.TotalIterations; i++)
        {
            var iteration = new BlockTestIteration
            {
                IterationNumber = i,
                Inputs = new Dictionary<string, object>(baseInputs),
                StartedAt = DateTimeOffset.UtcNow
            };

            try
            {
                var sw = System.Diagnostics.Stopwatch.StartNew();

                // In a real implementation, this would execute the block through the execution engine
                // For now, we'll simulate execution and let the evaluator see the outputs

                // Simulate execution - in reality, call IBlockExecutor
                await Task.Delay(100, ct); // Simulate work

                iteration.Success = true;
                iteration.OutputContent = $"[Iteration {i}] Simulated output for {block.BlockType} block {block.Id}. " +
                    $"Inputs: {JsonSerializer.Serialize(baseInputs)}";
                iteration.Outputs["stdout"] = iteration.OutputContent;
                iteration.Logs.Add($"Executed {block.BlockType} block {block.Id}");
                iteration.DurationMs = sw.ElapsedMilliseconds;
                iteration.CompletedAt = DateTimeOffset.UtcNow;
            }
            catch (Exception ex)
            {
                iteration.Success = false;
                iteration.ErrorMessage = ex.Message;
                iteration.CompletedAt = DateTimeOffset.UtcNow;
            }

            run.RecordIteration(iteration);
        }

        run.AwaitEvaluation();
        _logger.LogInformation("Test run {RunId} completed {Count} iterations, awaiting evaluation",
            run.Id, run.CompletedIterations);
    }

    private static List<EvaluationCriterion> GetDefaultCriteria(string blockType)
    {
        // Default criteria can vary by block type
        var baseCriteria = new List<EvaluationCriterion>
        {
            new() { Id = "correctness", Name = "Correctness", Description = "Does the output achieve the intended goal?", Weight = 0.4 },
            new() { Id = "quality", Name = "Quality", Description = "Is the output well-formed and high quality?", Weight = 0.3 },
        };

        // Add type-specific criteria
        switch (blockType.ToLowerInvariant())
        {
            case "agent":
                baseCriteria.Add(new() { Id = "autonomy", Name = "Autonomy", Description = "Did the agent work independently without unnecessary intervention?", Weight = 0.15 });
                baseCriteria.Add(new() { Id = "tool-usage", Name = "Tool Usage", Description = "Did the agent use tools effectively?", Weight = 0.15 });
                break;
            case "workflow":
                baseCriteria.Add(new() { Id = "flow", Name = "Flow", Description = "Did the workflow execute steps in the correct order?", Weight = 0.15 });
                baseCriteria.Add(new() { Id = "error-handling", Name = "Error Handling", Description = "Were errors handled gracefully?", Weight = 0.15 });
                break;
            case "tool":
                baseCriteria.Add(new() { Id = "efficiency", Name = "Efficiency", Description = "Was the execution efficient?", Weight = 0.2 });
                baseCriteria.Add(new() { Id = "reliability", Name = "Reliability", Description = "Did it work consistently?", Weight = 0.1 });
                break;
            default:
                baseCriteria.Add(new() { Id = "efficiency", Name = "Efficiency", Description = "Was the execution efficient?", Weight = 0.2 });
                baseCriteria.Add(new() { Id = "reliability", Name = "Reliability", Description = "Did it work consistently?", Weight = 0.1 });
                break;
        }

        return baseCriteria;
    }
}
