namespace LLMProvider.Domain.ValueObjects;

/// <summary>
/// Strongly-typed identifier for a conversation.
/// </summary>
public readonly record struct ConversationId
{
    /// <summary>
    /// The underlying GUID value.
    /// </summary>
    public Guid Value { get; }

    /// <summary>
    /// Creates a new ConversationId with the specified GUID.
    /// </summary>
    /// <param name="value">The GUID value.</param>
    /// <exception cref="ArgumentException">Thrown when value is empty.</exception>
    public ConversationId(Guid value)
    {
        if (value == Guid.Empty)
        {
            throw new ArgumentException("ConversationId cannot be empty.", nameof(value));
        }

        Value = value;
    }

    /// <summary>
    /// Creates a new ConversationId with a new GUID.
    /// </summary>
    /// <returns>A new ConversationId.</returns>
    public static ConversationId New() => new(Guid.NewGuid());

    /// <summary>
    /// Parses a string into a ConversationId.
    /// </summary>
    /// <param name="value">The string representation of a GUID.</param>
    /// <returns>The parsed ConversationId.</returns>
    /// <exception cref="FormatException">Thrown when the string is not a valid GUID.</exception>
    public static ConversationId Parse(string value) => new(Guid.Parse(value));

    /// <summary>
    /// Tries to parse a string into a ConversationId.
    /// </summary>
    /// <param name="value">The string representation of a GUID.</param>
    /// <param name="result">The parsed ConversationId if successful.</param>
    /// <returns>True if parsing succeeded; otherwise, false.</returns>
    public static bool TryParse(string? value, out ConversationId result)
    {
        if (Guid.TryParse(value, out var guid) && guid != Guid.Empty)
        {
            result = new ConversationId(guid);
            return true;
        }

        result = default;
        return false;
    }

    /// <inheritdoc />
    public override string ToString() => Value.ToString();

    /// <summary>
    /// Implicit conversion to Guid.
    /// </summary>
    public static implicit operator Guid(ConversationId id) => id.Value;
}
