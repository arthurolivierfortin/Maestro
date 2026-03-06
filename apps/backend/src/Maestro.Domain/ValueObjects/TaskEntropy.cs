namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Represents task entropy (Shannon entropy) for measuring model specialization.
/// Lower entropy = higher specialization (model focuses on fewer task types).
/// </summary>
public record TaskEntropy
{
    /// <summary>
    /// The entity ID (model or agent) this entropy is calculated for.
    /// </summary>
    public string EntityId { get; init; } = string.Empty;

    /// <summary>
    /// The type of entity ("model" or "agent").
    /// </summary>
    public string EntityType { get; init; } = "model";

    /// <summary>
    /// Distribution of task types executed (task type -> count).
    /// </summary>
    public IReadOnlyDictionary<string, int> TaskDistribution { get; init; } = new Dictionary<string, int>();

    /// <summary>
    /// Calculated Shannon entropy value.
    /// </summary>
    public double EntropyValue { get; init; }

    /// <summary>
    /// Total number of tasks executed.
    /// </summary>
    public int TotalTasks { get; init; }

    /// <summary>
    /// Number of unique task types.
    /// </summary>
    public int UniqueTaskTypes => TaskDistribution.Count;

    /// <summary>
    /// Maximum possible entropy for this distribution (log2 of unique types).
    /// </summary>
    public double MaxEntropy => UniqueTaskTypes > 1 ? Math.Log2(UniqueTaskTypes) : 1.0;

    /// <summary>
    /// Normalized entropy (0-1 scale, where 0 = perfectly specialized, 1 = maximally diverse).
    /// </summary>
    public double NormalizedEntropy => MaxEntropy > 0 ? EntropyValue / MaxEntropy : 0;

    /// <summary>
    /// Specialization score (inverse of normalized entropy).
    /// Higher = more specialized.
    /// </summary>
    public double SpecializationScore => 1.0 - NormalizedEntropy;

    /// <summary>
    /// When the entropy was last calculated.
    /// </summary>
    public DateTimeOffset CalculatedAt { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// The dominant task type (if any).
    /// </summary>
    public string? DominantTaskType
    {
        get
        {
            if (TaskDistribution.Count == 0) return null;
            return TaskDistribution.MaxBy(kvp => kvp.Value).Key;
        }
    }

    /// <summary>
    /// Calculate Shannon entropy from a task distribution.
    /// H = -Σ p(x) * log2(p(x))
    /// </summary>
    public static TaskEntropy Calculate(string entityId, string entityType, IDictionary<string, int> distribution)
    {
        var total = distribution.Values.Sum();
        if (total == 0)
        {
            return new TaskEntropy
            {
                EntityId = entityId,
                EntityType = entityType,
                TaskDistribution = new Dictionary<string, int>(),
                EntropyValue = 0,
                TotalTasks = 0
            };
        }

        var entropy = 0.0;
        foreach (var count in distribution.Values)
        {
            if (count > 0)
            {
                var probability = (double)count / total;
                entropy -= probability * Math.Log2(probability);
            }
        }

        return new TaskEntropy
        {
            EntityId = entityId,
            EntityType = entityType,
            TaskDistribution = new Dictionary<string, int>(distribution),
            EntropyValue = entropy,
            TotalTasks = total
        };
    }

    /// <summary>
    /// Add a task execution to the distribution and recalculate entropy.
    /// </summary>
    public TaskEntropy AddTask(string taskType)
    {
        var newDistribution = new Dictionary<string, int>(TaskDistribution);
        newDistribution[taskType] = newDistribution.GetValueOrDefault(taskType, 0) + 1;
        return Calculate(EntityId, EntityType, newDistribution);
    }

    /// <summary>
    /// Create entropy for a single task type (perfectly specialized).
    /// </summary>
    public static TaskEntropy CreateSpecialized(string entityId, string entityType, string taskType, int count = 1)
    {
        return Calculate(entityId, entityType, new Dictionary<string, int> { { taskType, count } });
    }

    /// <summary>
    /// Create entropy for uniform distribution across task types (maximally diverse).
    /// </summary>
    public static TaskEntropy CreateUniform(string entityId, string entityType, IEnumerable<string> taskTypes, int countPerType = 10)
    {
        var distribution = taskTypes.ToDictionary(t => t, _ => countPerType);
        return Calculate(entityId, entityType, distribution);
    }

    /// <summary>
    /// Get the probability distribution.
    /// </summary>
    public IReadOnlyDictionary<string, double> GetProbabilityDistribution()
    {
        if (TotalTasks == 0) return new Dictionary<string, double>();
        return TaskDistribution.ToDictionary(kvp => kvp.Key, kvp => (double)kvp.Value / TotalTasks);
    }

    /// <summary>
    /// Get the effective number of task types (exponential of entropy).
    /// This represents how many equally-likely tasks the entropy corresponds to.
    /// </summary>
    public double EffectiveTaskTypes => Math.Pow(2, EntropyValue);

    /// <summary>
    /// Create a TaskEntropy from a feature count (for contract testing).
    /// Uses a uniform distribution across N synthetic features to produce
    /// a reasonable entropy proportional to the number of features tested.
    /// 1 feature → entropy 0 (specialized), N features → log2(N) (diverse).
    /// </summary>
    public static TaskEntropy FromFeatureCount(int featureCount)
    {
        if (featureCount <= 0)
        {
            return new TaskEntropy
            {
                EntityId = "contract-test",
                EntityType = "contract",
                TaskDistribution = new Dictionary<string, int>(),
                EntropyValue = 0,
                TotalTasks = 0
            };
        }

        // Build a uniform distribution with one task type per feature
        var distribution = new Dictionary<string, int>();
        for (var i = 0; i < featureCount; i++)
        {
            distribution[$"feature-{i}"] = 1;
        }

        return Calculate("contract-test", "contract", distribution);
    }
}
