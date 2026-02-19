using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Domain.ValueObjects;

namespace Maestro.Api.Controllers;

/// <summary>
/// Controller for fitness calculations and model rankings.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class FitnessController : ControllerBase
{
    private readonly IFitnessService _fitnessService;
    private readonly IModelProfileRepository _profileRepository;
    private readonly ITaskEntropyRepository _entropyRepository;
    private readonly ILogger<FitnessController> _logger;

    public FitnessController(
        IFitnessService fitnessService,
        IModelProfileRepository profileRepository,
        ITaskEntropyRepository entropyRepository,
        ILogger<FitnessController> logger)
    {
        _fitnessService = fitnessService;
        _profileRepository = profileRepository;
        _entropyRepository = entropyRepository;
        _logger = logger;
    }

    #region Fitness Calculation

    /// <summary>
    /// Calculate fitness for an execution.
    /// </summary>
    [HttpPost("calculate")]
    public async Task<ActionResult<FitnessScoreDto>> CalculateFitness(
        [FromBody] CalculateFitnessRequest request)
    {
        if (request.Metrics == null)
        {
            return BadRequest("Execution metrics are required");
        }

        var metrics = request.Metrics.ToDomain();
        var fitnessScore = await _fitnessService.CalculateFitnessAsync(
            metrics,
            request.ModelId,
            request.TaskType);

        _logger.LogInformation(
            "Calculated fitness for model {ModelId}: {Fitness:F3}",
            request.ModelId,
            fitnessScore.TotalFitness);

        return Ok(FitnessScoreDto.FromDomain(fitnessScore));
    }

    /// <summary>
    /// Get fitness history for a model.
    /// </summary>
    [HttpGet("history/{modelId}")]
    public async Task<ActionResult<IEnumerable<FitnessScoreDto>>> GetFitnessHistory(
        string modelId,
        [FromQuery] string? taskType = null,
        [FromQuery] int limit = 100)
    {
        var history = await _fitnessService.GetFitnessHistoryAsync(modelId, taskType, limit);
        return Ok(history.Select(FitnessScoreDto.FromDomain));
    }

    /// <summary>
    /// Get aggregate fitness statistics for a model.
    /// </summary>
    [HttpGet("stats/{modelId}")]
    public async Task<ActionResult<AggregateFitnessStatsDto>> GetFitnessStats(
        string modelId,
        [FromQuery] string? taskType = null)
    {
        var stats = await _fitnessService.GetModelFitnessStatsAsync(modelId, taskType);
        return Ok(AggregateFitnessStatsDto.FromDomain(stats));
    }

    #endregion

    #region Configuration

    /// <summary>
    /// Get the current fitness configuration.
    /// </summary>
    [HttpGet("config")]
    public async Task<ActionResult<FitnessConfigDto>> GetConfig()
    {
        var config = await _fitnessService.GetConfigAsync();
        return Ok(FitnessConfigDto.FromDomain(config));
    }

    /// <summary>
    /// Update the fitness configuration.
    /// </summary>
    [HttpPut("config")]
    public async Task<ActionResult<FitnessConfigDto>> UpdateConfig(
        [FromBody] UpdateFitnessConfigRequest request)
    {
        var currentConfig = await _fitnessService.GetConfigAsync();

        var updatedConfig = new FitnessConfig
        {
            Lambda = request.Lambda ?? currentConfig.Lambda,
            VramWeight = request.VramWeight ?? currentConfig.VramWeight,
            RamWeight = request.RamWeight ?? currentConfig.RamWeight,
            GpuWeight = request.GpuWeight ?? currentConfig.GpuWeight,
            BaselineCostPerMillion = request.BaselineCostPerMillion ?? currentConfig.BaselineCostPerMillion,
            RetryPenaltyFactor = request.RetryPenaltyFactor ?? currentConfig.RetryPenaltyFactor,
            MinimumFitnessThreshold = request.MinimumFitnessThreshold ?? currentConfig.MinimumFitnessThreshold,
            MaximumFitnessScore = request.MaximumFitnessScore ?? currentConfig.MaximumFitnessScore,
            PerformanceWeight = request.PerformanceWeight ?? currentConfig.PerformanceWeight,
            SpecializationWeight = request.SpecializationWeight ?? currentConfig.SpecializationWeight,
            ComposabilityWeight = request.ComposabilityWeight ?? currentConfig.ComposabilityWeight
        };

        var result = await _fitnessService.UpdateConfigAsync(updatedConfig);

        _logger.LogInformation("Updated fitness configuration");

        return Ok(FitnessConfigDto.FromDomain(result));
    }

    /// <summary>
    /// Reset fitness configuration to defaults.
    /// </summary>
    [HttpPost("config/reset")]
    public async Task<ActionResult<FitnessConfigDto>> ResetConfig()
    {
        var result = await _fitnessService.UpdateConfigAsync(FitnessConfig.Default);

        _logger.LogInformation("Reset fitness configuration to defaults");

        return Ok(FitnessConfigDto.FromDomain(result));
    }

    #endregion

    #region Leaderboard

    /// <summary>
    /// Get the fitness leaderboard.
    /// </summary>
    [HttpGet("leaderboard")]
    public async Task<ActionResult<IEnumerable<ModelFitnessRankingDto>>> GetLeaderboard(
        [FromQuery] string? taskType = null,
        [FromQuery] int limit = 10)
    {
        var leaderboard = await _fitnessService.GetLeaderboardAsync(taskType, limit);
        return Ok(leaderboard.Select(ModelFitnessRankingDto.FromDomain));
    }

    #endregion

    #region Model Profiles

    /// <summary>
    /// Get all model profiles.
    /// </summary>
    [HttpGet("profiles")]
    public async Task<ActionResult<IEnumerable<ModelProfileDto>>> GetProfiles(
        [FromQuery] string? provider = null)
    {
        IReadOnlyList<ModelProfile> profiles;

        if (!string.IsNullOrEmpty(provider))
        {
            profiles = await _profileRepository.GetByProviderAsync(provider);
        }
        else
        {
            profiles = await _profileRepository.GetAllAsync();
        }

        return Ok(profiles.Select(ModelProfileDto.FromDomain));
    }

    /// <summary>
    /// Get a model profile by ID.
    /// </summary>
    [HttpGet("profiles/{modelId}")]
    public async Task<ActionResult<ModelProfileDto>> GetProfile(string modelId)
    {
        var profile = await _profileRepository.GetAsync(modelId);

        if (profile == null)
        {
            return NotFound($"Model profile {modelId} not found");
        }

        return Ok(ModelProfileDto.FromDomain(profile));
    }

    /// <summary>
    /// Create or update a model profile.
    /// </summary>
    [HttpPut("profiles/{modelId}")]
    public async Task<ActionResult<ModelProfileDto>> UpdateProfile(
        string modelId,
        [FromBody] UpdateModelProfileRequest request)
    {
        var existing = await _profileRepository.GetAsync(modelId);

        ModelProfile profile;
        if (existing != null)
        {
            profile = existing with
            {
                DisplayName = request.DisplayName ?? existing.DisplayName,
                ParametersBillions = request.ParametersBillions ?? existing.ParametersBillions,
                FlopsPerToken = request.FlopsPerToken ?? existing.FlopsPerToken,
                VramGb = request.VramGb ?? existing.VramGb,
                RamGb = request.RamGb ?? existing.RamGb,
                GpuRequirement = request.GpuRequirement ?? existing.GpuRequirement,
                CostPerMillionInputTokens = request.CostPerMillionInputTokens ?? existing.CostPerMillionInputTokens,
                CostPerMillionOutputTokens = request.CostPerMillionOutputTokens ?? existing.CostPerMillionOutputTokens,
                ContextWindowSize = request.ContextWindowSize ?? existing.ContextWindowSize,
                IsLocal = request.IsLocal ?? existing.IsLocal,
                AvgLatencyMsPerToken = request.AvgLatencyMsPerToken ?? existing.AvgLatencyMsPerToken,
                Specializations = request.Specializations ?? existing.Specializations.ToList()
            };
        }
        else
        {
            profile = new ModelProfile
            {
                ModelId = modelId,
                DisplayName = request.DisplayName ?? modelId,
                Provider = "custom",
                ParametersBillions = request.ParametersBillions ?? 7,
                FlopsPerToken = request.FlopsPerToken ?? 7.0e9,
                VramGb = request.VramGb ?? 6,
                RamGb = request.RamGb ?? 16,
                GpuRequirement = request.GpuRequirement ?? 0.5,
                CostPerMillionInputTokens = request.CostPerMillionInputTokens ?? 0,
                CostPerMillionOutputTokens = request.CostPerMillionOutputTokens ?? 0,
                ContextWindowSize = request.ContextWindowSize ?? 8192,
                IsLocal = request.IsLocal ?? true,
                AvgLatencyMsPerToken = request.AvgLatencyMsPerToken ?? 20,
                Specializations = request.Specializations ?? new List<string> { "general" }
            };
        }

        var result = await _profileRepository.SaveAsync(profile);

        _logger.LogInformation("Updated model profile {ModelId}", modelId);

        return Ok(ModelProfileDto.FromDomain(result));
    }

    /// <summary>
    /// Delete a model profile.
    /// </summary>
    [HttpDelete("profiles/{modelId}")]
    public async Task<ActionResult> DeleteProfile(string modelId)
    {
        var existing = await _profileRepository.GetAsync(modelId);

        if (existing == null)
        {
            return NotFound($"Model profile {modelId} not found");
        }

        await _profileRepository.DeleteAsync(modelId);

        _logger.LogInformation("Deleted model profile {ModelId}", modelId);

        return NoContent();
    }

    /// <summary>
    /// Initialize default model profiles.
    /// </summary>
    [HttpPost("profiles/initialize")]
    public async Task<ActionResult> InitializeProfiles()
    {
        await _profileRepository.InitializeDefaultsAsync();

        _logger.LogInformation("Initialized default model profiles");

        return Ok(new { message = "Default profiles initialized" });
    }

    #endregion

    #region Task Entropy

    /// <summary>
    /// Get task entropy for a model.
    /// </summary>
    [HttpGet("entropy/{entityId}")]
    public async Task<ActionResult<TaskEntropyDto>> GetEntropy(
        string entityId,
        [FromQuery] string entityType = "model")
    {
        var entropy = await _entropyRepository.GetAsync(entityId, entityType);

        if (entropy == null)
        {
            return NotFound($"Task entropy for {entityType}:{entityId} not found");
        }

        return Ok(TaskEntropyDto.FromDomain(entropy));
    }

    /// <summary>
    /// Get all task entropy records.
    /// </summary>
    [HttpGet("entropy")]
    public async Task<ActionResult<IEnumerable<TaskEntropyDto>>> GetAllEntropy(
        [FromQuery] string? entityType = null)
    {
        IReadOnlyList<TaskEntropy> entropies;

        if (!string.IsNullOrEmpty(entityType))
        {
            entropies = await _entropyRepository.GetByEntityTypeAsync(entityType);
        }
        else
        {
            entropies = await _entropyRepository.GetAllAsync();
        }

        return Ok(entropies.Select(TaskEntropyDto.FromDomain));
    }

    /// <summary>
    /// Record a task execution (updates entropy).
    /// </summary>
    [HttpPost("entropy/{entityId}/task")]
    public async Task<ActionResult<TaskEntropyDto>> RecordTask(
        string entityId,
        [FromQuery] string taskType,
        [FromQuery] string entityType = "model")
    {
        var entropy = await _entropyRepository.RecordTaskAsync(entityId, entityType, taskType);

        _logger.LogDebug(
            "Recorded task {TaskType} for {EntityType}:{EntityId}",
            taskType, entityType, entityId);

        return Ok(TaskEntropyDto.FromDomain(entropy));
    }

    #endregion
}
