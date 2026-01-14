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

        // Support webhook trigger: if inputs contain http-like fields, parse and forward
        if (inputs != null && inputs.ContainsKey("httpMethod") && inputs.ContainsKey("httpBody"))
        {
            var method = inputs["httpMethod"]?.ToString() ?? "POST";
            var body = inputs["httpBody"];
            // try to parse JSON body
            if (body is string s)
            {
                try
                {
                    var doc = JsonDocument.Parse(s);
                    result.Outputs["payload"] = doc.RootElement.Clone();
                }
                catch
                {
                    result.Outputs["payload"] = s;
                }
            }
            else
            {
                result.Outputs["payload"] = body;
            }
            result.Outputs["triggerType"] = "webhook";
            result.Outputs["httpMethod"] = method;
            result.Logs.Add("Webhook trigger parsed");
        }
        else if (inputs != null && inputs.ContainsKey("schedule") && inputs["schedule"] is string sched)
        {
            // schedule payload: record trigger time and forward schedule metadata
            result.Outputs["payload"] = inputs;
            result.Outputs["triggerType"] = "schedule";
            result.Outputs["triggeredAt"] = DateTimeOffset.UtcNow;
            result.Outputs["schedule"] = sched;
            result.Logs.Add("Schedule trigger recorded");
        }
        else
        {
            result.Outputs["payload"] = inputs ?? new Dictionary<string, object>();
            result.Outputs["triggerType"] = "manual";
            result.Logs.Add("Manual trigger: inputs forwarded");
        }

        result.DurationMs = sw.ElapsedMilliseconds;
        return Task.FromResult(result);
    }
}
