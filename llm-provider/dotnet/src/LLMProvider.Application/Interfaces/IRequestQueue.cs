using LLMProvider.Application.DTOs;
using LLMProvider.Application.DTOs.Queue;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.Interfaces;

/// <summary>
/// Priority-based request queue for coordinating model switches.
/// </summary>
public interface IRequestQueue
{
    bool IsEnabled { get; }

    Task<QueuedRequestHandle> EnqueueAsync(
        QueuedRequest request,
        LLMRequest llmRequest,
        IReadOnlyList<Message>? history,
        Conversation? conversation,
        CancellationToken cancellationToken = default);

    bool TryDequeue(out (QueuedRequest Request, QueuedRequestHandle Handle)? item);

    int Count { get; }

    int CountForModel(ModelId modelId);

    IReadOnlyList<QueuedRequest> PeekAll();

    void Complete(Guid requestId, LLMResponse response);

    void Fail(Guid requestId, Exception ex);
}
