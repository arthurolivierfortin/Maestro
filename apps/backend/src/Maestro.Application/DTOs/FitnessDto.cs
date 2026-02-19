using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.DTOs;

/// <summary>
/// DTO for fitness score.
/// </summary>
public class FitnessScoreDto
{
    public double Performance { get; set; }
    public double Specialization { get; set; }
    public double Composability { get; set; }
    public double EconomicCost { get; set; }
    public double ComputeCost { get; set; }
    public double HardwareCost { get; set; }
    public double Lambda { get; set; }
    public string ModelId { get; set; } = string.Empty;
    public string TaskType { get; set; } = string.Empty;
    public double TotalFitness { get; set; }
    public DateTimeOffset CalculatedAt { get; set; }

    public static FitnessScoreDto FromDomain(FitnessScore score)
    {
        return new FitnessScoreDto
        {
            Performance = score.Performance,
            Specialization = score.Specialization,
            Composability = score.Composability,
            EconomicCost = score.EconomicCost,
            ComputeCost = score.ComputeCost,
            HardwareCost = score.HardwareCost,
            Lambda = score.Lambda,
            ModelId = score.ModelId,
            TaskType = score.TaskType,
            TotalFitness = score.TotalFitness,
            CalculatedAt = score.CalculatedAt
        };
    }

    public FitnessScore ToDomain()
    {
        return FitnessScore.Create(
            Performance,
            Specialization,
            Composability,
            EconomicCost,
            ComputeCost,
            HardwareCost,
            Lambda,
            ModelId,
            TaskType
        );
    }
}

/// <summary>
/// DTO for fitness breakdown.
/// </summary>
public class FitnessBreakdownDto
{
    public double Performance { get; set; }
    public double Specialization { get; set; }
    public double Composability { get; set; }
    public double EconomicCost { get; set; }
    public double ComputeCost { get; set; }
    public double HardwareCost { get; set; }
    public double TotalFitness { get; set; }
    public double Numerator { get; set; }
    public double CombinedCost { get; set; }

    public static FitnessBreakdownDto FromDomain(FitnessBreakdown breakdown)
    {
        return new FitnessBreakdownDto
        {
            Performance = breakdown.Performance,
            Specialization = breakdown.Specialization,
            Composability = breakdown.Composability,
            EconomicCost = breakdown.EconomicCost,
            ComputeCost = breakdown.ComputeCost,
            HardwareCost = breakdown.HardwareCost,
            TotalFitness = breakdown.TotalFitness,
            Numerator = breakdown.Numerator,
            CombinedCost = breakdown.CombinedCost
        };
    }
}

/// <summary>
/// DTO for model profile.
/// </summary>
public class ModelProfileDto
{
    public string ModelId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public double ParametersBillions { get; set; }
    public double FlopsPerToken { get; set; }
    public double VramGb { get; set; }
    public double RamGb { get; set; }
    public double GpuRequirement { get; set; }
    public decimal CostPerMillionInputTokens { get; set; }
    public decimal CostPerMillionOutputTokens { get; set; }
    public int ContextWindowSize { get; set; }
    public bool IsLocal { get; set; }
    public double AvgLatencyMsPerToken { get; set; }
    public List<string> Specializations { get; set; } = new();
    public DateTimeOffset UpdatedAt { get; set; }

    // Computed properties
    public double ComputeCost { get; set; }
    public double HardwareCost { get; set; }
    public decimal AverageCostPerMillion { get; set; }

    public static ModelProfileDto FromDomain(ModelProfile profile)
    {
        return new ModelProfileDto
        {
            ModelId = profile.ModelId,
            DisplayName = profile.DisplayName,
            Provider = profile.Provider,
            ParametersBillions = profile.ParametersBillions,
            FlopsPerToken = profile.FlopsPerToken,
            VramGb = profile.VramGb,
            RamGb = profile.RamGb,
            GpuRequirement = profile.GpuRequirement,
            CostPerMillionInputTokens = profile.CostPerMillionInputTokens,
            CostPerMillionOutputTokens = profile.CostPerMillionOutputTokens,
            ContextWindowSize = profile.ContextWindowSize,
            IsLocal = profile.IsLocal,
            AvgLatencyMsPerToken = profile.AvgLatencyMsPerToken,
            Specializations = profile.Specializations.ToList(),
            UpdatedAt = profile.UpdatedAt,
            ComputeCost = profile.ComputeCost,
            HardwareCost = profile.HardwareCost,
            AverageCostPerMillion = profile.AverageCostPerMillion
        };
    }

    public ModelProfile ToDomain()
    {
        return new ModelProfile
        {
            ModelId = ModelId,
            DisplayName = DisplayName,
            Provider = Provider,
            ParametersBillions = ParametersBillions,
            FlopsPerToken = FlopsPerToken,
            VramGb = VramGb,
            RamGb = RamGb,
            GpuRequirement = GpuRequirement,
            CostPerMillionInputTokens = CostPerMillionInputTokens,
            CostPerMillionOutputTokens = CostPerMillionOutputTokens,
            ContextWindowSize = ContextWindowSize,
            IsLocal = IsLocal,
            AvgLatencyMsPerToken = AvgLatencyMsPerToken,
            Specializations = Specializations,
            UpdatedAt = UpdatedAt == default ? DateTimeOffset.UtcNow : UpdatedAt
        };
    }
}

/// <summary>
/// DTO for task entropy.
/// </summary>
public class TaskEntropyDto
{
    public string EntityId { get; set; } = string.Empty;
    public string EntityType { get; set; } = "model";
    public Dictionary<string, int> TaskDistribution { get; set; } = new();
    public double EntropyValue { get; set; }
    public int TotalTasks { get; set; }
    public int UniqueTaskTypes { get; set; }
    public double MaxEntropy { get; set; }
    public double NormalizedEntropy { get; set; }
    public double SpecializationScore { get; set; }
    public string? DominantTaskType { get; set; }
    public DateTimeOffset CalculatedAt { get; set; }

    public static TaskEntropyDto FromDomain(TaskEntropy entropy)
    {
        return new TaskEntropyDto
        {
            EntityId = entropy.EntityId,
            EntityType = entropy.EntityType,
            TaskDistribution = new Dictionary<string, int>(entropy.TaskDistribution),
            EntropyValue = entropy.EntropyValue,
            TotalTasks = entropy.TotalTasks,
            UniqueTaskTypes = entropy.UniqueTaskTypes,
            MaxEntropy = entropy.MaxEntropy,
            NormalizedEntropy = entropy.NormalizedEntropy,
            SpecializationScore = entropy.SpecializationScore,
            DominantTaskType = entropy.DominantTaskType,
            CalculatedAt = entropy.CalculatedAt
        };
    }
}

/// <summary>
/// DTO for fitness configuration.
/// </summary>
public class FitnessConfigDto
{
    public double Lambda { get; set; }
    public double VramWeight { get; set; }
    public double RamWeight { get; set; }
    public double GpuWeight { get; set; }
    public decimal BaselineCostPerMillion { get; set; }
    public double RetryPenaltyFactor { get; set; }
    public double MinimumFitnessThreshold { get; set; }
    public double MaximumFitnessScore { get; set; }
    public double PerformanceWeight { get; set; }
    public double SpecializationWeight { get; set; }
    public double ComposabilityWeight { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public static FitnessConfigDto FromDomain(FitnessConfig config)
    {
        return new FitnessConfigDto
        {
            Lambda = config.Lambda,
            VramWeight = config.VramWeight,
            RamWeight = config.RamWeight,
            GpuWeight = config.GpuWeight,
            BaselineCostPerMillion = config.BaselineCostPerMillion,
            RetryPenaltyFactor = config.RetryPenaltyFactor,
            MinimumFitnessThreshold = config.MinimumFitnessThreshold,
            MaximumFitnessScore = config.MaximumFitnessScore,
            PerformanceWeight = config.PerformanceWeight,
            SpecializationWeight = config.SpecializationWeight,
            ComposabilityWeight = config.ComposabilityWeight,
            UpdatedAt = config.UpdatedAt
        };
    }

    public FitnessConfig ToDomain()
    {
        return new FitnessConfig
        {
            Lambda = Lambda,
            VramWeight = VramWeight,
            RamWeight = RamWeight,
            GpuWeight = GpuWeight,
            BaselineCostPerMillion = BaselineCostPerMillion,
            RetryPenaltyFactor = RetryPenaltyFactor,
            MinimumFitnessThreshold = MinimumFitnessThreshold,
            MaximumFitnessScore = MaximumFitnessScore,
            PerformanceWeight = PerformanceWeight,
            SpecializationWeight = SpecializationWeight,
            ComposabilityWeight = ComposabilityWeight,
            UpdatedAt = UpdatedAt == default ? DateTimeOffset.UtcNow : UpdatedAt
        };
    }
}

/// <summary>
/// DTO for model fitness ranking.
/// </summary>
public class ModelFitnessRankingDto
{
    public int Rank { get; set; }
    public string ModelId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public double AverageFitness { get; set; }
    public int ExecutionCount { get; set; }
    public double BestFitness { get; set; }
    public string? TaskType { get; set; }
    public FitnessBreakdownDto? Breakdown { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public static ModelFitnessRankingDto FromDomain(ModelFitnessRanking ranking)
    {
        return new ModelFitnessRankingDto
        {
            Rank = ranking.Rank,
            ModelId = ranking.ModelId,
            DisplayName = ranking.DisplayName,
            Provider = ranking.Provider,
            AverageFitness = ranking.AverageFitness,
            ExecutionCount = ranking.ExecutionCount,
            BestFitness = ranking.BestFitness,
            TaskType = ranking.TaskType,
            Breakdown = ranking.Breakdown != null ? FitnessBreakdownDto.FromDomain(ranking.Breakdown) : null,
            UpdatedAt = ranking.UpdatedAt
        };
    }
}

/// <summary>
/// DTO for aggregate fitness statistics.
/// </summary>
public class AggregateFitnessStatsDto
{
    public double AverageFitness { get; set; }
    public double MinFitness { get; set; }
    public double MaxFitness { get; set; }
    public double FitnessVariance { get; set; }
    public double FitnessStdDev { get; set; }
    public int SampleCount { get; set; }
    public FitnessBreakdownDto? AverageBreakdown { get; set; }

    public static AggregateFitnessStatsDto FromDomain(AggregateFitnessStats stats)
    {
        return new AggregateFitnessStatsDto
        {
            AverageFitness = stats.AverageFitness,
            MinFitness = stats.MinFitness,
            MaxFitness = stats.MaxFitness,
            FitnessVariance = stats.FitnessVariance,
            FitnessStdDev = stats.FitnessStdDev,
            SampleCount = stats.SampleCount,
            AverageBreakdown = FitnessBreakdownDto.FromDomain(stats.AverageBreakdown)
        };
    }
}

#region Request DTOs

/// <summary>
/// Request to calculate fitness for an execution.
/// </summary>
public class CalculateFitnessRequest
{
    /// <summary>
    /// The execution ID to calculate fitness for.
    /// </summary>
    public string? ExecutionId { get; set; }

    /// <summary>
    /// The model ID used in the execution.
    /// </summary>
    public string ModelId { get; set; } = string.Empty;

    /// <summary>
    /// The task type (for specialization calculation).
    /// </summary>
    public string TaskType { get; set; } = "general";

    /// <summary>
    /// Optional execution metrics (if not fetching by ExecutionId).
    /// </summary>
    public WorkflowExecutionMetricsDto? Metrics { get; set; }
}

/// <summary>
/// Request to update a model profile.
/// </summary>
public class UpdateModelProfileRequest
{
    public string? DisplayName { get; set; }
    public double? ParametersBillions { get; set; }
    public double? FlopsPerToken { get; set; }
    public double? VramGb { get; set; }
    public double? RamGb { get; set; }
    public double? GpuRequirement { get; set; }
    public decimal? CostPerMillionInputTokens { get; set; }
    public decimal? CostPerMillionOutputTokens { get; set; }
    public int? ContextWindowSize { get; set; }
    public bool? IsLocal { get; set; }
    public double? AvgLatencyMsPerToken { get; set; }
    public List<string>? Specializations { get; set; }
}

/// <summary>
/// Request to update fitness configuration.
/// </summary>
public class UpdateFitnessConfigRequest
{
    public double? Lambda { get; set; }
    public double? VramWeight { get; set; }
    public double? RamWeight { get; set; }
    public double? GpuWeight { get; set; }
    public decimal? BaselineCostPerMillion { get; set; }
    public double? RetryPenaltyFactor { get; set; }
    public double? MinimumFitnessThreshold { get; set; }
    public double? MaximumFitnessScore { get; set; }
    public double? PerformanceWeight { get; set; }
    public double? SpecializationWeight { get; set; }
    public double? ComposabilityWeight { get; set; }
}

#endregion
