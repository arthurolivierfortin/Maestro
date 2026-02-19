using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;

namespace Maestro.Api.Controllers;

/// <summary>
/// Controller for research team operations.
/// </summary>
[ApiController]
[Route("api/research")]
public class ResearchTeamController : ControllerBase
{
    private readonly IResearchTeamService _researchService;
    private readonly ILogger<ResearchTeamController> _logger;

    public ResearchTeamController(
        IResearchTeamService researchService,
        ILogger<ResearchTeamController> logger)
    {
        _researchService = researchService;
        _logger = logger;
    }

    /// <summary>
    /// Start a research cycle for an agent.
    /// </summary>
    [HttpPost("cycles")]
    public async Task<ActionResult<ResearchCycleResult>> StartCycle(
        [FromBody] StartResearchCycleRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.AgentId))
        {
            return BadRequest(new { error = "Agent ID is required" });
        }

        try
        {
            var cycleRequest = new ResearchCycleRequest
            {
                AgentId = request.AgentId,
                ImprovementGoal = request.ImprovementGoal,
                FitnessTarget = request.FitnessTarget ?? 0.85,
                MaxIterations = request.MaxIterations ?? 50,
                MaxCycles = request.MaxCycles ?? 3,
                AutoPublish = request.AutoPublish ?? false,
                WorkspaceId = request.WorkspaceId
            };

            var result = await _researchService.StartResearchCycleAsync(cycleRequest, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start research cycle for agent {AgentId}", request.AgentId);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get status of a running research cycle.
    /// </summary>
    [HttpGet("cycles/{cycleId}/status")]
    public async Task<ActionResult<ResearchCycleStatus>> GetCycleStatus(
        string cycleId,
        CancellationToken ct)
    {
        try
        {
            var status = await _researchService.GetCycleStatusAsync(cycleId, ct);
            return Ok(status);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = $"Research cycle '{cycleId}' not found" });
        }
    }

    /// <summary>
    /// Stop a running research cycle.
    /// </summary>
    [HttpPost("cycles/{cycleId}/stop")]
    public async Task<ActionResult> StopCycle(string cycleId, CancellationToken ct)
    {
        try
        {
            await _researchService.StopCycleAsync(cycleId, ct);
            return Ok(new { message = $"Research cycle '{cycleId}' stopped" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to stop research cycle {CycleId}", cycleId);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get research history.
    /// </summary>
    [HttpGet("history")]
    public async Task<ActionResult<IEnumerable<ResearchCycleResult>>> GetHistory(
        [FromQuery] string? agentId = null,
        [FromQuery] int limit = 20,
        CancellationToken ct = default)
    {
        var history = await _researchService.GetHistoryAsync(agentId, limit, ct);
        return Ok(history);
    }

    /// <summary>
    /// Get pending improvement proposals.
    /// </summary>
    [HttpGet("proposals")]
    public async Task<ActionResult<IEnumerable<ResearchProposal>>> GetPendingProposals(
        [FromQuery] string? agentId = null,
        CancellationToken ct = default)
    {
        var proposals = await _researchService.GetPendingProposalsAsync(agentId, ct);
        return Ok(proposals);
    }

    /// <summary>
    /// Approve a research proposal.
    /// </summary>
    [HttpPost("proposals/{proposalId}/approve")]
    public async Task<ActionResult> ApproveProposal(
        string proposalId,
        [FromBody] ApproveProposalRequest? request = null,
        CancellationToken ct = default)
    {
        var success = await _researchService.ApproveProposalAsync(
            proposalId,
            request?.ApprovedBy,
            ct);

        if (success)
        {
            return Ok(new { message = $"Proposal '{proposalId}' approved" });
        }
        else
        {
            return NotFound(new { error = $"Proposal '{proposalId}' not found" });
        }
    }

    /// <summary>
    /// Reject a research proposal.
    /// </summary>
    [HttpPost("proposals/{proposalId}/reject")]
    public async Task<ActionResult> RejectProposal(
        string proposalId,
        [FromBody] RejectProposalRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { error = "Rejection reason is required" });
        }

        var success = await _researchService.RejectProposalAsync(
            proposalId,
            request.Reason,
            request.RejectedBy,
            ct);

        if (success)
        {
            return Ok(new { message = $"Proposal '{proposalId}' rejected" });
        }
        else
        {
            return NotFound(new { error = $"Proposal '{proposalId}' not found" });
        }
    }

    /// <summary>
    /// Get research team configuration.
    /// </summary>
    [HttpGet("config")]
    public async Task<ActionResult<ResearchTeamConfig>> GetConfig(CancellationToken ct)
    {
        var config = await _researchService.GetConfigAsync(ct);
        return Ok(config);
    }

    /// <summary>
    /// Update research team configuration.
    /// </summary>
    [HttpPut("config")]
    public async Task<ActionResult<ResearchTeamConfig>> UpdateConfig(
        [FromBody] UpdateResearchConfigRequest request,
        CancellationToken ct)
    {
        var update = new ResearchTeamConfigUpdate
        {
            Enabled = request.Enabled,
            FitnessThreshold = request.FitnessThreshold,
            DefaultMaxIterations = request.DefaultMaxIterations,
            DefaultMaxCycles = request.DefaultMaxCycles,
            AutoApproveProposals = request.AutoApproveProposals,
            AutoApproveMinConfidence = request.AutoApproveMinConfidence,
            AutoPublishOnSuccess = request.AutoPublishOnSuccess,
            CycleTimeoutMinutes = request.CycleTimeoutMinutes
        };

        var config = await _researchService.UpdateConfigAsync(update, ct);
        return Ok(config);
    }
}

public class StartResearchCycleRequest
{
    public string AgentId { get; set; } = string.Empty;
    public string? ImprovementGoal { get; set; }
    public double? FitnessTarget { get; set; }
    public int? MaxIterations { get; set; }
    public int? MaxCycles { get; set; }
    public bool? AutoPublish { get; set; }
    public string? WorkspaceId { get; set; }
}

public class ApproveProposalRequest
{
    public string? ApprovedBy { get; set; }
}

public class RejectProposalRequest
{
    public string Reason { get; set; } = string.Empty;
    public string? RejectedBy { get; set; }
}

public class UpdateResearchConfigRequest
{
    public bool? Enabled { get; set; }
    public double? FitnessThreshold { get; set; }
    public int? DefaultMaxIterations { get; set; }
    public int? DefaultMaxCycles { get; set; }
    public bool? AutoApproveProposals { get; set; }
    public double? AutoApproveMinConfidence { get; set; }
    public bool? AutoPublishOnSuccess { get; set; }
    public int? CycleTimeoutMinutes { get; set; }
}
