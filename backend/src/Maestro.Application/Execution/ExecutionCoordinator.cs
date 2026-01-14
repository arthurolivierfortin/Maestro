using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;

namespace Maestro.Application.Execution;

public class ExecutionCoordinator
{
    private readonly IExecutionEngine _engine;
    private readonly ConcurrentQueue<(string workflowId, Dictionary<string, object> inputs)> _queue = new();

    public ExecutionCoordinator(IExecutionEngine engine)
    {
        _engine = engine;
    }

    public Task EnqueueAsync(string workflowId, Dictionary<string, object> inputs)
    {
        _queue.Enqueue((workflowId, inputs));
        _ = ProcessQueueAsync();
        return Task.CompletedTask;
    }

    private async Task ProcessQueueAsync()
    {
        while (_queue.TryDequeue(out var item))
        {
            try
            {
                await _engine.ExecuteWorkflowAsync(item.workflowId, item.inputs);
            }
            catch
            {
                // swallow - handlers should be used to persist failures
            }
        }
    }
}
