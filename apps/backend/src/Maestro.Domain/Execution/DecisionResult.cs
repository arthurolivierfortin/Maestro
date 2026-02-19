namespace Maestro.Domain.Execution;

public class DecisionResult
{
    public string BranchId { get; init; } = string.Empty;
    public object? Payload { get; init; }
}
