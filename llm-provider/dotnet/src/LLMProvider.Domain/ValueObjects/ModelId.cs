namespace LLMProvider.Domain.ValueObjects;

/// <summary>
/// Strongly-typed identifier for an LLM model.
/// </summary>
public readonly record struct ModelId
{
    /// <summary>
    /// The underlying string value (e.g., "gpt-4", "gpt-4o", "distilgpt2").
    /// </summary>
    public string Value { get; }

    /// <summary>
    /// Creates a new ModelId with the specified value.
    /// </summary>
    /// <param name="value">The model identifier string.</param>
    /// <exception cref="ArgumentException">Thrown when value is null or whitespace.</exception>
    public ModelId(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("ModelId cannot be null or whitespace.", nameof(value));
        }

        Value = value;
    }

    /// <inheritdoc />
    public override string ToString() => Value;

    /// <summary>
    /// Implicit conversion from string.
    /// </summary>
    public static implicit operator ModelId(string value) => new(value);

    /// <summary>
    /// Implicit conversion to string.
    /// </summary>
    public static implicit operator string(ModelId id) => id.Value;
}
