namespace Maestro.Domain.ValueObjects;

public readonly record struct ExecutionId
{
    public Guid Value { get; }

    private ExecutionId(Guid value)
    {
        if (value == Guid.Empty) throw new ArgumentException("ExecutionId cannot be empty", nameof(value));
        Value = value;
    }

    public static ExecutionId New() => new(Guid.NewGuid());
    public static ExecutionId From(Guid value) => new(value);

    public override string ToString() => Value.ToString();
}
