namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Value object representing a unique project identifier.
/// </summary>
public readonly record struct ProjectId
{
    public Guid Value { get; }

    private ProjectId(Guid value)
    {
        if (value == Guid.Empty)
            throw new ArgumentException("ProjectId cannot be empty.", nameof(value));
        
        Value = value;
    }

    public static ProjectId New() => new(Guid.NewGuid());
    public static ProjectId From(Guid value) => new(value);
    public static ProjectId From(string value) => new(Guid.Parse(value));

    public override string ToString() => Value.ToString();
}
