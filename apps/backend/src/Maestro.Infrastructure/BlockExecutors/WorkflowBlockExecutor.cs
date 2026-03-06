using Maestro.Application.DTOs;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Executor for workflow blocks: pass-through inputs → execute config.nodes → return variables.
/// Workflows always have config.nodes — no legacy fallback needed.
///
/// ARCHITECTURE (Phase 53-B): Workflows are the simplest multi-node block.
/// PrepareExecutionAsync passes inputs through. ExtractResultAsync returns all variables.
/// </summary>
public class WorkflowBlockExecutor : MultiNodeBlockExecutor
{
    public override string SupportedType => "workflow";

    public WorkflowBlockExecutor(IServiceProvider serviceProvider)
        : base(serviceProvider) { }

    protected override Task<Dictionary<string, object>> PrepareExecutionAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct)
    {
        return Task.FromResult(inputs);
    }

    protected override Task<BlockExecutionResult> ExtractResultAsync(
        BlockDefinition block, ExecutionContext context, CancellationToken ct)
    {
        return Task.FromResult(new BlockExecutionResult
        {
            Success = true,
            Outputs = new Dictionary<string, object>(context.Variables)
        });
    }
}
