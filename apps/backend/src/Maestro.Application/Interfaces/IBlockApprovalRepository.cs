using Maestro.Domain.Entities;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository interface for pending block approvals.
/// </summary>
public interface IBlockApprovalRepository
{
    /// <summary>
    /// Gets an approval by ID.
    /// </summary>
    Task<PendingBlockApproval?> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Gets all pending approvals.
    /// </summary>
    Task<IEnumerable<PendingBlockApproval>> GetPendingAsync(CancellationToken ct = default);

    /// <summary>
    /// Gets all approvals with optional filtering.
    /// </summary>
    Task<IEnumerable<PendingBlockApproval>> GetAllAsync(
        ApprovalStatus? status = null,
        string? sessionId = null,
        int? limit = null,
        CancellationToken ct = default);

    /// <summary>
    /// Saves an approval.
    /// </summary>
    Task SaveAsync(PendingBlockApproval approval, CancellationToken ct = default);

    /// <summary>
    /// Deletes an approval.
    /// </summary>
    Task DeleteAsync(string id, CancellationToken ct = default);
}
