namespace LLMProvider.Domain.Enums;

/// <summary>
/// Defines how conversation memory should be included in LLM requests.
/// </summary>
public enum MemoryStrategy
{
    /// <summary>Include full conversation history.</summary>
    Full = 1,

    /// <summary>Include no conversation history (stateless request).</summary>
    None = 2,

    /// <summary>Include only the last N messages.</summary>
    Windowed = 3,

    /// <summary>Include a summary of the conversation.</summary>
    Summarized = 4
}
