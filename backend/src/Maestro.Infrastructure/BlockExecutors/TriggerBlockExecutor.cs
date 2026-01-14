using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

public class TriggerBlockExecutor : IBlockExecutor
{
    public string SupportedType => "trigger";

    public Task<BlockExecutionResult> ExecuteAsync(BlockDefinition block, ExecutionContext context, Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var result = new BlockExecutionResult();

        // If inputs contain 'payload', pass it through
        if (inputs != null && inputs.TryGetValue("payload", out var payload))
        {
            result.Outputs["payload"] = payload;
            result.Logs.Add("Payload passed through");
        }
        else
        {
            result.Outputs["payload"] = inputs ?? new Dictionary<string, object>();
            result.Logs.Add("Manual trigger: inputs forwarded");
        }

        result.DurationMs = sw.ElapsedMilliseconds;
        return Task.FromResult(result);
    }
}
