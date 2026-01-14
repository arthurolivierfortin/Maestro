using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Interfaces;

/// <summary>
/// Interface for workflow repository.
/// Defined in Domain layer, implemented in Infrastructure layer.
/// </summary>
public interface IWorkflowRepository
{
    Task<Maestro.Domain.Entities.Workflow?> GetByIdAsync(WorkflowId id, CancellationToken cancellationToken = default);
    Task<IEnumerable<Maestro.Domain.Entities.Workflow>> GetAllAsync(CancellationToken cancellationToken = default);
    Task SaveAsync(Maestro.Domain.Entities.Workflow workflow, CancellationToken cancellationToken = default);
}
