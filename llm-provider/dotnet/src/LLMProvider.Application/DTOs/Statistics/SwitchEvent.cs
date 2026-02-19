using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Application.DTOs.Statistics;

/// <summary>
/// Records a model switch decision event.
/// </summary>
public sealed record SwitchEvent(
    ModelId From,
    ModelId To,
    SwitchDecision Decision,
    double Score,
    string Reason,
    TimeSpan Duration,
    DateTimeOffset Timestamp);
