namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Value object representing a unique node identifier.
/// </summary>
public readonly record struct NodeId
{
    public Guid Value { get; }

    private NodeId(Guid value)
    {
        if (value == Guid.Empty)
            throw new ArgumentException("NodeId cannot be empty.", nameof(value));
        
        Value = value;
    }

    public static NodeId New() => new(Guid.NewGuid());
    public static NodeId From(Guid value) => new(value);

    public override string ToString() => Value.ToString();
}
