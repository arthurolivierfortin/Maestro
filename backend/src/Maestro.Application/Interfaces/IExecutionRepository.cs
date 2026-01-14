using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

public interface IExecutionRepository
{
    Task SaveAsync(ExecutionContext context, CancellationToken ct = default);
    Task<ExecutionContext?> GetByIdAsync(ExecutionId id, CancellationToken ct = default);
}
