namespace LLMProvider.Domain.Enums;

/// <summary>
/// Describes the outcome of a model switch evaluation.
/// </summary>
public enum SwitchDecision
{
    KeepCurrent = 1,
    SwitchImmediate = 2,
    ForcedByStarvation = 3,
    Unnecessary = 4
}
