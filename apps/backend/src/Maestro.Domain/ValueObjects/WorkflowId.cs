namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Value object representing a unique workflow identifier.
/// </summary>
public readonly record struct WorkflowId
{
    public Guid Value { get; }

    private WorkflowId(Guid value)
    {
        if (value == Guid.Empty)
            throw new ArgumentException("WorkflowId cannot be empty.", nameof(value));
        
        Value = value;
    }

    public static WorkflowId New() => new(Guid.NewGuid());
    public static WorkflowId From(Guid value) => new(value);

    public override string ToString() => Value.ToString();
}
