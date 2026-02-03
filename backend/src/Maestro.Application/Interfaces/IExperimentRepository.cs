using System.Collections.Generic;
using System.Threading.Tasks;
using Maestro.Domain.Entities;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository for experiment persistence.
/// </summary>
public interface IExperimentRepository
{
    /// <summary>
    /// Get an experiment by ID
    /// </summary>
    Task<TrainingExperiment?> GetByIdAsync(string id);

    /// <summary>
    /// Get all experiments in a workspace
    /// </summary>
    Task<IEnumerable<TrainingExperiment>> GetByWorkspaceAsync(string workspaceId);

    /// <summary>
    /// Get all experiments with a specific status
    /// </summary>
    Task<IEnumerable<TrainingExperiment>> GetByStatusAsync(ExperimentStatus status);

    /// <summary>
    /// Get all experiments for a specific agent
    /// </summary>
    Task<IEnumerable<TrainingExperiment>> GetByAgentAsync(string agentId);

    /// <summary>
    /// Get all experiments using a specific strategy
    /// </summary>
    Task<IEnumerable<TrainingExperiment>> GetByStrategyAsync(string strategyBlockId);

    /// <summary>
    /// Get all experiments
    /// </summary>
    Task<IEnumerable<TrainingExperiment>> GetAllAsync();

    /// <summary>
    /// Save an experiment (create or update)
    /// </summary>
    Task SaveAsync(TrainingExperiment experiment);

    /// <summary>
    /// Delete an experiment
    /// </summary>
    Task DeleteAsync(string id);

    /// <summary>
    /// Check if an experiment exists
    /// </summary>
    Task<bool> ExistsAsync(string id);
}
