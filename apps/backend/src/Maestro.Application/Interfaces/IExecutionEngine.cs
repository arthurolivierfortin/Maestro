using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

public interface IExecutionEngine
{
    Task<ExecutionContext> ExecuteBlockAsync(
        string blockId,
        Dictionary<string, object> inputs,
        CancellationToken ct = default);

    Task<ExecutionContext> ExecuteWorkflowAsync(
        string workflowId,
        Dictionary<string, object> inputs,
        CancellationToken ct = default);

    Task PauseAsync(ExecutionId executionId);
    Task ResumeAsync(ExecutionId executionId);
    Task CancelAsync(ExecutionId executionId);
}
