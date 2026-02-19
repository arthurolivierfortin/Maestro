using System.Collections.Concurrent;
using LLMProvider.Application.DTOs;
using LLMProvider.Application.DTOs.Queue;
using LLMProvider.Application.Interfaces;
using LLMProvider.Application.Options;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LLMProvider.Infrastructure.Queue;

/// <summary>
/// Thread-safe priority queue for LLM requests, sorted by priority (desc) then enqueue time (asc).
/// </summary>
public sealed class PriorityRequestQueue : IRequestQueue
{
    private readonly QueueOptions _options;
    private readonly ILogger<PriorityRequestQueue> _logger;

    private readonly PriorityQueue<(QueuedRequest Request, QueuedRequestHandle Handle), (int PriorityDesc, long Ticks)> _queue = new();
    private readonly ConcurrentDictionary<Guid, QueuedRequestHandle> _handles = new();
    private readonly SemaphoreSlim _lock = new(1, 1);
    private long _enqueueCounter;

    public PriorityRequestQueue(IOptions<QueueOptions> options, ILogger<PriorityRequestQueue> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public bool IsEnabled => _options.Enabled;

    public async Task<QueuedRequestHandle> EnqueueAsync(
        QueuedRequest request,
        LLMRequest llmRequest,
        IReadOnlyList<Message>? history,
        Conversation? conversation,
        CancellationToken cancellationToken = default)
    {
        var handle = new QueuedRequestHandle(request.Id, llmRequest, history, conversation);

        await _lock.WaitAsync(cancellationToken);
        try
        {
            var counter = Interlocked.Increment(ref _enqueueCounter);
            // Negate priority so higher priority values are dequeued first
            _queue.Enqueue((request, handle), (-(int)request.Priority, counter));
            _handles[request.Id] = handle;
        }
        finally
        {
            _lock.Release();
        }

        _logger.LogDebug(
            "Enqueued request {RequestId} for model {Model} with priority {Priority}, queue depth: {Depth}",
            request.Id, request.TargetModel, request.Priority, Count);

        return handle;
    }

    public bool TryDequeue(out (QueuedRequest Request, QueuedRequestHandle Handle)? item)
    {
        _lock.Wait();
        try
        {
            if (_queue.Count == 0)
            {
                item = null;
                return false;
            }

            var entry = _queue.Dequeue();
            _handles.TryRemove(entry.Request.Id, out _);
            item = entry;
            return true;
        }
        finally
        {
            _lock.Release();
        }
    }

    public int Count
    {
        get
        {
            _lock.Wait();
            try { return _queue.Count; }
            finally { _lock.Release(); }
        }
    }

    public int CountForModel(ModelId modelId)
    {
        _lock.Wait();
        try
        {
            // We need to peek at all items - PriorityQueue doesn't expose enumeration easily
            // Use the handles dictionary instead
            return _handles.Values.Count(h => h.Request.ModelId == modelId);
        }
        finally
        {
            _lock.Release();
        }
    }

    public IReadOnlyList<QueuedRequest> PeekAll()
    {
        _lock.Wait();
        try
        {
            // Extract all items, rebuild queue
            var items = new List<(QueuedRequest Request, QueuedRequestHandle Handle, (int, long) Priority)>();
            while (_queue.TryDequeue(out var element, out var priority))
            {
                items.Add((element.Request, element.Handle, priority));
            }

            foreach (var (request, handle, priority) in items)
            {
                _queue.Enqueue((request, handle), priority);
            }

            return items.Select(i => i.Request).ToList().AsReadOnly();
        }
        finally
        {
            _lock.Release();
        }
    }

    public void Complete(Guid requestId, LLMResponse response)
    {
        if (_handles.TryRemove(requestId, out var handle))
        {
            handle.SetResult(response);
        }
    }

    public void Fail(Guid requestId, Exception ex)
    {
        if (_handles.TryRemove(requestId, out var handle))
        {
            handle.SetException(ex);
        }
    }
}
