using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Service for managing training runs.
/// </summary>
public interface ITrainingService
{
    /// <summary>
    /// Create a new training configuration.
    /// </summary>
    Task<TrainingConfiguration> CreateConfigurationAsync(TrainingConfiguration config, CancellationToken ct = default);

    /// <summary>
    /// Update an existing training configuration.
    /// </summary>
    Task<TrainingConfiguration> UpdateConfigurationAsync(TrainingConfiguration config, CancellationToken ct = default);

    /// <summary>
    /// Get a training configuration by ID.
    /// </summary>
    Task<TrainingConfiguration?> GetConfigurationAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Get all training configurations.
    /// </summary>
    Task<IReadOnlyList<TrainingConfiguration>> GetAllConfigurationsAsync(CancellationToken ct = default);

    /// <summary>
    /// Delete a training configuration.
    /// </summary>
    Task DeleteConfigurationAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Start a new training run.
    /// </summary>
    Task<TrainingRun> StartRunAsync(
        string configurationId,
        string? name = null,
        string? initiatedBy = null,
        Dictionary<string, object>? inputs = null,
        CancellationToken ct = default);

    /// <summary>
    /// Get a training run by ID.
    /// </summary>
    Task<TrainingRun?> GetRunAsync(string runId, CancellationToken ct = default);

    /// <summary>
    /// Get all training runs.
    /// </summary>
    Task<IReadOnlyList<TrainingRun>> GetAllRunsAsync(int? limit = null, int? offset = null, CancellationToken ct = default);

    /// <summary>
    /// Get runs for a specific configuration.
    /// </summary>
    Task<IReadOnlyList<TrainingRun>> GetRunsByConfigurationAsync(string configurationId, CancellationToken ct = default);

    /// <summary>
    /// Pause a running training run.
    /// </summary>
    Task<TrainingRun> PauseRunAsync(string runId, CancellationToken ct = default);

    /// <summary>
    /// Resume a paused training run.
    /// </summary>
    Task<TrainingRun> ResumeRunAsync(string runId, CancellationToken ct = default);

    /// <summary>
    /// Cancel a training run.
    /// </summary>
    Task<TrainingRun> CancelRunAsync(string runId, CancellationToken ct = default);

    /// <summary>
    /// Delete a training run.
    /// </summary>
    Task DeleteRunAsync(string runId, CancellationToken ct = default);
}

/// <summary>
/// Interface for quality evaluation.
/// </summary>
public interface IQualityEvaluator
{
    /// <summary>
    /// Evaluate the quality of a workflow execution output.
    /// </summary>
    Task<QualityScore> EvaluateAsync(
        object output,
        QualityEvaluationConfig config,
        CancellationToken ct = default);
}
