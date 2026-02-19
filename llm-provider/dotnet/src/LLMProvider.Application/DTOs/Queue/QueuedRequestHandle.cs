using LLMProvider.Domain.Entities;

namespace LLMProvider.Application.DTOs.Queue;

/// <summary>
/// Handle returned to callers when a request is enqueued. Provides a Task that completes when the request is processed.
/// </summary>
public sealed class QueuedRequestHandle
{
    private readonly TaskCompletionSource<LLMResponse> _tcs = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public Guid RequestId { get; }
    public LLMRequest Request { get; }
    public IReadOnlyList<Message>? ConversationHistory { get; }
    public Conversation? Conversation { get; }

    public Task<LLMResponse> ResultTask => _tcs.Task;

    public QueuedRequestHandle(Guid requestId, LLMRequest request, IReadOnlyList<Message>? conversationHistory, Conversation? conversation)
    {
        RequestId = requestId;
        Request = request;
        ConversationHistory = conversationHistory;
        Conversation = conversation;
    }

    public void SetResult(LLMResponse response) => _tcs.TrySetResult(response);
    public void SetException(Exception exception) => _tcs.TrySetException(exception);
    public void SetCanceled() => _tcs.TrySetCanceled();
}
