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
        private readonly Maestro.Application.Interfaces.IExecutionRepository _repository;
        public WorkflowExecutor(BlockExecutorRegistry registry, IDataFlowManager dataFlow)
        {
            _registry = registry ?? throw new ArgumentNullException(nameof(registry));
            _dataFlow = dataFlow ?? throw new ArgumentNullException(nameof(dataFlow));
        }

        public WorkflowExecutor(BlockExecutorRegistry registry, IDataFlowManager dataFlow, Maestro.Application.Interfaces.IExecutionRepository repository)
        {
            _registry = registry ?? throw new ArgumentNullException(nameof(registry));
            _dataFlow = dataFlow ?? throw new ArgumentNullException(nameof(dataFlow));
            _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        }

        public async Task<WorkflowExecutionResult> ExecuteAsync(WorkflowDefinition workflow, Dictionary<string, object>? inputs = null, ExecutionOptions? options = null, Maestro.Domain.Entities.ExecutionContext? resumeFrom = null, CancellationToken ct = default)
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
            var execContext = resumeFrom ?? Maestro.Domain.Entities.ExecutionContext.Create(workflow.Id ?? workflow.Blocks.First().Id);
            // attempt to persist execution context if repository available
            if (_repository != null) await _repository.SaveAsync(execContext, ct);
            foreach (var layer in layers)
            {
                var tasks = new List<Task>();
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                var sem = new SemaphoreSlim(options.MaxParallelism);
                foreach (var node in layer)
                {
                    // skip nodes whose inputs are not satisfied (e.g., inactive branch)
                    if (!_dataFlow.AreInputsSatisfied(node.Id, graph)) continue;
                    // if resuming and node is already completed, skip
                    if (execContext.BlockStates.TryGetValue(node.Id, out var state) && state == Maestro.Domain.ValueObjects.BlockExecutionState.Completed) continue;
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
                            var context = execContext;

                            // Composite block scaffold: if block is non-atomic, attempt to treat as sub-workflow
                            if (!block.IsAtomic)
                            {
                                // For now, log and create a placeholder output mapping
                                execContext.LogInfo($"Executing composite block {block.Id} as sub-workflow scaffold", block.Id);
                                var placeholder = new Dictionary<string, object> { ["default"] = $"composite:{block.Id}:done" };
                                foreach (var kv in placeholder)
                                {
                                    _dataFlow.SetOutput(node.Id, kv.Key, kv.Value);
                                    execContext.SetBlockOutput(node.Id, kv.Key, kv.Value);
                                }
                                return;
                            }

                            // apply per-block retry policy using execution options
                            int attempt = 0;
                            Maestro.Application.DTOs.BlockExecutionResult? result = null;
                            var maxRetries = options.MaxRetries;
                            while (attempt <= maxRetries)
                            {
                                attempt++;
                                result = await executor.ExecuteAsync(block, context, inputValues, cts.Token);
                                if (result.Success) break;
                                if (attempt <= maxRetries)
                                {
                                    // simple exponential backoff
                                    var delayMs = (int)(1000 * Math.Pow(2, attempt - 1));
                                    await Task.Delay(delayMs, cts.Token);
                                }
                            }
                            if (result.Success)
                            {
                                // store outputs on default port
                                // BlockExecutionResult exposes Outputs dictionary
                                if (result.Outputs != null && result.Outputs.Any())
                                {
                                    foreach (var kv in result.Outputs)
                                        _dataFlow.SetOutput(node.Id, kv.Key, kv.Value);
                                }
                                // persist block output into execution context for checkpointing
                                foreach (var kv in result.Outputs ?? new Dictionary<string, object>())
                                    execContext.SetBlockOutput(node.Id, kv.Key, kv.Value);
                            }
                            else
                            {
                                // store error log
                                var err = result.Logs != null && result.Logs.Any() ? string.Join("; ", result.Logs) : "failed";
                                _dataFlow.SetOutput(node.Id, "error", err);
                                execContext.LogError($"Block {node.Id} failed: {err}", null, node.Id);
                            }
                        }
                        finally { sem.Release(); }
                    }, ct));
                }

                try
                {
                    await Task.WhenAll(tasks);
                    // checkpoint after layer completes
                    if (_repository != null) await _repository.SaveAsync(execContext, ct);
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
