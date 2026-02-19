using Maestro.Domain.Entities;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository for training configurations.
/// </summary>
public interface ITrainingConfigurationRepository
{
    /// <summary>
    /// Save a training configuration.
    /// </summary>
    Task SaveAsync(TrainingConfiguration config, CancellationToken ct = default);

    /// <summary>
    /// Get a training configuration by ID.
    /// </summary>
    Task<TrainingConfiguration?> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Get all training configurations.
    /// </summary>
    Task<IReadOnlyList<TrainingConfiguration>> GetAllAsync(CancellationToken ct = default);

    /// <summary>
    /// Get configurations for a specific workflow.
    /// </summary>
    Task<IReadOnlyList<TrainingConfiguration>> GetByWorkflowIdAsync(string workflowId, CancellationToken ct = default);

    /// <summary>
    /// Delete a training configuration.
    /// </summary>
    Task DeleteAsync(string id, CancellationToken ct = default);
}

/// <summary>
/// Repository for training runs.
/// </summary>
public interface ITrainingRunRepository
{
    /// <summary>
    /// Save a training run.
    /// </summary>
    Task SaveAsync(TrainingRun run, CancellationToken ct = default);

    /// <summary>
    /// Get a training run by ID.
    /// </summary>
    Task<TrainingRun?> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Get all training runs.
    /// </summary>
    Task<IReadOnlyList<TrainingRun>> GetAllAsync(int? limit = null, int? offset = null, CancellationToken ct = default);

    /// <summary>
    /// Get runs for a specific configuration.
    /// </summary>
    Task<IReadOnlyList<TrainingRun>> GetByConfigurationIdAsync(string configurationId, CancellationToken ct = default);

    /// <summary>
    /// Get runs for a specific workflow.
    /// </summary>
    Task<IReadOnlyList<TrainingRun>> GetByWorkflowIdAsync(string workflowId, CancellationToken ct = default);

    /// <summary>
    /// Get active (running/paused) runs.
    /// </summary>
    Task<IReadOnlyList<TrainingRun>> GetActiveRunsAsync(CancellationToken ct = default);

    /// <summary>
    /// Delete a training run.
    /// </summary>
    Task DeleteAsync(string id, CancellationToken ct = default);
}
