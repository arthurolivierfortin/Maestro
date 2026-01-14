namespace Maestro.Domain.ValueObjects;

public enum BlockExecutionState
{
    Pending,
    Running,
    Completed,
    Failed,
    Skipped
}
