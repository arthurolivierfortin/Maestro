using Maestro.Domain.Entities;

namespace Maestro.Application.DTOs;

/// <summary>
/// DTO for training configuration.
/// </summary>
public class TrainingConfigurationDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string WorkflowId { get; set; } = string.Empty;
    public int Iterations { get; set; }
    public int ParallelIterations { get; set; }
    public int DelayBetweenIterationsMs { get; set; }
    public string OptimizationGoal { get; set; } = string.Empty;
    public OptimizationWeightsDto? GoalWeights { get; set; }
    public InputVariationConfigDto InputVariation { get; set; } = new();
    public QualityEvaluationConfigDto QualityEvaluation { get; set; } = new();
    public TrainingConstraintsDto? Constraints { get; set; }
    public Dictionary<string, string> ModelOverrides { get; set; } = new();
    public Dictionary<string, string> EnvironmentVariables { get; set; } = new();
    public string? ContainerRuntimeType { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public List<string> Tags { get; set; } = new();
    public bool IsActive { get; set; }

    public static TrainingConfigurationDto FromDomain(TrainingConfiguration config)
    {
        return new TrainingConfigurationDto
        {
            Id = config.Id,
            Name = config.Name,
            Description = config.Description,
            WorkflowId = config.WorkflowId,
            Iterations = config.Iterations,
            ParallelIterations = config.ParallelIterations,
            DelayBetweenIterationsMs = config.DelayBetweenIterationsMs,
            OptimizationGoal = config.OptimizationGoal.ToString(),
            GoalWeights = config.GoalWeights != null ? new OptimizationWeightsDto
            {
                Cost = config.GoalWeights.Cost,
                Quality = config.GoalWeights.Quality,
                Speed = config.GoalWeights.Speed
            } : null,
            InputVariation = new InputVariationConfigDto
            {
                Type = config.InputVariation.Type.ToString(),
                FixedInputs = config.InputVariation.FixedInputs,
                DatasetPath = config.InputVariation.DatasetPath
            },
            QualityEvaluation = new QualityEvaluationConfigDto
            {
                Enabled = config.QualityEvaluation.Enabled,
                Method = config.QualityEvaluation.Method
            },
            Constraints = config.Constraints != null ? new TrainingConstraintsDto
            {
                MaxCostPerIteration = config.Constraints.MaxCostPerIteration,
                MaxDurationPerIteration = config.Constraints.MaxDurationPerIteration,
                StopOnFailure = config.Constraints.StopOnFailure,
                MinQualityScore = config.Constraints.MinQualityScore,
                MaxTotalCost = config.Constraints.MaxTotalCost
            } : null,
            ModelOverrides = config.ModelOverrides,
            EnvironmentVariables = config.EnvironmentVariables,
            ContainerRuntimeType = config.ContainerRuntimeType,
            CreatedAt = config.CreatedAt,
            UpdatedAt = config.UpdatedAt,
            CreatedBy = config.CreatedBy,
            Tags = config.Tags,
            IsActive = config.IsActive
        };
    }

    public TrainingConfiguration ToDomain()
    {
        return new TrainingConfiguration
        {
            Id = string.IsNullOrEmpty(Id) ? Guid.NewGuid().ToString() : Id,
            Name = Name,
            Description = Description,
            WorkflowId = WorkflowId,
            Iterations = Iterations,
            ParallelIterations = ParallelIterations,
            DelayBetweenIterationsMs = DelayBetweenIterationsMs,
            OptimizationGoal = Enum.TryParse<OptimizationGoal>(OptimizationGoal, true, out var goal)
                ? goal : Domain.Entities.OptimizationGoal.Balanced,
            GoalWeights = GoalWeights != null ? new OptimizationWeights
            {
                Cost = GoalWeights.Cost,
                Quality = GoalWeights.Quality,
                Speed = GoalWeights.Speed
            } : null,
            InputVariation = new InputVariationConfig
            {
                Type = Enum.TryParse<InputVariationType>(InputVariation.Type, true, out var inputType)
                    ? inputType : InputVariationType.Fixed,
                FixedInputs = InputVariation.FixedInputs,
                DatasetPath = InputVariation.DatasetPath
            },
            QualityEvaluation = new QualityEvaluationConfig
            {
                Enabled = QualityEvaluation.Enabled,
                Method = QualityEvaluation.Method
            },
            Constraints = Constraints != null ? new TrainingConstraints
            {
                MaxCostPerIteration = Constraints.MaxCostPerIteration,
                MaxDurationPerIteration = Constraints.MaxDurationPerIteration,
                StopOnFailure = Constraints.StopOnFailure,
                MinQualityScore = Constraints.MinQualityScore,
                MaxTotalCost = Constraints.MaxTotalCost
            } : null,
            ModelOverrides = ModelOverrides,
            EnvironmentVariables = EnvironmentVariables,
            ContainerRuntimeType = ContainerRuntimeType,
            CreatedAt = CreatedAt == default ? DateTimeOffset.UtcNow : CreatedAt,
            UpdatedAt = DateTimeOffset.UtcNow,
            CreatedBy = CreatedBy,
            Tags = Tags,
            IsActive = IsActive
        };
    }
}

public class OptimizationWeightsDto
{
    public double Cost { get; set; }
    public double Quality { get; set; }
    public double Speed { get; set; }
}

public class InputVariationConfigDto
{
    public string Type { get; set; } = "Fixed";
    public Dictionary<string, object>? FixedInputs { get; set; }
    public string? DatasetPath { get; set; }
}

public class QualityEvaluationConfigDto
{
    public bool Enabled { get; set; }
    public string Method { get; set; } = "none";
}

public class TrainingConstraintsDto
{
    public decimal? MaxCostPerIteration { get; set; }
    public long? MaxDurationPerIteration { get; set; }
    public bool StopOnFailure { get; set; }
    public int? MinQualityScore { get; set; }
    public decimal? MaxTotalCost { get; set; }
}

/// <summary>
/// DTO for training run.
/// </summary>
public class TrainingRunDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string WorkflowId { get; set; } = string.Empty;
    public string ConfigurationId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int TotalIterations { get; set; }
    public int CompletedIterations { get; set; }
    public int FailedIterations { get; set; }
    public int ParallelIterations { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public TrainingRunMetricsDto? Metrics { get; set; }
    public List<TrainingIterationDto> Iterations { get; set; } = new();
    public string? ErrorMessage { get; set; }
    public string? InitiatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public List<string> Tags { get; set; } = new();

    public static TrainingRunDto FromDomain(TrainingRun run)
    {
        return new TrainingRunDto
        {
            Id = run.Id,
            Name = run.Name,
            WorkflowId = run.WorkflowId,
            ConfigurationId = run.ConfigurationId,
            Status = run.Status.ToString(),
            TotalIterations = run.TotalIterations,
            CompletedIterations = run.CompletedIterations,
            FailedIterations = run.FailedIterations,
            ParallelIterations = run.ParallelIterations,
            StartedAt = run.StartedAt,
            CompletedAt = run.CompletedAt,
            Metrics = run.Metrics != null ? TrainingRunMetricsDto.FromDomain(run.Metrics) : null,
            Iterations = run.Iterations.Select(TrainingIterationDto.FromDomain).ToList(),
            ErrorMessage = run.ErrorMessage,
            InitiatedBy = run.InitiatedBy,
            CreatedAt = run.CreatedAt,
            Tags = run.Tags
        };
    }
}

/// <summary>
/// DTO for training run metrics.
/// </summary>
public class TrainingRunMetricsDto
{
    public string TrainingRunId { get; set; } = string.Empty;
    public string WorkflowId { get; set; } = string.Empty;
    public int TotalIterations { get; set; }
    public int CompletedIterations { get; set; }
    public int FailedIterations { get; set; }
    public long AverageDurationMs { get; set; }
    public double DurationVarianceMs { get; set; }
    public long MinDurationMs { get; set; }
    public long MaxDurationMs { get; set; }
    public decimal AverageCostUsd { get; set; }
    public decimal TotalCostUsd { get; set; }
    public decimal CostVarianceUsd { get; set; }
    public int? AverageQualityScore { get; set; }
    public double? QualityVariance { get; set; }
    public int ConsistencyScore { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public string Status { get; set; } = string.Empty;

    public static TrainingRunMetricsDto FromDomain(TrainingRunMetrics metrics)
    {
        return new TrainingRunMetricsDto
        {
            TrainingRunId = metrics.TrainingRunId,
            WorkflowId = metrics.WorkflowId,
            TotalIterations = metrics.TotalIterations,
            CompletedIterations = metrics.CompletedIterations,
            FailedIterations = metrics.FailedIterations,
            AverageDurationMs = metrics.AverageDurationMs,
            DurationVarianceMs = metrics.DurationVarianceMs,
            MinDurationMs = metrics.MinDurationMs,
            MaxDurationMs = metrics.MaxDurationMs,
            AverageCostUsd = metrics.AverageCostUsd,
            TotalCostUsd = metrics.TotalCostUsd,
            CostVarianceUsd = metrics.CostVarianceUsd,
            AverageQualityScore = metrics.AverageQualityScore,
            QualityVariance = metrics.QualityVariance,
            ConsistencyScore = metrics.ConsistencyScore,
            StartedAt = metrics.StartedAt,
            CompletedAt = metrics.CompletedAt,
            Status = metrics.Status
        };
    }
}

/// <summary>
/// DTO for training iteration.
/// </summary>
public class TrainingIterationDto
{
    public int IterationNumber { get; set; }
    public string ExecutionId { get; set; } = string.Empty;
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public WorkflowExecutionMetricsDto? Metrics { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    public static TrainingIterationDto FromDomain(TrainingIteration iteration)
    {
        return new TrainingIterationDto
        {
            IterationNumber = iteration.IterationNumber,
            ExecutionId = iteration.ExecutionId,
            Success = iteration.Success,
            ErrorMessage = iteration.ErrorMessage,
            Metrics = iteration.Metrics != null
                ? WorkflowExecutionMetricsDto.FromDomain(iteration.Metrics)
                : null,
            StartedAt = iteration.StartedAt,
            CompletedAt = iteration.CompletedAt
        };
    }
}

/// <summary>
/// Request to create a training configuration.
/// </summary>
public class CreateTrainingConfigRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string WorkflowId { get; set; } = string.Empty;
    public int Iterations { get; set; } = 10;
    public int ParallelIterations { get; set; } = 1;
    public string OptimizationGoal { get; set; } = "Balanced";
    public QualityEvaluationConfigDto? QualityEvaluation { get; set; }
    public TrainingConstraintsDto? Constraints { get; set; }
    public Dictionary<string, string>? ModelOverrides { get; set; }
    public List<string>? Tags { get; set; }
}

/// <summary>
/// Request to start a training run.
/// </summary>
public class StartTrainingRunRequest
{
    public string? Name { get; set; }
    public string? InitiatedBy { get; set; }
    public Dictionary<string, object>? Inputs { get; set; }
}
