using System;
using System.Collections.Generic;
using System.Linq;
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
    private readonly Maestro.Application.Interfaces.IExecutionErrorHandler? _errorHandler;

    public ExecutionEngine(
        IBlockRepository blockRepository,
        BlockExecutorRegistry registry,
        IExecutionRepository executionRepository,
        IExecutionMonitor monitor,
        Maestro.Application.Interfaces.IExecutionErrorHandler? errorHandler = null)
    {
        _blockRepository = blockRepository;
        _registry = registry;
        _executionRepository = executionRepository;
        _monitor = monitor;
        _errorHandler = errorHandler;
    }

    public async Task<ExecutionContext> ExecuteBlockAsync(string blockId, Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var block = await _blockRepository.GetByIdAsync(blockId, ct);
        if (block == null) throw new ArgumentException($"Block {blockId} not found");

        var context = ExecutionContext.Create(block.Id);

        await _monitor.PublishExecutionStartedAsync(context.Id, ct);

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
            await _monitor.PublishLogAddedAsync(context.Id, "Block completed");
        }
        else
        {
            context.LogError("Block failed", null, block.Id);
            await _monitor.PublishLogAddedAsync(context.Id, "Block failed");
        }

        context.Complete();
        await _executionRepository.SaveAsync(context, ct);
        if (result.Success)
        {
            await _monitor.PublishNodeCompletedAsync(ParseNodeId(block.Id), ct);
            await _monitor.PublishExecutionCompletedAsync(context.Id, ct);
        }
        else
        {
            var errMsg = result.Logs != null ? string.Join("; ", result.Logs) : "Block failed";
            await _monitor.PublishNodeFailedAsync(ParseNodeId(block.Id), errMsg, ct);
            await _monitor.PublishExecutionFailedAsync(context.Id, errMsg, ct);
        }

        return context;
    }

    public Task CancelAsync(ExecutionId executionId)
    {
        return CancelAsyncInternal(executionId);
    }

    private async Task CancelAsyncInternal(ExecutionId executionId)
    {
        var ctx = await _executionRepository.GetByIdAsync(executionId);
        if (ctx == null) return;
        ctx.Cancel();
        await _executionRepository.SaveAsync(ctx);
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
                // Simple active-branch check: if active branches present, skip nodes not in active set
                if (context.ActiveBranches != null && context.ActiveBranches.Count > 0 && !context.ActiveBranches.Contains(nodeId))
                {
                    context.LogInfo($"Skipping node {nodeId} because its branch is inactive", nodeId);
                    // mark skipped
                    context.BlockStates[nodeId] = BlockExecutionState.Skipped;
                    await _monitor.PublishNodeCompletedAsync(ParseNodeId(nodeId), ct);
                }
                else
                {
                    var executor = _registry.Get(nodeBlock.BlockType);
                    if (executor == null)
                    {
                        context.LogError($"No executor for node type {nodeBlock.BlockType}", null, nodeId);
                        await _monitor.PublishLogAddedAsync(context.Id, $"No executor for node type {nodeBlock.BlockType}");
                    }
                    else
                    {
                        await _monitor.PublishNodeStartedAsync(ParseNodeId(nodeId), ct);

                        // basic retry/backoff using RetryPolicy if present in block config
                        int maxRetries = 1;
                        int attempt = 0;
                        TimeSpan delay = TimeSpan.Zero;
                        if (nodeBlock.Config != null && nodeBlock.Config.TryGetValue("retry", out var r) && r is System.Text.Json.JsonElement je && je.ValueKind == System.Text.Json.JsonValueKind.Object)
                        {
                            try
                            {
                                var txt = System.Text.Json.JsonSerializer.Serialize(r);
                                var rp = System.Text.Json.JsonSerializer.Deserialize<Maestro.Domain.Execution.RetryPolicy>(txt);
                                if (rp != null)
                                {
                                    maxRetries = Math.Max(1, rp.MaxRetries);
                                    delay = rp.InitialDelay;
                                }
                            }
                            catch { }
                        }

                        BlockExecutionResult result = null;
                        for (attempt = 1; attempt <= maxRetries; attempt++)
                        {
                            result = await executor.ExecuteAsync(nodeBlock, context, inputs, ct);
                            if (result.Success) break;
                            if (attempt < maxRetries)
                            {
                                var wait = delay == TimeSpan.Zero ? TimeSpan.FromSeconds(1) : delay;
                                await Task.Delay(wait, ct);
                                // exponential backoff
                                delay = TimeSpan.FromMilliseconds(Math.Min((long)(wait.TotalMilliseconds * 2), 30000));
                            }
                        }

                        if (result != null)
                        {
                            foreach (var kv in result.Outputs)
                            {
                                context.SetBlockOutput(nodeBlock.Id, kv.Key, kv.Value);
                            }

                            if (result.Success)
                            {
                                context.LogInfo($"Node {nodeId} completed", nodeId);
                                await _monitor.PublishLogAddedAsync(context.Id, $"Node {nodeId} completed");
                                context.BlockStates[nodeId] = BlockExecutionState.Completed;
                            }
                            else
                            {
                                context.LogError($"Node {nodeId} failed", null, nodeId);
                                await _monitor.PublishLogAddedAsync(context.Id, $"Node {nodeId} failed");
                                context.BlockStates[nodeId] = BlockExecutionState.Failed;

                                // Apply onError strategy if configured
                                try
                                {
                                    if (nodeBlock.Config != null && nodeBlock.Config.TryGetValue("onError", out var onErrObj) && onErrObj is string onErr)
                                    {
                                        if (string.Equals(onErr, "StopWorkflow", StringComparison.OrdinalIgnoreCase))
                                        {
                                            context.LogError($"Stopping workflow due to node {nodeId} failure", null, nodeId);
                                            context.Status = "Failed";
                                            await _executionRepository.SaveAsync(context, ct);
                                            return context; // stop execution
                                        }
                                        else if (string.Equals(onErr, "UseDefault", StringComparison.OrdinalIgnoreCase))
                                        {
                                            if (nodeBlock.Config.TryGetValue("defaultOutputs", out var defOut))
                                            {
                                                try
                                                {
                                                    var txt = System.Text.Json.JsonSerializer.Serialize(defOut);
                                                    var dict = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(txt);
                                                    if (dict != null)
                                                    {
                                                        foreach (var dkv in dict)
                                                        {
                                                            context.SetBlockOutput(nodeBlock.Id, dkv.Key, dkv.Value);
                                                        }
                                                    }
                                                }
                                                catch { }
                                            }
                                            // continue
                                        }
                                        else if (string.Equals(onErr, "SkipBlock", StringComparison.OrdinalIgnoreCase))
                                        {
                                            // already marked failed; treat as skipped for downstream
                                            context.BlockStates[nodeId] = BlockExecutionState.Skipped;
                                        }
                                    }
                                }
                                catch (Exception ex)
                                {
                                    if (_errorHandler != null)
                                    {
                                        await _errorHandler.HandleAsync(context, nodeId, ex, ct);
                                    }
                                }
                            }

                            await _monitor.PublishNodeCompletedAsync(ParseNodeId(nodeId), ct);
                        }
                    }
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
        return PauseAsyncInternal(executionId);
    }

    public Task ResumeAsync(ExecutionId executionId)
    {
        return ResumeAsyncInternal(executionId);
    }

    private async Task PauseAsyncInternal(ExecutionId executionId)
    {
        var ctx = await _executionRepository.GetByIdAsync(executionId);
        if (ctx == null) return;
        ctx.Pause();
        await _executionRepository.SaveAsync(ctx);
    }

    private async Task ResumeAsyncInternal(ExecutionId executionId)
    {
        var ctx = await _executionRepository.GetByIdAsync(executionId);
        if (ctx == null) return;
        ctx.Resume();
        await _executionRepository.SaveAsync(ctx);
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
