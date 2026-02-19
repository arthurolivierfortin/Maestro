namespace LLMProvider.Domain.Enums;

/// <summary>
/// Priority levels for queued LLM requests.
/// </summary>
public enum RequestPriority
{
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3
}
