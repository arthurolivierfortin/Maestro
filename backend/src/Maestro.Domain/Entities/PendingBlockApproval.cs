namespace Maestro.Domain.Entities;

/// <summary>
/// Status of a pending block approval.
/// </summary>
public enum ApprovalStatus
{
    /// <summary>Block is awaiting review.</summary>
    Pending,
    /// <summary>Block has been approved.</summary>
    Approved,
    /// <summary>Block has been rejected.</summary>
    Rejected
}

/// <summary>
/// Represents a block submitted for approval before publication.
/// This is a generic approval workflow usable by any session.
/// </summary>
public class PendingBlockApproval
{
    /// <summary>
    /// Unique identifier for this approval request.
    /// </summary>
    public string Id { get; private set; } = string.Empty;

    /// <summary>
    /// ID of the block being submitted.
    /// </summary>
    public string BlockId { get; private set; } = string.Empty;

    /// <summary>
    /// Name of the block.
    /// </summary>
    public string BlockName { get; private set; } = string.Empty;

    /// <summary>
    /// Type of the block (workflow, tool, agent, etc.).
    /// </summary>
    public string BlockType { get; private set; } = string.Empty;

    /// <summary>
    /// The complete block definition.
    /// </summary>
    public BlockDefinition? BlockDefinition { get; private set; }

    /// <summary>
    /// ID of the session that submitted this block.
    /// </summary>
    public string? SourceSessionId { get; private set; }

    /// <summary>
    /// Current approval status.
    /// </summary>
    public ApprovalStatus Status { get; private set; } = ApprovalStatus.Pending;

    /// <summary>
    /// Reason for rejection (if rejected).
    /// </summary>
    public string? RejectionReason { get; private set; }

    /// <summary>
    /// Additional metadata about the submission.
    /// </summary>
    public Dictionary<string, object> Metadata { get; private set; } = new();

    /// <summary>
    /// When the block was submitted for approval.
    /// </summary>
    public DateTimeOffset SubmittedAt { get; private set; }

    /// <summary>
    /// Who submitted the block (user/agent ID).
    /// </summary>
    public string? SubmittedBy { get; private set; }

    /// <summary>
    /// When the block was reviewed (approved or rejected).
    /// </summary>
    public DateTimeOffset? ReviewedAt { get; private set; }

    /// <summary>
    /// Who reviewed the block (user ID).
    /// </summary>
    public string? ReviewedBy { get; private set; }

    /// <summary>
    /// Private constructor for factory methods.
    /// </summary>
    private PendingBlockApproval() { }

    /// <summary>
    /// Creates a new pending approval.
    /// </summary>
    public static PendingBlockApproval Create(
        string blockId,
        string blockName,
        string blockType,
        BlockDefinition? blockDefinition = null,
        string? sourceSessionId = null,
        string? submittedBy = null,
        Dictionary<string, object>? metadata = null)
    {
        return new PendingBlockApproval
        {
            Id = Guid.NewGuid().ToString(),
            BlockId = blockId,
            BlockName = blockName,
            BlockType = blockType,
            BlockDefinition = blockDefinition,
            SourceSessionId = sourceSessionId,
            SubmittedBy = submittedBy,
            Status = ApprovalStatus.Pending,
            Metadata = metadata ?? new Dictionary<string, object>(),
            SubmittedAt = DateTimeOffset.UtcNow
        };
    }

    /// <summary>
    /// Reconstitutes an approval from storage.
    /// </summary>
    public static PendingBlockApproval Reconstitute(
        string id,
        string blockId,
        string blockName,
        string blockType,
        BlockDefinition? blockDefinition,
        string? sourceSessionId,
        ApprovalStatus status,
        string? rejectionReason,
        Dictionary<string, object> metadata,
        DateTimeOffset submittedAt,
        string? submittedBy,
        DateTimeOffset? reviewedAt,
        string? reviewedBy)
    {
        return new PendingBlockApproval
        {
            Id = id,
            BlockId = blockId,
            BlockName = blockName,
            BlockType = blockType,
            BlockDefinition = blockDefinition,
            SourceSessionId = sourceSessionId,
            Status = status,
            RejectionReason = rejectionReason,
            Metadata = metadata,
            SubmittedAt = submittedAt,
            SubmittedBy = submittedBy,
            ReviewedAt = reviewedAt,
            ReviewedBy = reviewedBy
        };
    }

    /// <summary>
    /// Approves this block for publication.
    /// </summary>
    /// <param name="reviewedBy">Who approved the block.</param>
    public void Approve(string? reviewedBy = null)
    {
        if (Status != ApprovalStatus.Pending)
            throw new InvalidOperationException($"Cannot approve a block that is already {Status}");

        Status = ApprovalStatus.Approved;
        ReviewedAt = DateTimeOffset.UtcNow;
        ReviewedBy = reviewedBy;
    }

    /// <summary>
    /// Rejects this block with a reason.
    /// </summary>
    /// <param name="reason">The reason for rejection.</param>
    /// <param name="reviewedBy">Who rejected the block.</param>
    public void Reject(string reason, string? reviewedBy = null)
    {
        if (Status != ApprovalStatus.Pending)
            throw new InvalidOperationException($"Cannot reject a block that is already {Status}");

        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Rejection reason is required", nameof(reason));

        Status = ApprovalStatus.Rejected;
        RejectionReason = reason;
        ReviewedAt = DateTimeOffset.UtcNow;
        ReviewedBy = reviewedBy;
    }

    /// <summary>
    /// Whether this approval is still pending.
    /// </summary>
    public bool IsPending => Status == ApprovalStatus.Pending;

    /// <summary>
    /// Whether this approval was approved.
    /// </summary>
    public bool IsApproved => Status == ApprovalStatus.Approved;

    /// <summary>
    /// Whether this approval was rejected.
    /// </summary>
    public bool IsRejected => Status == ApprovalStatus.Rejected;
}
