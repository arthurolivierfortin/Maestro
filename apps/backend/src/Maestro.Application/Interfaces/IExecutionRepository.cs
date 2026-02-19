using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

public interface IExecutionRepository
{
    Task SaveAsync(ExecutionContext context, CancellationToken ct = default);
    Task<ExecutionContext?> GetByIdAsync(ExecutionId id, CancellationToken ct = default);
    // Query executions by optional filters (workflowId, status, date range)
    Task<IEnumerable<ExecutionContext>> QueryAsync(string? workflowId = null, string? status = null, DateTimeOffset? from = null, DateTimeOffset? to = null, CancellationToken ct = default);

    // Append a log line to execution's log stream (persisted alongside execution JSON)
    Task SaveLogAsync(ExecutionId id, string logLine, CancellationToken ct = default);
}
