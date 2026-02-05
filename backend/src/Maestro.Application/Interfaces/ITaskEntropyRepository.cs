using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository for task entropy data used in fitness calculations.
/// </summary>
public interface ITaskEntropyRepository
{
    /// <summary>
    /// Get task entropy for an entity (model or agent).
    /// </summary>
    Task<TaskEntropy?> GetAsync(string entityId, string entityType = "model", CancellationToken ct = default);

    /// <summary>
    /// Get all task entropy records.
    /// </summary>
    Task<IReadOnlyList<TaskEntropy>> GetAllAsync(CancellationToken ct = default);

    /// <summary>
    /// Get task entropy records by entity type.
    /// </summary>
    Task<IReadOnlyList<TaskEntropy>> GetByEntityTypeAsync(string entityType, CancellationToken ct = default);

    /// <summary>
    /// Save or update task entropy.
    /// </summary>
    Task<TaskEntropy> SaveAsync(TaskEntropy entropy, CancellationToken ct = default);

    /// <summary>
    /// Delete task entropy record.
    /// </summary>
    Task DeleteAsync(string entityId, string entityType = "model", CancellationToken ct = default);

    /// <summary>
    /// Record a task execution (updates entropy incrementally).
    /// </summary>
    Task<TaskEntropy> RecordTaskAsync(
        string entityId,
        string entityType,
        string taskType,
        CancellationToken ct = default);

    /// <summary>
    /// Get or create entropy for an entity (creates empty if not found).
    /// </summary>
    Task<TaskEntropy> GetOrCreateAsync(
        string entityId,
        string entityType = "model",
        CancellationToken ct = default);
}
