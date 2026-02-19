namespace LLMProvider.Domain.ValueObjects;

/// <summary>
/// Strongly-typed identifier for a message.
/// </summary>
public readonly record struct MessageId
{
    /// <summary>
    /// The underlying GUID value.
    /// </summary>
    public Guid Value { get; }

    /// <summary>
    /// Creates a new MessageId with the specified GUID.
    /// </summary>
    /// <param name="value">The GUID value.</param>
    /// <exception cref="ArgumentException">Thrown when value is empty.</exception>
    public MessageId(Guid value)
    {
        if (value == Guid.Empty)
        {
            throw new ArgumentException("MessageId cannot be empty.", nameof(value));
        }

        Value = value;
    }

    /// <summary>
    /// Creates a new MessageId with a new GUID.
    /// </summary>
    /// <returns>A new MessageId.</returns>
    public static MessageId New() => new(Guid.NewGuid());

    /// <summary>
    /// Parses a string into a MessageId.
    /// </summary>
    /// <param name="value">The string representation of a GUID.</param>
    /// <returns>The parsed MessageId.</returns>
    /// <exception cref="FormatException">Thrown when the string is not a valid GUID.</exception>
    public static MessageId Parse(string value) => new(Guid.Parse(value));

    /// <summary>
    /// Tries to parse a string into a MessageId.
    /// </summary>
    /// <param name="value">The string representation of a GUID.</param>
    /// <param name="result">The parsed MessageId if successful.</param>
    /// <returns>True if parsing succeeded; otherwise, false.</returns>
    public static bool TryParse(string? value, out MessageId result)
    {
        if (Guid.TryParse(value, out var guid) && guid != Guid.Empty)
        {
            result = new MessageId(guid);
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
    public static implicit operator Guid(MessageId id) => id.Value;
}
