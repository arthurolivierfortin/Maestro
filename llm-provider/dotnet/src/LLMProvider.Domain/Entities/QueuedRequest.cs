using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Domain.Entities;

/// <summary>
/// Represents a request waiting in the priority queue.
/// </summary>
public sealed class QueuedRequest
{
    public Guid Id { get; } = Guid.NewGuid();
    public ModelId TargetModel { get; }
    public ProviderType TargetProvider { get; }
    public RequestPriority Priority { get; }
    public DateTimeOffset EnqueuedAt { get; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? MaxWaitUntil { get; }

    public QueuedRequest(ModelId targetModel, ProviderType targetProvider, RequestPriority priority, int maxWaitSeconds = 30)
    {
        TargetModel = targetModel;
        TargetProvider = targetProvider;
        Priority = priority;
        MaxWaitUntil = EnqueuedAt.AddSeconds(maxWaitSeconds);
    }

    public TimeSpan WaitTime => DateTimeOffset.UtcNow - EnqueuedAt;

    public bool IsStarving => MaxWaitUntil.HasValue && DateTimeOffset.UtcNow > MaxWaitUntil.Value;
}
