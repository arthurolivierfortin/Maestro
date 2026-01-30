namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Value object representing a unique session identifier.
/// </summary>
public readonly record struct SessionId
{
    public string Value { get; }

    private SessionId(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("SessionId cannot be empty.", nameof(value));

        Value = value;
    }

    public static SessionId New() => new($"sess-{Guid.NewGuid():N}");
    public static SessionId From(string value) => new(value);

    public override string ToString() => Value;
}
