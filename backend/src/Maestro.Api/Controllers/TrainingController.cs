using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;

namespace Maestro.Api.Controllers;

/// <summary>
/// Controller for training configurations and runs.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class TrainingController : ControllerBase
{
    private readonly ITrainingService _trainingService;
    private readonly ILogger<TrainingController> _logger;

    public TrainingController(ITrainingService trainingService, ILogger<TrainingController> logger)
    {
        _trainingService = trainingService;
        _logger = logger;
    }

    #region Configurations

    /// <summary>
    /// Get all training configurations.
    /// </summary>
    [HttpGet("configurations")]
    public async Task<ActionResult<IEnumerable<TrainingConfigurationDto>>> GetConfigurations()
    {
        var configs = await _trainingService.GetAllConfigurationsAsync();
        return Ok(configs.Select(TrainingConfigurationDto.FromDomain));
    }

    /// <summary>
    /// Get a training configuration by ID.
    /// </summary>
    [HttpGet("configurations/{id}")]
    public async Task<ActionResult<TrainingConfigurationDto>> GetConfiguration(string id)
    {
        var config = await _trainingService.GetConfigurationAsync(id);

        if (config == null)
        {
            return NotFound($"Training configuration {id} not found");
        }

        return Ok(TrainingConfigurationDto.FromDomain(config));
    }

    /// <summary>
    /// Create a new training configuration.
    /// </summary>
    [HttpPost("configurations")]
    public async Task<ActionResult<TrainingConfigurationDto>> CreateConfiguration(
        [FromBody] CreateTrainingConfigRequest request)
    {
        var dto = new TrainingConfigurationDto
        {
            Name = request.Name,
            Description = request.Description,
            WorkflowId = request.WorkflowId,
            Iterations = request.Iterations,
            ParallelIterations = request.ParallelIterations,
            OptimizationGoal = request.OptimizationGoal,
            QualityEvaluation = request.QualityEvaluation ?? new QualityEvaluationConfigDto(),
            Constraints = request.Constraints,
            ModelOverrides = request.ModelOverrides ?? new Dictionary<string, string>(),
            Tags = request.Tags ?? new List<string>(),
            IsActive = true
        };

        var config = await _trainingService.CreateConfigurationAsync(dto.ToDomain());

        _logger.LogInformation("Created training configuration {Id}: {Name}", config.Id, config.Name);

        return CreatedAtAction(
            nameof(GetConfiguration),
            new { id = config.Id },
            TrainingConfigurationDto.FromDomain(config));
    }

    /// <summary>
    /// Update a training configuration.
    /// </summary>
    [HttpPut("configurations/{id}")]
    public async Task<ActionResult<TrainingConfigurationDto>> UpdateConfiguration(
        string id,
        [FromBody] TrainingConfigurationDto dto)
    {
        var existing = await _trainingService.GetConfigurationAsync(id);
        if (existing == null)
        {
            return NotFound($"Training configuration {id} not found");
        }

        dto.Id = id;
        var config = await _trainingService.UpdateConfigurationAsync(dto.ToDomain());

        return Ok(TrainingConfigurationDto.FromDomain(config));
    }

    /// <summary>
    /// Delete a training configuration.
    /// </summary>
    [HttpDelete("configurations/{id}")]
    public async Task<ActionResult> DeleteConfiguration(string id)
    {
        var existing = await _trainingService.GetConfigurationAsync(id);
        if (existing == null)
        {
            return NotFound($"Training configuration {id} not found");
        }

        await _trainingService.DeleteConfigurationAsync(id);

        return NoContent();
    }

    #endregion

    #region Runs

    /// <summary>
    /// Get all training runs.
    /// </summary>
    [HttpGet("runs")]
    public async Task<ActionResult<IEnumerable<TrainingRunDto>>> GetRuns(
        [FromQuery] int? limit = 50,
        [FromQuery] int? offset = 0)
    {
        var runs = await _trainingService.GetAllRunsAsync(limit, offset);
        return Ok(runs.Select(TrainingRunDto.FromDomain));
    }

    /// <summary>
    /// Get a training run by ID.
    /// </summary>
    [HttpGet("runs/{id}")]
    public async Task<ActionResult<TrainingRunDto>> GetRun(string id)
    {
        var run = await _trainingService.GetRunAsync(id);

        if (run == null)
        {
            return NotFound($"Training run {id} not found");
        }

        return Ok(TrainingRunDto.FromDomain(run));
    }

    /// <summary>
    /// Get runs for a specific configuration.
    /// </summary>
    [HttpGet("configurations/{configId}/runs")]
    public async Task<ActionResult<IEnumerable<TrainingRunDto>>> GetRunsByConfiguration(string configId)
    {
        var runs = await _trainingService.GetRunsByConfigurationAsync(configId);
        return Ok(runs.Select(TrainingRunDto.FromDomain));
    }

    /// <summary>
    /// Start a new training run.
    /// </summary>
    [HttpPost("configurations/{configId}/runs")]
    public async Task<ActionResult<TrainingRunDto>> StartRun(
        string configId,
        [FromBody] StartTrainingRunRequest? request = null)
    {
        try
        {
            var run = await _trainingService.StartRunAsync(
                configId,
                request?.Name,
                request?.InitiatedBy,
                request?.Inputs);

            _logger.LogInformation("Started training run {RunId} for configuration {ConfigId}",
                run.Id, configId);

            return CreatedAtAction(
                nameof(GetRun),
                new { id = run.Id },
                TrainingRunDto.FromDomain(run));
        }
        catch (ArgumentException ex)
        {
            return NotFound(ex.Message);
        }
    }

    /// <summary>
    /// Pause a running training run.
    /// </summary>
    [HttpPost("runs/{id}/pause")]
    public async Task<ActionResult<TrainingRunDto>> PauseRun(string id)
    {
        try
        {
            var run = await _trainingService.PauseRunAsync(id);
            return Ok(TrainingRunDto.FromDomain(run));
        }
        catch (ArgumentException ex)
        {
            return NotFound(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>
    /// Resume a paused training run.
    /// </summary>
    [HttpPost("runs/{id}/resume")]
    public async Task<ActionResult<TrainingRunDto>> ResumeRun(string id)
    {
        try
        {
            var run = await _trainingService.ResumeRunAsync(id);
            return Ok(TrainingRunDto.FromDomain(run));
        }
        catch (ArgumentException ex)
        {
            return NotFound(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>
    /// Cancel a training run.
    /// </summary>
    [HttpDelete("runs/{id}")]
    public async Task<ActionResult<TrainingRunDto>> CancelRun(string id)
    {
        try
        {
            var run = await _trainingService.CancelRunAsync(id);
            return Ok(TrainingRunDto.FromDomain(run));
        }
        catch (ArgumentException ex)
        {
            return NotFound(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    #endregion
}
