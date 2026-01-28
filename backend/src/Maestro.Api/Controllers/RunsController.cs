using Microsoft.AspNetCore.Mvc;
using Maestro.Infrastructure.Runs;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for viewing and managing execution runs.
/// Provides full traceability of agent/workflow executions.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class RunsController : ControllerBase
{
    private readonly RunTracker _runTracker;

    public RunsController(RunTracker runTracker)
    {
        _runTracker = runTracker;
    }

    /// <summary>
    /// List all runs, optionally filtered by project.
    /// If projectPath is provided, lists runs from that project's .maestro/runs folder.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<RunSummary>>> ListRuns(
        [FromQuery] string? projectId = null,
        [FromQuery] string? projectPath = null,
        [FromQuery] string? status = null,
        [FromQuery] int limit = 50)
    {
        // Use wildcard to get all runs from the specified path
        var runs = await _runTracker.ListRunsAsync(projectId ?? "*", projectPath);

        // Filter by status if provided
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<RunStatus>(status, true, out var statusFilter))
        {
            runs = runs.Where(r => r.Status == statusFilter).ToList();
        }

        // Convert to summaries and apply limit
        var summaries = runs
            .OrderByDescending(r => r.StartedAt)
            .Take(limit)
            .Select(r => new RunSummary
            {
                Id = r.Id,
                ProjectId = r.ProjectId,
                BlockId = r.BlockId,
                BlockType = r.BlockType,
                Status = r.Status.ToString(),
                StartedAt = r.StartedAt,
                CompletedAt = r.CompletedAt,
                DurationMs = r.DurationMs,
                OverallScore = r.Scores?.Overall,
                ArtifactCount = r.Artifacts.Count,
                ErrorCount = r.Errors.Count,
                StepCount = r.Steps.Count
            })
            .ToList();

        return Ok(summaries);
    }

    /// <summary>
    /// Get detailed information about a specific run.
    /// </summary>
    [HttpGet("{runId}")]
    public async Task<ActionResult<RunRecord>> GetRun(string runId, [FromQuery] string? projectPath = null)
    {
        var run = await _runTracker.GetRunAsync(runId, projectPath);
        if (run == null)
        {
            return NotFound(new { error = $"Run '{runId}' not found" });
        }

        return Ok(run);
    }

    /// <summary>
    /// Get all steps for a run (for detailed execution tracing).
    /// </summary>
    [HttpGet("{runId}/steps")]
    public async Task<ActionResult<List<RunStep>>> GetRunSteps(string runId, [FromQuery] string? projectPath = null)
    {
        var run = await _runTracker.GetRunAsync(runId, projectPath);
        if (run == null)
        {
            return NotFound(new { error = $"Run '{runId}' not found" });
        }

        return Ok(run.Steps);
    }

    /// <summary>
    /// Get all decisions made during a run.
    /// </summary>
    [HttpGet("{runId}/decisions")]
    public async Task<ActionResult<List<RunDecision>>> GetRunDecisions(string runId, [FromQuery] string? projectPath = null)
    {
        var run = await _runTracker.GetRunAsync(runId, projectPath);
        if (run == null)
        {
            return NotFound(new { error = $"Run '{runId}' not found" });
        }

        return Ok(run.Decisions);
    }

    /// <summary>
    /// Get all artifacts (files) created/modified during a run.
    /// </summary>
    [HttpGet("{runId}/artifacts")]
    public async Task<ActionResult<List<RunArtifact>>> GetRunArtifacts(string runId, [FromQuery] string? projectPath = null)
    {
        var run = await _runTracker.GetRunAsync(runId, projectPath);
        if (run == null)
        {
            return NotFound(new { error = $"Run '{runId}' not found" });
        }

        return Ok(run.Artifacts);
    }

    /// <summary>
    /// Get pending proposals that need approval.
    /// </summary>
    [HttpGet("{runId}/proposals")]
    public async Task<ActionResult<List<RunStep>>> GetPendingProposals(string runId, [FromQuery] string? projectPath = null)
    {
        var run = await _runTracker.GetRunAsync(runId, projectPath);
        if (run == null)
        {
            return NotFound(new { error = $"Run '{runId}' not found" });
        }

        var pendingProposals = run.Steps
            .Where(s => s.Proposal != null && s.Approved == null)
            .ToList();

        return Ok(pendingProposals);
    }

    /// <summary>
    /// Approve or reject a proposal.
    /// </summary>
    [HttpPost("{runId}/proposals/{stepId}/approve")]
    public async Task<IActionResult> ApproveProposal(
        string runId,
        string stepId,
        [FromBody] ApprovalRequest request,
        [FromQuery] string? projectPath = null)
    {
        var run = await _runTracker.GetRunAsync(runId, projectPath);
        if (run == null)
        {
            return NotFound(new { error = $"Run '{runId}' not found" });
        }

        await _runTracker.RecordApprovalAsync(run, stepId, request.Approved, request.ApprovedBy ?? "user", projectPath);

        return Ok(new { message = request.Approved ? "Proposal approved" : "Proposal rejected" });
    }

    /// <summary>
    /// Cancel a running execution.
    /// </summary>
    [HttpPost("{runId}/cancel")]
    public async Task<IActionResult> CancelRun(string runId, [FromQuery] string? projectPath = null)
    {
        var run = await _runTracker.GetRunAsync(runId, projectPath);
        if (run == null)
        {
            return NotFound(new { error = $"Run '{runId}' not found" });
        }

        if (run.Status != RunStatus.Running && run.Status != RunStatus.Paused)
        {
            return BadRequest(new { error = "Can only cancel running or paused runs" });
        }

        await _runTracker.CompleteRunAsync(run, RunStatus.Cancelled, null, null, projectPath);

        return Ok(new { message = "Run cancelled" });
    }
}

/// <summary>
/// Summary view of a run (for list views).
/// </summary>
public class RunSummary
{
    public string Id { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string BlockId { get; set; } = string.Empty;
    public string BlockType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public long DurationMs { get; set; }
    public int? OverallScore { get; set; }
    public int ArtifactCount { get; set; }
    public int ErrorCount { get; set; }
    public int StepCount { get; set; }
}

/// <summary>
/// Request model for approving/rejecting proposals.
/// </summary>
public class ApprovalRequest
{
    public bool Approved { get; set; }
    public string? ApprovedBy { get; set; }
}
