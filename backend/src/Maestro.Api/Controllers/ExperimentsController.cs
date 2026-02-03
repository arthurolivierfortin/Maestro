using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Maestro.Api.Controllers;

/// <summary>
/// API for training experiments.
/// This API is a thin wrapper that delegates logic to system:experiment-manager agent.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ExperimentsController : ControllerBase
{
    private readonly IExperimentRepository _repository;
    private readonly IBlockDiscoveryService _blockDiscovery;
    private readonly ILogger<ExperimentsController> _logger;

    public ExperimentsController(
        IExperimentRepository repository,
        IBlockDiscoveryService blockDiscovery,
        ILogger<ExperimentsController> logger)
    {
        _repository = repository;
        _blockDiscovery = blockDiscovery;
        _logger = logger;
    }

    /// <summary>
    /// List all experiments with optional filters
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ExperimentDto>>> GetAll(
        [FromQuery] string? workspaceId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? agentId = null,
        [FromQuery] string? strategyId = null)
    {
        IEnumerable<TrainingExperiment> experiments;

        if (!string.IsNullOrEmpty(workspaceId))
        {
            experiments = await _repository.GetByWorkspaceAsync(workspaceId);
        }
        else if (!string.IsNullOrEmpty(status) &&
                 Enum.TryParse<ExperimentStatus>(status, true, out var statusEnum))
        {
            experiments = await _repository.GetByStatusAsync(statusEnum);
        }
        else if (!string.IsNullOrEmpty(agentId))
        {
            experiments = await _repository.GetByAgentAsync(agentId);
        }
        else if (!string.IsNullOrEmpty(strategyId))
        {
            experiments = await _repository.GetByStrategyAsync(strategyId);
        }
        else
        {
            experiments = await _repository.GetAllAsync();
        }

        return Ok(experiments.Select(ExperimentDto.FromDomain));
    }

    /// <summary>
    /// Get an experiment by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ExperimentDto>> GetById(string id)
    {
        var experiment = await _repository.GetByIdAsync(id);
        if (experiment == null)
            return NotFound(new { error = $"Experiment {id} not found" });

        return Ok(ExperimentDto.FromDomain(experiment));
    }

    /// <summary>
    /// Create a new experiment
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ExperimentDto>> Create([FromBody] CreateExperimentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Name is required" });
        if (string.IsNullOrWhiteSpace(request.WorkspaceId))
            return BadRequest(new { error = "WorkspaceId is required" });
        if (string.IsNullOrWhiteSpace(request.AgentId))
            return BadRequest(new { error = "AgentId is required" });
        if (string.IsNullOrWhiteSpace(request.StrategyId))
            return BadRequest(new { error = "StrategyId is required" });

        // Verify strategy exists
        var blocks = await _blockDiscovery.DiscoverAllAsync();
        var strategyExists = blocks.Any(b => b.Id == request.StrategyId);
        if (!strategyExists)
        {
            _logger.LogWarning("Strategy {StrategyId} not found", request.StrategyId);
            // Allow creation anyway - strategy might be loaded later
        }

        var experiment = TrainingExperiment.Create(
            request.Name,
            request.WorkspaceId,
            request.AgentId,
            request.StrategyId,
            request.Config
        );

        await _repository.SaveAsync(experiment);
        _logger.LogInformation("Created experiment {Id} with strategy {Strategy}",
            experiment.Id, request.StrategyId);

        return CreatedAtAction(nameof(GetById), new { id = experiment.Id },
            ExperimentDto.FromDomain(experiment));
    }

    /// <summary>
    /// Update an experiment
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<ExperimentDto>> Update(string id, [FromBody] UpdateExperimentRequest request)
    {
        var experiment = await _repository.GetByIdAsync(id);
        if (experiment == null)
            return NotFound(new { error = $"Experiment {id} not found" });

        if (request.Config != null)
        {
            experiment.UpdateConfig(request.Config);
        }

        await _repository.SaveAsync(experiment);
        return Ok(ExperimentDto.FromDomain(experiment));
    }

    /// <summary>
    /// Start an experiment
    /// </summary>
    [HttpPost("{id}/start")]
    public async Task<ActionResult<ExperimentDto>> Start(string id)
    {
        var experiment = await _repository.GetByIdAsync(id);
        if (experiment == null)
            return NotFound(new { error = $"Experiment {id} not found" });

        try
        {
            experiment.Start();
            await _repository.SaveAsync(experiment);
            _logger.LogInformation("Started experiment {Id}", id);
            return Ok(ExperimentDto.FromDomain(experiment));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Pause an experiment
    /// </summary>
    [HttpPost("{id}/pause")]
    public async Task<ActionResult<ExperimentDto>> Pause(string id)
    {
        var experiment = await _repository.GetByIdAsync(id);
        if (experiment == null)
            return NotFound(new { error = $"Experiment {id} not found" });

        try
        {
            experiment.Pause();
            await _repository.SaveAsync(experiment);
            _logger.LogInformation("Paused experiment {Id}", id);
            return Ok(ExperimentDto.FromDomain(experiment));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Stop/cancel an experiment
    /// </summary>
    [HttpPost("{id}/stop")]
    public async Task<ActionResult<ExperimentDto>> Stop(string id)
    {
        var experiment = await _repository.GetByIdAsync(id);
        if (experiment == null)
            return NotFound(new { error = $"Experiment {id} not found" });

        experiment.Cancel();
        await _repository.SaveAsync(experiment);
        _logger.LogInformation("Stopped experiment {Id}", id);

        return Ok(ExperimentDto.FromDomain(experiment));
    }

    /// <summary>
    /// Delete an experiment
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var exists = await _repository.ExistsAsync(id);
        if (!exists)
            return NotFound(new { error = $"Experiment {id} not found" });

        await _repository.DeleteAsync(id);
        _logger.LogInformation("Deleted experiment {Id}", id);
        return NoContent();
    }

    /// <summary>
    /// List all available training strategies (system blocks)
    /// </summary>
    [HttpGet("strategies")]
    public async Task<ActionResult<IEnumerable<StrategyInfoDto>>> GetStrategies(
        [FromQuery] string? category = null)
    {
        var blocks = await _blockDiscovery.DiscoverAllAsync();
        var strategies = blocks
            .Where(b => b.BlockType == "workflow" &&
                       b.Id.StartsWith("system:strategy-"))
            .Select(b => MapToStrategyInfo(b))
            .Where(s => s != null)
            .Cast<StrategyInfoDto>();

        if (!string.IsNullOrEmpty(category))
        {
            strategies = strategies.Where(s =>
                s.Category.Equals(category, StringComparison.OrdinalIgnoreCase));
        }

        return Ok(strategies);
    }

    /// <summary>
    /// Get a specific strategy
    /// </summary>
    [HttpGet("strategies/{strategyId}")]
    public async Task<ActionResult<StrategyInfoDto>> GetStrategy(string strategyId)
    {
        var blocks = await _blockDiscovery.DiscoverAllAsync();
        var block = blocks.FirstOrDefault(b => b.Id == strategyId);

        if (block == null)
            return NotFound(new { error = $"Strategy {strategyId} not found" });

        var info = MapToStrategyInfo(block);
        if (info == null)
            return NotFound(new { error = $"Block {strategyId} is not a strategy" });

        return Ok(info);
    }

    /// <summary>
    /// Compare multiple experiments
    /// </summary>
    [HttpPost("compare")]
    public async Task<ActionResult<ExperimentComparisonDto>> Compare(
        [FromBody] CompareExperimentsRequest request)
    {
        if (request.ExperimentIds == null || request.ExperimentIds.Count < 2)
            return BadRequest(new { error = "Need at least 2 experiments to compare" });

        var experiments = new List<TrainingExperiment>();
        foreach (var id in request.ExperimentIds)
        {
            var exp = await _repository.GetByIdAsync(id);
            if (exp != null)
                experiments.Add(exp);
        }

        if (experiments.Count < 2)
            return BadRequest(new { error = "Need at least 2 valid experiments to compare" });

        var completed = experiments.Where(e => e.Results != null).ToList();
        var rankings = new Dictionary<string, ExperimentRankingDto>();

        if (completed.Any())
        {
            var byFitness = completed.OrderByDescending(e => e.Results!.FinalFitness).ToList();
            var byCostEff = completed.OrderByDescending(e => e.Results!.CostEfficiency).ToList();
            var byTimeEff = completed.OrderByDescending(e => e.Results!.TimeEfficiency).ToList();

            foreach (var exp in completed)
            {
                var fitnessRank = byFitness.IndexOf(exp) + 1;
                var costRank = byCostEff.IndexOf(exp) + 1;
                var timeRank = byTimeEff.IndexOf(exp) + 1;
                var avgRank = (fitnessRank + costRank + timeRank) / 3.0;

                rankings[exp.Id] = new ExperimentRankingDto
                {
                    FitnessRank = fitnessRank,
                    CostEfficiencyRank = costRank,
                    TimeEfficiencyRank = timeRank,
                    OverallRank = (int)Math.Round(avgRank),
                    Score = 100.0 / avgRank // Higher is better
                };
            }
        }

        var bestId = rankings
            .OrderBy(kvp => kvp.Value.OverallRank)
            .FirstOrDefault().Key ?? experiments.First().Id;

        var bestExperiment = experiments.First(e => e.Id == bestId);

        // Calculate summary
        var summary = new ComparisonSummaryDto
        {
            BestFitness = completed.Any() ? completed.Max(e => e.Results!.FinalFitness) : 0,
            AverageFitness = completed.Any() ? completed.Average(e => e.Results!.FinalFitness) : 0,
            BestCostEfficiency = completed.Any()
                ? completed.Max(e => double.IsInfinity(e.Results!.CostEfficiency) ? 0 : e.Results!.CostEfficiency)
                : 0,
            MostEffectiveStrategy = bestExperiment.StrategyBlockId,
            TotalIterationsAcrossAll = completed.Sum(e => e.Results?.TotalIterations ?? 0),
            TotalCostAcrossAll = completed.Sum(e => e.Results?.TotalCost ?? 0)
        };

        return Ok(new ExperimentComparisonDto
        {
            Experiments = experiments.Select(ExperimentDto.FromDomain).ToList(),
            BestExperimentId = bestId,
            RecommendedStrategyId = bestExperiment.StrategyBlockId,
            Rankings = rankings,
            Summary = summary
        });
    }

    /// <summary>
    /// Get experiment progress
    /// </summary>
    [HttpGet("{id}/progress")]
    public async Task<ActionResult<object>> GetProgress(string id)
    {
        var experiment = await _repository.GetByIdAsync(id);
        if (experiment == null)
            return NotFound(new { error = $"Experiment {id} not found" });

        // Calculate estimated progress based on config
        var maxIterations = 100; // Default
        if (experiment.Config.TryGetValue("maxIterations", out var maxIter))
        {
            if (maxIter is int mi) maxIterations = mi;
            else if (maxIter is long ml) maxIterations = (int)ml;
            else if (maxIter is double md) maxIterations = (int)md;
        }

        var progress = maxIterations > 0
            ? Math.Min(100.0, (double)experiment.CurrentIteration / maxIterations * 100)
            : 0;

        return Ok(new
        {
            experimentId = experiment.Id,
            status = experiment.Status.ToString(),
            progress = Math.Round(progress, 1),
            currentIteration = experiment.CurrentIteration,
            maxIterations = maxIterations,
            currentFitness = experiment.CurrentFitness,
            startedAt = experiment.StartedAt,
            elapsedTime = experiment.StartedAt.HasValue
                ? (DateTimeOffset.UtcNow - experiment.StartedAt.Value).ToString()
                : null
        });
    }

    private static StrategyInfoDto? MapToStrategyInfo(Maestro.Domain.Entities.BlockDefinition block)
    {
        if (block.BlockType != "workflow" || !block.Id.StartsWith("system:strategy-"))
            return null;

        var metadata = block.Metadata ?? new Dictionary<string, object>();

        return new StrategyInfoDto
        {
            Id = block.Id,
            Name = block.Name,
            Description = block.Description ?? string.Empty,
            Method = GetStringValue(metadata, "method", "Unknown"),
            Category = GetStringValue(metadata, "category", "Unknown"),
            SuitableFor = GetStringList(metadata, "suitableFor"),
            Strengths = GetStringList(metadata, "strengths"),
            Weaknesses = GetStringList(metadata, "weaknesses"),
            EstimatedResources = GetEstimatedResources(metadata),
            IsSystem = block.IsSystem,
            IsOverridable = block.Overridable
        };
    }

    private static string GetStringValue(Dictionary<string, object> dict, string key, string defaultValue)
    {
        if (dict.TryGetValue(key, out var value))
            return value?.ToString() ?? defaultValue;
        return defaultValue;
    }

    private static List<string> GetStringList(Dictionary<string, object> dict, string key)
    {
        if (dict.TryGetValue(key, out var value))
        {
            if (value is IEnumerable<object> enumerable)
                return enumerable.Select(x => x?.ToString() ?? string.Empty).ToList();
            if (value is System.Text.Json.JsonElement jsonElement && jsonElement.ValueKind == System.Text.Json.JsonValueKind.Array)
                return jsonElement.EnumerateArray().Select(x => x.GetString() ?? string.Empty).ToList();
        }
        return new List<string>();
    }

    private static EstimatedResourcesDto? GetEstimatedResources(Dictionary<string, object> dict)
    {
        if (!dict.TryGetValue("estimatedResources", out var value))
            return null;

        if (value is Dictionary<string, object> resources)
        {
            return new EstimatedResourcesDto
            {
                MinIterations = GetIntValue(resources, "minIterations", 0),
                TypicalIterations = GetIntValue(resources, "typicalIterations", 0),
                MaxIterations = GetIntValue(resources, "maxIterations", 0),
                CostPerIteration = GetStringValue(resources, "costPerIteration", "unknown")
            };
        }

        if (value is System.Text.Json.JsonElement jsonElement && jsonElement.ValueKind == System.Text.Json.JsonValueKind.Object)
        {
            return new EstimatedResourcesDto
            {
                MinIterations = jsonElement.TryGetProperty("minIterations", out var min) ? min.GetInt32() : 0,
                TypicalIterations = jsonElement.TryGetProperty("typicalIterations", out var typ) ? typ.GetInt32() : 0,
                MaxIterations = jsonElement.TryGetProperty("maxIterations", out var max) ? max.GetInt32() : 0,
                CostPerIteration = jsonElement.TryGetProperty("costPerIteration", out var cost) ? cost.GetString() ?? "unknown" : "unknown"
            };
        }

        return null;
    }

    private static int GetIntValue(Dictionary<string, object> dict, string key, int defaultValue)
    {
        if (dict.TryGetValue(key, out var value))
        {
            if (value is int i) return i;
            if (value is long l) return (int)l;
            if (value is double d) return (int)d;
            if (int.TryParse(value?.ToString(), out var parsed)) return parsed;
        }
        return defaultValue;
    }
}
