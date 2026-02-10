using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Maestro.Application.Services;

/// <summary>
/// Service interface for block approval operations.
/// </summary>
public interface IBlockApprovalService
{
    /// <summary>
    /// Submits a block for approval.
    /// </summary>
    Task<PendingBlockApproval> SubmitAsync(
        string blockId,
        string? sessionId = null,
        string? submittedBy = null,
        Dictionary<string, object>? metadata = null,
        CancellationToken ct = default);

    /// <summary>
    /// Gets all pending approvals.
    /// </summary>
    Task<IEnumerable<PendingBlockApproval>> GetPendingAsync(CancellationToken ct = default);

    /// <summary>
    /// Gets an approval by ID.
    /// </summary>
    Task<PendingBlockApproval?> GetAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Approves a block for publication.
    /// </summary>
    Task<PendingBlockApproval> ApproveAsync(
        string id,
        string? reviewedBy = null,
        CancellationToken ct = default);

    /// <summary>
    /// Rejects a block with a reason.
    /// </summary>
    Task<PendingBlockApproval> RejectAsync(
        string id,
        string reason,
        string? reviewedBy = null,
        CancellationToken ct = default);
}

/// <summary>
/// Implementation of the block approval service.
/// </summary>
public class BlockApprovalService : IBlockApprovalService
{
    private readonly IBlockApprovalRepository _approvalRepository;
    private readonly IBlockRepository _blockRepository;
    private readonly IBlockPublisher _publisher;
    private readonly ILogger<BlockApprovalService> _logger;

    public BlockApprovalService(
        IBlockApprovalRepository approvalRepository,
        IBlockRepository blockRepository,
        IBlockPublisher publisher,
        ILogger<BlockApprovalService> logger)
    {
        _approvalRepository = approvalRepository;
        _blockRepository = blockRepository;
        _publisher = publisher;
        _logger = logger;
    }

    public async Task<PendingBlockApproval> SubmitAsync(
        string blockId,
        string? sessionId = null,
        string? submittedBy = null,
        Dictionary<string, object>? metadata = null,
        CancellationToken ct = default)
    {
        // Get the block
        var block = await _blockRepository.GetByIdAsync(blockId, ct);
        if (block == null)
        {
            throw new InvalidOperationException($"Block '{blockId}' not found");
        }

        // Create the approval
        var approval = PendingBlockApproval.Create(
            blockId: block.Id,
            blockName: block.Name,
            blockType: block.BlockType.ToString(),
            blockDefinition: block,
            sourceSessionId: sessionId,
            submittedBy: submittedBy,
            metadata: metadata);

        // Save it
        await _approvalRepository.SaveAsync(approval, ct);

        _logger.LogInformation(
            "Block '{BlockId}' submitted for approval as {ApprovalId}",
            blockId, approval.Id);

        return approval;
    }

    public async Task<IEnumerable<PendingBlockApproval>> GetPendingAsync(CancellationToken ct = default)
    {
        return await _approvalRepository.GetPendingAsync(ct);
    }

    public async Task<PendingBlockApproval?> GetAsync(string id, CancellationToken ct = default)
    {
        return await _approvalRepository.GetByIdAsync(id, ct);
    }

    public async Task<PendingBlockApproval> ApproveAsync(
        string id,
        string? reviewedBy = null,
        CancellationToken ct = default)
    {
        var approval = await _approvalRepository.GetByIdAsync(id, ct);
        if (approval == null)
        {
            throw new InvalidOperationException($"Approval '{id}' not found");
        }

        approval.Approve(reviewedBy);
        await _approvalRepository.SaveAsync(approval, ct);

        // Publish the approved block to the user catalog
        try
        {
            var manifest = await _publisher.PublishBlockAsync(
                approval.BlockId,
                approval.BlockName,
                approval.BlockType,
                approval.SubmittedBy,
                approval.Metadata.Count > 0 ? approval.Metadata : null,
                ct);

            _logger.LogInformation(
                "Block '{BlockId}' approved and published (approval: {ApprovalId}, version: {Version})",
                approval.BlockId, approval.Id, manifest.Version);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Block '{BlockId}' approved (approval: {ApprovalId}) but publishing failed",
                approval.BlockId, approval.Id);
            throw;
        }

        return approval;
    }

    public async Task<PendingBlockApproval> RejectAsync(
        string id,
        string reason,
        string? reviewedBy = null,
        CancellationToken ct = default)
    {
        var approval = await _approvalRepository.GetByIdAsync(id, ct);
        if (approval == null)
        {
            throw new InvalidOperationException($"Approval '{id}' not found");
        }

        approval.Reject(reason, reviewedBy);
        await _approvalRepository.SaveAsync(approval, ct);

        // TODO: Store rejection reason in the source session's repo
        _logger.LogInformation(
            "Block '{BlockId}' rejected (approval: {ApprovalId}): {Reason}",
            approval.BlockId, approval.Id, reason);

        return approval;
    }
}
