using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Infrastructure.BlockExecutors;

namespace Maestro.Infrastructure.Orchestration
{
    public class WorkflowExecutor : IWorkflowExecutor
    {
        private readonly BlockExecutorRegistry _registry;
        private readonly IDataFlowManager _dataFlow;

        public WorkflowExecutor(BlockExecutorRegistry registry, IDataFlowManager dataFlow)
        {
            _registry = registry ?? throw new ArgumentNullException(nameof(registry));
            _dataFlow = dataFlow ?? throw new ArgumentNullException(nameof(dataFlow));
        }

        public async Task<WorkflowExecutionResult> ExecuteAsync(WorkflowDefinition workflow, Dictionary<string, object>? inputs = null, ExecutionOptions? options = null, CancellationToken ct = default)
        {
            options ??= new ExecutionOptions();
            var graph = new ExecutionGraph(workflow.Blocks, workflow.Connections);
            if (graph.HasCycle()) return new WorkflowExecutionResult(false, null, "Workflow has cycles");

            // seed trigger inputs
            if (inputs != null)
            {
                foreach (var kv in inputs)
                    _dataFlow.SetOutput("__trigger__", kv.Key, kv.Value);
            }

            var layers = graph.GetExecutionLayers();
            foreach (var layer in layers)
            {
                var tasks = new List<Task>();
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                var sem = new SemaphoreSlim(options.MaxParallelism);
                foreach (var node in layer)
                {
                    await sem.WaitAsync(cts.Token);
                    tasks.Add(Task.Run(async () =>
                    {
                        try
                        {
                            var block = workflow.Blocks.First(b => b.Id == node.Id);
                            var executor = _registry.Get(block.BlockType);
                            if (executor == null)
                            {
                                // no executor; treat as no-op
                                return;
                            }

                            var inputValues = _dataFlow.CollectInputs(node.Id, graph);
                            var context = Maestro.Domain.Entities.ExecutionContext.Create(workflow.Id ?? workflow.Blocks.First().Id);
                            var result = await executor.ExecuteAsync(block, context, inputValues, cts.Token);
                            if (result.Success)
                            {
                                // store outputs on default port
                                // BlockExecutionResult exposes Outputs dictionary
                                if (result.Outputs != null && result.Outputs.Any())
                                {
                                    foreach (var kv in result.Outputs)
                                        _dataFlow.SetOutput(node.Id, kv.Key, kv.Value);
                                }
                            }
                            else
                            {
                                // store error log
                                var err = result.Logs != null && result.Logs.Any() ? string.Join("; ", result.Logs) : "failed";
                                _dataFlow.SetOutput(node.Id, "error", err);
                            }
                        }
                        finally { sem.Release(); }
                    }, ct));
                }

                try
                {
                    await Task.WhenAll(tasks);
                }
                catch (OperationCanceledException)
                {
                    return new WorkflowExecutionResult(false, null, "Cancelled");
                }
            }

            // collect outputs from terminal nodes
            var outputs = new Dictionary<string, object>();
            foreach (var n in graph.GetExecutionLayers().Last())
            {
                var val = _dataFlow.GetInput(n.Id, "default", graph);
                if (val != null) outputs[n.Id] = val;
            }

            return new WorkflowExecutionResult(true, outputs);
        }
    }
}
