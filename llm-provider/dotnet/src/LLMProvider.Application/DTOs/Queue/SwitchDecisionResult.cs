using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.DTOs.Queue;

/// <summary>
/// Result of a model switch evaluation by the optimizer.
/// </summary>
public sealed record SwitchDecisionResult(
    SwitchDecision Decision,
    ModelId TargetModel,
    double Score,
    string Reason,
    DateTimeOffset Timestamp)
{
    public static SwitchDecisionResult KeepCurrent(ModelId currentModel, double score, string reason)
        => new(SwitchDecision.KeepCurrent, currentModel, score, reason, DateTimeOffset.UtcNow);

    public static SwitchDecisionResult SwitchTo(ModelId targetModel, double score, string reason)
        => new(SwitchDecision.SwitchImmediate, targetModel, score, reason, DateTimeOffset.UtcNow);

    public static SwitchDecisionResult ForcedSwitch(ModelId targetModel, string reason)
        => new(SwitchDecision.ForcedByStarvation, targetModel, double.MaxValue, reason, DateTimeOffset.UtcNow);
}
