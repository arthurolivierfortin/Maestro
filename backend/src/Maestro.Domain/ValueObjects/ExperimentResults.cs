using System;
using System.Collections.Generic;

namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Results from a completed training experiment.
/// </summary>
public record ExperimentResults
{
    public double InitialFitness { get; init; }
    public double FinalFitness { get; init; }

    public double FitnessImprovement => FinalFitness - InitialFitness;

    public double FitnessImprovementPercent => InitialFitness > 0
        ? (FitnessImprovement / InitialFitness) * 100
        : FinalFitness > 0 ? 100 : 0;

    public int TotalIterations { get; init; }
    public int SuccessfulIterations { get; init; }

    public double SuccessRate => TotalIterations > 0
        ? (double)SuccessfulIterations / TotalIterations
        : 0;

    public decimal TotalCost { get; init; }
    public TimeSpan TotalDuration { get; init; }

    public double CostEfficiency => TotalCost > 0
        ? FitnessImprovement / (double)TotalCost
        : FitnessImprovement > 0 ? double.MaxValue : 0;

    public double TimeEfficiency => TotalDuration.TotalMinutes > 0
        ? FitnessImprovement / TotalDuration.TotalMinutes
        : FitnessImprovement > 0 ? double.MaxValue : 0;

    public double FitnessPerIteration => TotalIterations > 0
        ? FitnessImprovement / TotalIterations
        : 0;

    public List<IterationSnapshot> Snapshots { get; init; } = new();
    public Dictionary<string, object> Metadata { get; init; } = new();

    /// <summary>
    /// Best fitness achieved during training (may be higher than final if overfitting occurred)
    /// </summary>
    public double BestFitness { get; init; }

    /// <summary>
    /// Iteration at which best fitness was achieved
    /// </summary>
    public int BestIteration { get; init; }

    /// <summary>
    /// Reason training stopped (convergence, early_stop, max_iterations, target_reached, error)
    /// </summary>
    public string StopReason { get; init; } = string.Empty;

    public static ExperimentResults Empty => new()
    {
        InitialFitness = 0,
        FinalFitness = 0,
        TotalIterations = 0,
        SuccessfulIterations = 0,
        TotalCost = 0,
        TotalDuration = TimeSpan.Zero,
        BestFitness = 0,
        BestIteration = 0,
        StopReason = "none"
    };

    public static ExperimentResults Create(
        double initialFitness,
        double finalFitness,
        int totalIterations,
        int successfulIterations,
        decimal totalCost,
        TimeSpan totalDuration,
        string stopReason,
        List<IterationSnapshot>? snapshots = null,
        Dictionary<string, object>? metadata = null)
    {
        var snapshotList = snapshots ?? new List<IterationSnapshot>();
        var bestSnapshot = snapshotList.Count > 0
            ? snapshotList.OrderByDescending(s => s.Fitness).First()
            : null;

        return new ExperimentResults
        {
            InitialFitness = initialFitness,
            FinalFitness = finalFitness,
            TotalIterations = totalIterations,
            SuccessfulIterations = successfulIterations,
            TotalCost = totalCost,
            TotalDuration = totalDuration,
            BestFitness = bestSnapshot?.Fitness ?? finalFitness,
            BestIteration = bestSnapshot?.Iteration ?? totalIterations,
            StopReason = stopReason,
            Snapshots = snapshotList,
            Metadata = metadata ?? new Dictionary<string, object>()
        };
    }
}

/// <summary>
/// Snapshot of training state at a specific iteration.
/// </summary>
public record IterationSnapshot
{
    public int Iteration { get; init; }
    public double Fitness { get; init; }
    public decimal Cost { get; init; }
    public DateTimeOffset Timestamp { get; init; }
    public bool Success { get; init; }
    public Dictionary<string, double> Metrics { get; init; } = new();
    public string? Error { get; init; }

    public static IterationSnapshot Create(
        int iteration,
        double fitness,
        decimal cost,
        bool success,
        Dictionary<string, double>? metrics = null,
        string? error = null)
    {
        return new IterationSnapshot
        {
            Iteration = iteration,
            Fitness = fitness,
            Cost = cost,
            Timestamp = DateTimeOffset.UtcNow,
            Success = success,
            Metrics = metrics ?? new Dictionary<string, double>(),
            Error = error
        };
    }
}
