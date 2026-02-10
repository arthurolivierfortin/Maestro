namespace Maestro.Application.Interfaces;

public class BlockManifest
{
    public string Schema { get; set; } = "maestro-block-manifest/1.0";
    public string Id { get; set; } = string.Empty;
    public string Version { get; set; } = "1.0.0";
    public string Type { get; set; } = string.Empty;
    public string? Author { get; set; }
    public string? Description { get; set; }
    public List<string> Tags { get; set; } = new();

    public FitnessInfo Fitness { get; set; } = new();
    public RequirementsInfo Requirements { get; set; } = new();
    public MetricsInfo Metrics { get; set; } = new();

    public class FitnessInfo
    {
        public BlockFitness? Block { get; set; }
        public TaskFitness? Task { get; set; }
        public ValueFitness? Value { get; set; }
    }

    public class BlockFitness
    {
        public double Score { get; set; }
        public string Formula { get; set; } = "maestro-v2";
        public string? TestedAt { get; set; }
        public string? SessionId { get; set; }
    }

    public class TaskFitness
    {
        public double Score { get; set; }
        public Dictionary<string, double> Dimensions { get; set; } = new();
        public string? Benchmark { get; set; }
        public int Runs { get; set; }
        public string? TestedAt { get; set; }
    }

    public class ValueFitness
    {
        public double Score { get; set; }
        public string? Baseline { get; set; }
    }

    public class RequirementsInfo
    {
        public HardwareReqs? Hardware { get; set; }
        public List<string> Os { get; set; } = new();
        public DependencyReqs? Dependencies { get; set; }
    }

    public class HardwareReqs
    {
        public string? MinVram { get; set; }
        public string? MinRam { get; set; }
        public string? Gpu { get; set; }
    }

    public class DependencyReqs
    {
        public List<string> Models { get; set; } = new();
        public List<string> Blocks { get; set; } = new();
        public string? Runtime { get; set; }
    }

    public class MetricsInfo
    {
        public string? TestedAt { get; set; }
        public string? TestSessionId { get; set; }
    }
}

public interface IBlockPublisher
{
    Task<BlockManifest> PublishBlockAsync(
        string blockId,
        string blockName,
        string blockType,
        string? submittedBy,
        Dictionary<string, object>? metadata,
        CancellationToken ct = default);
}
