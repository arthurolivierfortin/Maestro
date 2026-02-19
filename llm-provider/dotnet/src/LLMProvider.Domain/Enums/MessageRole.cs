namespace LLMProvider.Domain.Enums;

/// <summary>
/// Defines the role of a message participant in a conversation.
/// </summary>
public enum MessageRole
{
    /// <summary>System message providing context or instructions.</summary>
    System = 1,

    /// <summary>Message from the user/human.</summary>
    User = 2,

    /// <summary>Response from the AI assistant.</summary>
    Assistant = 3
}
