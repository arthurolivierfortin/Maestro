namespace Maestro.Domain.ValueObjects;

public class ExecutionMetrics
{
    public TimeSpan Duration { get; set; }
    public int TokensUsed { get; set; }
    public decimal? CostEstimate { get; set; }
}
