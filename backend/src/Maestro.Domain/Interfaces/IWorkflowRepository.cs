using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Interfaces;

/// <summary>
/// Interface for workflow repository.
/// Defined in Domain layer, implemented in Infrastructure layer.
/// </summary>
public interface IWorkflowRepository
{
    Task<Workflow?> GetByIdAsync(WorkflowId id, CancellationToken cancellationToken = default);
    Task<IEnumerable<Workflow>> GetAllAsync(CancellationToken cancellationToken = default);
    Task SaveAsync(Workflow workflow, CancellationToken cancellationToken = default);
}
