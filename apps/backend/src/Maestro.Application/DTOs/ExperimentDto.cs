using System;
using System.Collections.Generic;
using System.Linq;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.DTOs;

public record ExperimentDto
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string WorkspaceId { get; init; } = string.Empty;
    public string TargetAgentId { get; init; } = string.Empty;
    public string StrategyBlockId { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public Dictionary<string, object> Config { get; init; } = new();
    public List<string> SessionIds { get; init; } = new();
    public ExperimentResultsDto? Results { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? StartedAt { get; init; }
    public DateTimeOffset? CompletedAt { get; init; }
    public string? Error { get; init; }
    public int CurrentIteration { get; init; }
    public double CurrentFitness { get; init; }

    public static ExperimentDto FromDomain(TrainingExperiment experiment) => new()
    {
        Id = experiment.Id,
        Name = experiment.Name,
        WorkspaceId = experiment.WorkspaceId,
        TargetAgentId = experiment.TargetAgentId,
        StrategyBlockId = experiment.StrategyBlockId,
        Status = experiment.Status.ToString(),
        Config = experiment.Config,
        SessionIds = experiment.SessionIds,
        Results = experiment.Results != null
            ? ExperimentResultsDto.FromDomain(experiment.Results)
            : null,
        CreatedAt = experiment.CreatedAt,
        StartedAt = experiment.StartedAt,
        CompletedAt = experiment.CompletedAt,
        Error = experiment.Error,
        CurrentIteration = experiment.CurrentIteration,
        CurrentFitness = experiment.CurrentFitness
    };
}

public record ExperimentResultsDto
{
    public double InitialFitness { get; init; }
    public double FinalFitness { get; init; }
    public double FitnessImprovement { get; init; }
    public double FitnessImprovementPercent { get; init; }
    public int TotalIterations { get; init; }
    public int SuccessfulIterations { get; init; }
    public double SuccessRate { get; init; }
    public decimal TotalCost { get; init; }
    public string TotalDuration { get; init; } = string.Empty;
    public double CostEfficiency { get; init; }
    public double TimeEfficiency { get; init; }
    public double BestFitness { get; init; }
    public int BestIteration { get; init; }
    public string StopReason { get; init; } = string.Empty;
    public List<IterationSnapshotDto> Snapshots { get; init; } = new();

    public static ExperimentResultsDto FromDomain(ExperimentResults results) => new()
    {
        InitialFitness = results.InitialFitness,
        FinalFitness = results.FinalFitness,
        FitnessImprovement = results.FitnessImprovement,
        FitnessImprovementPercent = results.FitnessImprovementPercent,
        TotalIterations = results.TotalIterations,
        SuccessfulIterations = results.SuccessfulIterations,
        SuccessRate = results.SuccessRate,
        TotalCost = results.TotalCost,
        TotalDuration = results.TotalDuration.ToString(),
        CostEfficiency = double.IsInfinity(results.CostEfficiency) ? 0 : results.CostEfficiency,
        TimeEfficiency = double.IsInfinity(results.TimeEfficiency) ? 0 : results.TimeEfficiency,
        BestFitness = results.BestFitness,
        BestIteration = results.BestIteration,
        StopReason = results.StopReason,
        Snapshots = results.Snapshots.Select(IterationSnapshotDto.FromDomain).ToList()
    };
}

public record IterationSnapshotDto
{
    public int Iteration { get; init; }
    public double Fitness { get; init; }
    public decimal Cost { get; init; }
    public DateTimeOffset Timestamp { get; init; }
    public bool Success { get; init; }
    public Dictionary<string, double> Metrics { get; init; } = new();
    public string? Error { get; init; }

    public static IterationSnapshotDto FromDomain(IterationSnapshot snapshot) => new()
    {
        Iteration = snapshot.Iteration,
        Fitness = snapshot.Fitness,
        Cost = snapshot.Cost,
        Timestamp = snapshot.Timestamp,
        Success = snapshot.Success,
        Metrics = snapshot.Metrics,
        Error = snapshot.Error
    };
}

public record CreateExperimentRequest
{
    public string Name { get; init; } = string.Empty;
    public string WorkspaceId { get; init; } = string.Empty;
    public string AgentId { get; init; } = string.Empty;
    public string StrategyId { get; init; } = string.Empty;
    public Dictionary<string, object>? Config { get; init; }
}

public record UpdateExperimentRequest
{
    public string? Name { get; init; }
    public Dictionary<string, object>? Config { get; init; }
}

public record CompareExperimentsRequest
{
    public List<string> ExperimentIds { get; init; } = new();
}

public record ExperimentComparisonDto
{
    public List<ExperimentDto> Experiments { get; init; } = new();
    public string BestExperimentId { get; init; } = string.Empty;
    public string RecommendedStrategyId { get; init; } = string.Empty;
    public Dictionary<string, ExperimentRankingDto> Rankings { get; init; } = new();
    public ComparisonSummaryDto Summary { get; init; } = new();
}

public record ExperimentRankingDto
{
    public int FitnessRank { get; init; }
    public int CostEfficiencyRank { get; init; }
    public int TimeEfficiencyRank { get; init; }
    public int OverallRank { get; init; }
    public double Score { get; init; }
}

public record ComparisonSummaryDto
{
    public double BestFitness { get; init; }
    public double AverageFitness { get; init; }
    public double BestCostEfficiency { get; init; }
    public string MostEffectiveStrategy { get; init; } = string.Empty;
    public int TotalIterationsAcrossAll { get; init; }
    public decimal TotalCostAcrossAll { get; init; }
}

public record StrategyInfoDto
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Method { get; init; } = string.Empty;
    public string Category { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public List<string> SuitableFor { get; init; } = new();
    public List<string> Strengths { get; init; } = new();
    public List<string> Weaknesses { get; init; } = new();
    public EstimatedResourcesDto? EstimatedResources { get; init; }
    public bool IsSystem { get; init; }
    public bool IsOverridable { get; init; }
}

public record EstimatedResourcesDto
{
    public int MinIterations { get; init; }
    public int TypicalIterations { get; init; }
    public int MaxIterations { get; init; }
    public string CostPerIteration { get; init; } = string.Empty;
}

public record StrategyRecommendationDto
{
    public string StrategyId { get; init; } = string.Empty;
    public string StrategyName { get; init; } = string.Empty;
    public double ConfidenceScore { get; init; }
    public string Reasoning { get; init; } = string.Empty;
    public List<string> Pros { get; init; } = new();
    public List<string> Cons { get; init; } = new();
}
