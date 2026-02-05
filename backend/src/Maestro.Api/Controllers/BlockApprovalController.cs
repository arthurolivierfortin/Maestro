using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Services;
using Maestro.Domain.Entities;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for block approval operations.
/// Provides endpoints for submitting, reviewing, and managing block approvals.
/// </summary>
[ApiController]
[Route("api/approvals")]
public class BlockApprovalController : ControllerBase
{
    private readonly IBlockApprovalService _approvalService;
    private readonly ILogger<BlockApprovalController> _logger;

    public BlockApprovalController(
        IBlockApprovalService approvalService,
        ILogger<BlockApprovalController> logger)
    {
        _approvalService = approvalService;
        _logger = logger;
    }

    /// <summary>
    /// Get all pending approvals.
    /// </summary>
    [HttpGet]
    [HttpGet("pending")]
    public async Task<ActionResult<List<PendingBlockApprovalDto>>> GetPending()
    {
        var approvals = await _approvalService.GetPendingAsync();
        var dtos = approvals.Select(PendingBlockApprovalDto.FromDomain).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Get an approval by ID.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<PendingBlockApprovalDto>> GetById(string id)
    {
        var approval = await _approvalService.GetAsync(id);

        if (approval == null)
            return NotFound(new { error = $"Approval '{id}' not found" });

        return Ok(PendingBlockApprovalDto.FromDomain(approval));
    }

    /// <summary>
    /// Submit a block for approval.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<PendingBlockApprovalDto>> Submit([FromBody] SubmitApprovalRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.BlockId))
            return BadRequest(new { error = "BlockId is required" });

        try
        {
            var approval = await _approvalService.SubmitAsync(
                blockId: request.BlockId,
                sessionId: request.SessionId,
                submittedBy: request.SubmittedBy,
                metadata: request.Metadata);

            _logger.LogInformation(
                "Block '{BlockId}' submitted for approval as {ApprovalId}",
                request.BlockId, approval.Id);

            return CreatedAtAction(
                nameof(GetById),
                new { id = approval.Id },
                PendingBlockApprovalDto.FromDomain(approval));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to submit block for approval");
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Approve a pending block.
    /// </summary>
    [HttpPost("{id}/approve")]
    public async Task<ActionResult<PendingBlockApprovalDto>> Approve(string id, [FromBody] ReviewRequest? request = null)
    {
        try
        {
            var approval = await _approvalService.ApproveAsync(id, request?.ReviewedBy);

            _logger.LogInformation("Approval '{ApprovalId}' approved", id);

            return Ok(PendingBlockApprovalDto.FromDomain(approval));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to approve {ApprovalId}", id);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Reject a pending block.
    /// </summary>
    [HttpPost("{id}/reject")]
    public async Task<ActionResult<PendingBlockApprovalDto>> Reject(string id, [FromBody] RejectRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest(new { error = "Rejection reason is required" });

        try
        {
            var approval = await _approvalService.RejectAsync(id, request.Reason, request.ReviewedBy);

            _logger.LogInformation("Approval '{ApprovalId}' rejected: {Reason}", id, request.Reason);

            return Ok(PendingBlockApprovalDto.FromDomain(approval));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Failed to reject {ApprovalId}", id);
            return BadRequest(new { error = ex.Message });
        }
    }
}

/// <summary>
/// DTO for pending block approval.
/// </summary>
public record PendingBlockApprovalDto
{
    public string Id { get; init; } = string.Empty;
    public string BlockId { get; init; } = string.Empty;
    public string BlockName { get; init; } = string.Empty;
    public string BlockType { get; init; } = string.Empty;
    public string? SourceSessionId { get; init; }
    public string Status { get; init; } = "pending";
    public string? RejectionReason { get; init; }
    public Dictionary<string, object> Metadata { get; init; } = new();
    public DateTimeOffset SubmittedAt { get; init; }
    public string? SubmittedBy { get; init; }
    public DateTimeOffset? ReviewedAt { get; init; }
    public string? ReviewedBy { get; init; }

    public static PendingBlockApprovalDto FromDomain(PendingBlockApproval approval)
    {
        return new PendingBlockApprovalDto
        {
            Id = approval.Id,
            BlockId = approval.BlockId,
            BlockName = approval.BlockName,
            BlockType = approval.BlockType,
            SourceSessionId = approval.SourceSessionId,
            Status = approval.Status.ToString().ToLowerInvariant(),
            RejectionReason = approval.RejectionReason,
            Metadata = new Dictionary<string, object>(approval.Metadata),
            SubmittedAt = approval.SubmittedAt,
            SubmittedBy = approval.SubmittedBy,
            ReviewedAt = approval.ReviewedAt,
            ReviewedBy = approval.ReviewedBy
        };
    }
}

/// <summary>
/// Request to submit a block for approval.
/// </summary>
public record SubmitApprovalRequest
{
    public required string BlockId { get; init; }
    public string? SessionId { get; init; }
    public string? SubmittedBy { get; init; }
    public Dictionary<string, object>? Metadata { get; init; }
}

/// <summary>
/// Request to review (approve) an approval.
/// </summary>
public record ReviewRequest
{
    public string? ReviewedBy { get; init; }
}

/// <summary>
/// Request to reject an approval.
/// </summary>
public record RejectRequest
{
    public required string Reason { get; init; }
    public string? ReviewedBy { get; init; }
}
