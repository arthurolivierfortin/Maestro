using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;

namespace Maestro.Api.Controllers;

/// <summary>
/// Controller for orchestrator operations.
/// </summary>
[ApiController]
[Route("api/orchestrator")]
public class OrchestratorController : ControllerBase
{
    private readonly IOrchestratorService _orchestratorService;
    private readonly ILogger<OrchestratorController> _logger;

    public OrchestratorController(
        IOrchestratorService orchestratorService,
        ILogger<OrchestratorController> logger)
    {
        _orchestratorService = orchestratorService;
        _logger = logger;
    }

    /// <summary>
    /// Get orchestrator status.
    /// </summary>
    [HttpGet("status")]
    public async Task<ActionResult<OrchestratorStatus>> GetStatus(CancellationToken ct)
    {
        var status = await _orchestratorService.GetStatusAsync(ct);
        return Ok(status);
    }

    /// <summary>
    /// Get pending promotions.
    /// </summary>
    [HttpGet("pending")]
    public async Task<ActionResult<IEnumerable<PendingPromotion>>> GetPendingPromotions(CancellationToken ct)
    {
        var pending = await _orchestratorService.GetPendingPromotionsAsync(ct);
        return Ok(pending);
    }

    /// <summary>
    /// Promote an agent between workspaces.
    /// </summary>
    [HttpPost("promote")]
    public async Task<ActionResult<PromotionRecord>> PromoteAgent(
        [FromBody] PromoteAgentOrchestratorRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.AgentId))
        {
            return BadRequest(new { error = "Agent ID is required" });
        }

        if (string.IsNullOrWhiteSpace(request.FromWorkspace))
        {
            return BadRequest(new { error = "Source workspace is required" });
        }

        if (string.IsNullOrWhiteSpace(request.ToWorkspace))
        {
            return BadRequest(new { error = "Target workspace is required" });
        }

        try
        {
            var result = await _orchestratorService.PromoteAgentAsync(
                request.AgentId,
                request.FromWorkspace,
                request.ToWorkspace,
                request.Force,
                ct);

            if (result.Success)
            {
                return Ok(result);
            }
            else
            {
                return BadRequest(result);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to promote agent {AgentId}", request.AgentId);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Rollback an agent to a previous version.
    /// </summary>
    [HttpPost("rollback")]
    public async Task<ActionResult<RollbackRecord>> RollbackAgent(
        [FromBody] RollbackAgentRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.AgentId))
        {
            return BadRequest(new { error = "Agent ID is required" });
        }

        if (string.IsNullOrWhiteSpace(request.WorkspaceId))
        {
            return BadRequest(new { error = "Workspace ID is required" });
        }

        try
        {
            var result = await _orchestratorService.RollbackAgentAsync(
                request.AgentId,
                request.WorkspaceId,
                request.ToVersion,
                ct);

            if (result.Success)
            {
                return Ok(result);
            }
            else
            {
                return BadRequest(result);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to rollback agent {AgentId}", request.AgentId);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get promotion/rollback history.
    /// </summary>
    [HttpGet("history")]
    public async Task<ActionResult<IEnumerable<PromotionRecord>>> GetHistory(
        [FromQuery] string? workspaceId = null,
        [FromQuery] string? agentId = null,
        [FromQuery] int limit = 20,
        CancellationToken ct = default)
    {
        var history = await _orchestratorService.GetHistoryAsync(workspaceId, agentId, limit, ct);
        return Ok(history);
    }

    /// <summary>
    /// Get orchestrator configuration.
    /// </summary>
    [HttpGet("config")]
    public async Task<ActionResult<OrchestratorConfig>> GetConfig(CancellationToken ct)
    {
        var config = await _orchestratorService.GetConfigAsync(ct);
        return Ok(config);
    }

    /// <summary>
    /// Update orchestrator configuration.
    /// </summary>
    [HttpPut("config")]
    public async Task<ActionResult<OrchestratorConfig>> UpdateConfig(
        [FromBody] OrchestratorConfigUpdateRequest request,
        CancellationToken ct)
    {
        var update = new OrchestratorConfigUpdate
        {
            AutoPromotionEnabled = request.AutoPromotionEnabled,
            MonitoringInterval = request.MonitoringIntervalMinutes.HasValue
                ? TimeSpan.FromMinutes(request.MonitoringIntervalMinutes.Value)
                : null,
            MinFitnessResearchToStaging = request.MinFitnessResearchToStaging,
            MinFitnessStagingToProduction = request.MinFitnessStagingToProduction,
            FitnessDropThreshold = request.FitnessDropThreshold,
            ErrorRateThreshold = request.ErrorRateThreshold,
            AutoRollback = request.AutoRollback
        };

        var config = await _orchestratorService.UpdateConfigAsync(update, ct);
        return Ok(config);
    }

    /// <summary>
    /// Enable or disable auto-promotion.
    /// </summary>
    [HttpPost("auto-promote")]
    public async Task<ActionResult> SetAutoPromotion(
        [FromBody] SetAutoPromotionRequest request,
        CancellationToken ct)
    {
        await _orchestratorService.SetAutoPromotionAsync(request.Enabled, ct);
        return Ok(new { message = $"Auto-promotion {(request.Enabled ? "enabled" : "disabled")}" });
    }

    /// <summary>
    /// Run a monitoring cycle manually.
    /// </summary>
    [HttpPost("monitor")]
    public async Task<ActionResult<MonitoringResult>> RunMonitoringCycle(CancellationToken ct)
    {
        var result = await _orchestratorService.RunMonitoringCycleAsync(ct);
        return Ok(result);
    }
}

public class PromoteAgentOrchestratorRequest
{
    public string AgentId { get; set; } = string.Empty;
    public string FromWorkspace { get; set; } = string.Empty;
    public string ToWorkspace { get; set; } = string.Empty;
    public bool Force { get; set; }
}

public class RollbackAgentRequest
{
    public string AgentId { get; set; } = string.Empty;
    public string WorkspaceId { get; set; } = string.Empty;
    public string? ToVersion { get; set; }
}

public class OrchestratorConfigUpdateRequest
{
    public bool? AutoPromotionEnabled { get; set; }
    public int? MonitoringIntervalMinutes { get; set; }
    public double? MinFitnessResearchToStaging { get; set; }
    public double? MinFitnessStagingToProduction { get; set; }
    public double? FitnessDropThreshold { get; set; }
    public double? ErrorRateThreshold { get; set; }
    public bool? AutoRollback { get; set; }
}

public class SetAutoPromotionRequest
{
    public bool Enabled { get; set; }
}
