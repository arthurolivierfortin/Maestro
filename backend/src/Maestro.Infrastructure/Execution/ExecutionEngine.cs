using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.IO;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.BlockExecutors;

namespace Maestro.Infrastructure.Execution;

public class ExecutionEngine : IExecutionEngine
{
    private readonly IBlockRepository _blockRepository;
    private readonly BlockExecutorRegistry _registry;
    private readonly IExecutionRepository _executionRepository;
    private readonly IExecutionMonitor _monitor;

    public ExecutionEngine(
        IBlockRepository blockRepository,
        BlockExecutorRegistry registry,
        IExecutionRepository executionRepository,
        IExecutionMonitor monitor)
    {
        _blockRepository = blockRepository;
        _registry = registry;
        _executionRepository = executionRepository;
        _monitor = monitor;
    }

    public async Task<ExecutionContext> ExecuteBlockAsync(string blockId, Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var block = await _blockRepository.GetByIdAsync(blockId, ct);
        if (block == null) throw new ArgumentException($"Block {blockId} not found");

        var context = ExecutionContext.Create(block.Id);

        var executor = _registry.Get(block.BlockType);
        if (executor == null) throw new InvalidOperationException($"No executor for type {block.BlockType}");

        await _monitor.PublishNodeStartedAsync(NodeId.From(Guid.Parse(block.Id)), ct);

        var result = await executor.ExecuteAsync(block, context, inputs, ct);

        // store outputs
        foreach (var kv in result.Outputs)
        {
            context.SetBlockOutput(block.Id, kv.Key, kv.Value);
        }

        if (result.Success)
        {
            context.LogInfo("Block completed", block.Id);
        }
        else
        {
            context.LogError("Block failed", null, block.Id);
        }

        context.Complete();
        await _executionRepository.SaveAsync(context, ct);
        await _monitor.PublishNodeCompletedAsync(NodeId.From(Guid.Parse(block.Id)), ct);

        return context;
    }

    public Task CancelAsync(ExecutionId executionId)
    {
        return Task.CompletedTask;
    }

    public Task<ExecutionContext> ExecuteWorkflowAsync(string workflowId, Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        // Minimal implementation: execute single block if workflowId corresponds to a block
        return ExecuteBlockAsync(workflowId, inputs, ct);
    }

    public Task PauseAsync(ExecutionId executionId)
    {
        return Task.CompletedTask;
    }

    public Task ResumeAsync(ExecutionId executionId)
    {
        return Task.CompletedTask;
    }
}
