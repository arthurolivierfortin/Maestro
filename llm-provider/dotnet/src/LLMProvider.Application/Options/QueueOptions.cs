namespace LLMProvider.Application.Options;

/// <summary>
/// Configuration options for the priority request queue.
/// </summary>
public sealed class QueueOptions
{
    public const string SectionName = "Queue";

    public bool Enabled { get; set; } = true;
    public int MaxWaitTimeSeconds { get; set; } = 30;
    public int ProcessorPollIntervalMs { get; set; } = 100;
    public double SwitchCostThreshold { get; set; } = 0.5;
    public int DefaultSwitchCostMs { get; set; } = 15000;
}
