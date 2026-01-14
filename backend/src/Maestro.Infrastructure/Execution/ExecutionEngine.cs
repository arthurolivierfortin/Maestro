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

        await _monitor.PublishNodeStartedAsync(ParseNodeId(block.Id), ct);

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
        await _monitor.PublishNodeCompletedAsync(ParseNodeId(block.Id), ct);

        return context;
    }

    public Task CancelAsync(ExecutionId executionId)
    {
        return Task.CompletedTask;
    }

    public Task<ExecutionContext> ExecuteWorkflowAsync(string workflowId, Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        // Orchestrate a workflow described by a workflow block (nodes + connections)
        return ExecuteWorkflowInternalAsync(workflowId, inputs, ct);
    }

    private async Task<ExecutionContext> ExecuteWorkflowInternalAsync(string workflowBlockId, Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var workflowBlock = await _blockRepository.GetByIdAsync(workflowBlockId, ct);
        if (workflowBlock == null) throw new ArgumentException($"Workflow {workflowBlockId} not found");

        var context = ExecutionContext.Create(workflowBlock.Id);

        // Extract nodes and connections from workflow block config
        var nodesObj = workflowBlock.Config != null && workflowBlock.Config.TryGetValue("nodes", out var n) ? n : null;
        var connsObj = workflowBlock.Config != null && workflowBlock.Config.TryGetValue("connections", out var c) ? c : null;

        var adj = new Dictionary<string, List<string>>();
        var inDegree = new Dictionary<string, int>();

        try
        {
            if (nodesObj != null)
            {
                var txt = System.Text.Json.JsonSerializer.Serialize(nodesObj);
                using var doc = System.Text.Json.JsonDocument.Parse(txt);
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    if (id == null) continue;
                    if (!adj.ContainsKey(id)) adj[id] = new List<string>();
                    inDegree[id] = 0;
                }
            }

            if (connsObj != null)
            {
                var txt = System.Text.Json.JsonSerializer.Serialize(connsObj);
                using var doc = System.Text.Json.JsonDocument.Parse(txt);
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    var from = el.GetProperty("from").GetProperty("nodeId").GetString();
                    var to = el.GetProperty("to").GetProperty("nodeId").GetString();
                    if (from == null || to == null) continue;
                    if (!adj.ContainsKey(from)) adj[from] = new List<string>();
                    adj[from].Add(to);
                    if (!inDegree.ContainsKey(to)) inDegree[to] = 0;
                    inDegree[to]++;
                }
            }
        }
        catch (Exception ex)
        {
            context.LogError("Failed to parse workflow nodes/connections", ex);
            context.Complete();
            await _executionRepository.SaveAsync(context, ct);
            return context;
        }

        // Kahn's algorithm for topological ordering
        var queue = new Queue<string>(inDegree.Where(kv => kv.Value == 0).Select(kv => kv.Key));

        while (queue.Count > 0)
        {
            var nodeId = queue.Dequeue();

            var nodeBlock = await _blockRepository.GetByIdAsync(nodeId, ct);
            if (nodeBlock == null)
            {
                context.LogError($"Node block {nodeId} not found", null);
            }
            else
            {
                var executor = _registry.Get(nodeBlock.BlockType);
                if (executor == null)
                {
                    context.LogError($"No executor for node type {nodeBlock.BlockType}", null, nodeId);
                }
                else
                {
                    await _monitor.PublishNodeStartedAsync(ParseNodeId(nodeId), ct);
                    var result = await executor.ExecuteAsync(nodeBlock, context, inputs, ct);

                    foreach (var kv in result.Outputs)
                    {
                        context.SetBlockOutput(nodeBlock.Id, kv.Key, kv.Value);
                    }

                    if (result.Success)
                        context.LogInfo($"Node {nodeId} completed", nodeId);
                    else
                        context.LogError($"Node {nodeId} failed", null, nodeId);

                    await _monitor.PublishNodeCompletedAsync(ParseNodeId(nodeId), ct);
                }
            }

            if (adj.TryGetValue(nodeId, out var neighbors))
            {
                foreach (var nb in neighbors)
                {
                    inDegree[nb] = inDegree.GetValueOrDefault(nb, 1) - 1;
                    if (inDegree[nb] == 0) queue.Enqueue(nb);
                }
            }
        }

        context.Complete();
        await _executionRepository.SaveAsync(context, ct);
        return context;
    }

    public Task PauseAsync(ExecutionId executionId)
    {
        return Task.CompletedTask;
    }

    public Task ResumeAsync(ExecutionId executionId)
    {
        return Task.CompletedTask;
    }

    private static NodeId ParseNodeId(string id)
    {
        if (Guid.TryParse(id, out var g)) return NodeId.From(g);
        try
        {
            // attempt to parse numeric or other formats by hashing to GUID
            var bytes = System.Text.Encoding.UTF8.GetBytes(id);
            var hash = System.Security.Cryptography.SHA1.HashData(bytes);
            var guidBytes = new byte[16];
            Array.Copy(hash, guidBytes, 16);
            var guid = new Guid(guidBytes);
            return NodeId.From(guid);
        }
        catch
        {
            return NodeId.New();
        }
    }
}
