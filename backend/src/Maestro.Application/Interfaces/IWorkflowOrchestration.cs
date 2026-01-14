using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Maestro.Application.Interfaces
{
    public interface IDataFlowManager
    {
        void SetOutput(string blockId, string portId, object value);
        object? GetInput(string blockId, string portId, IExecutionGraph graph);
        Dictionary<string, object> CollectInputs(string blockId, IExecutionGraph graph);
        bool AreInputsSatisfied(string blockId, IExecutionGraph graph);
    }

    public record WorkflowExecutionResult(bool Success, Dictionary<string, object>? Outputs = null, string? Error = null);

    public interface IWorkflowExecutor
    {
        Task<WorkflowExecutionResult> ExecuteAsync(
            WorkflowDefinition workflow,
            Dictionary<string, object>? inputs = null,
            ExecutionOptions? options = null,
            Maestro.Domain.Entities.ExecutionContext? resumeFrom = null,
            CancellationToken ct = default);
    }

    // Use domain types for block/connection definitions to avoid duplication
    public record WorkflowDefinition(string Id, List<Maestro.Domain.Entities.BlockDefinition> Blocks, List<Maestro.Domain.Entities.ConnectionDefinition> Connections);
    public record ExecutionOptions(int MaxParallelism = 4, int MaxRetries = 3);
}
