using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Application.DTOs;

namespace Maestro.Infrastructure.BlockExecutors;

public class CompositeBlockExecutor : IBlockExecutor
{
    public string SupportedType => "composite";

    private readonly IExecutionEngine _engine;

    public CompositeBlockExecutor(IExecutionEngine engine)
    {
        _engine = engine;
    }

    public async Task<BlockExecutionResult> ExecuteAsync(BlockDefinition block, Maestro.Domain.Entities.ExecutionContext context, Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        // Expect block.Config to contain a nested workflowId or inline definition
        if (block.Config != null && block.Config.TryGetValue("workflowId", out var wfIdObj) && wfIdObj is string wfId)
        {
            var subCtx = await _engine.ExecuteWorkflowAsync(wfId, inputs, ct);
            // Map outputs prefixed by child node ids into composite outputs
            var outputs = new Dictionary<string, object>();
            foreach (var kv in subCtx.Variables)
            {
                outputs[kv.Key] = kv.Value;
            }

            return new BlockExecutionResult
            {
                Success = subCtx.Status == "Completed",
                Outputs = outputs,
                Logs = subCtx.Logs.ConvertAll(l => l.Message)
            };
        }

            return new BlockExecutionResult
            {
                Success = false,
                Outputs = new Dictionary<string, object>(),
                Logs = new List<string> { "Missing composite workflowId" }
            };
    }
}
