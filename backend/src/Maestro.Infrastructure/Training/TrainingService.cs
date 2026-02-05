using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.Metrics;
using Maestro.Infrastructure.Orchestration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Training;

/// <summary>
/// Service for managing and executing training runs.
/// </summary>
public class TrainingService : ITrainingService
{
    private readonly ITrainingConfigurationRepository _configRepository;
    private readonly ITrainingRunRepository _runRepository;
    private readonly IBlockDiscoveryService _blockDiscoveryService;
    private readonly MetricsCollector _metricsCollector;
    private readonly IServiceScopeFactory _serviceScopeFactory;
    private readonly IFitnessService? _fitnessService;
    private readonly ILogger<TrainingService>? _logger;

    // Active training run cancellation tokens
    private static readonly Dictionary<string, CancellationTokenSource> _activeRuns = new();
    private static readonly object _lock = new();

    public TrainingService(
        ITrainingConfigurationRepository configRepository,
        ITrainingRunRepository runRepository,
        IBlockDiscoveryService blockDiscoveryService,
        MetricsCollector metricsCollector,
        IServiceScopeFactory serviceScopeFactory,
        IFitnessService? fitnessService = null,
        ILogger<TrainingService>? logger = null)
    {
        _configRepository = configRepository;
        _runRepository = runRepository;
        _blockDiscoveryService = blockDiscoveryService;
        _metricsCollector = metricsCollector;
        _serviceScopeFactory = serviceScopeFactory;
        _fitnessService = fitnessService;
        _logger = logger;
    }

    public async Task<TrainingConfiguration> CreateConfigurationAsync(TrainingConfiguration config, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(config.Id))
        {
            config.Id = Guid.NewGuid().ToString();
        }

        config.CreatedAt = DateTimeOffset.UtcNow;
        config.UpdatedAt = DateTimeOffset.UtcNow;

        await _configRepository.SaveAsync(config, ct);

        _logger?.LogInformation("Created training configuration {Id}: {Name}", config.Id, config.Name);

        return config;
    }

    public async Task<TrainingConfiguration> UpdateConfigurationAsync(TrainingConfiguration config, CancellationToken ct = default)
    {
        config.UpdatedAt = DateTimeOffset.UtcNow;
        await _configRepository.SaveAsync(config, ct);

        _logger?.LogInformation("Updated training configuration {Id}", config.Id);

        return config;
    }

    public Task<TrainingConfiguration?> GetConfigurationAsync(string id, CancellationToken ct = default)
    {
        return _configRepository.GetByIdAsync(id, ct);
    }

    public Task<IReadOnlyList<TrainingConfiguration>> GetAllConfigurationsAsync(CancellationToken ct = default)
    {
        return _configRepository.GetAllAsync(ct);
    }

    public async Task DeleteConfigurationAsync(string id, CancellationToken ct = default)
    {
        await _configRepository.DeleteAsync(id, ct);
        _logger?.LogInformation("Deleted training configuration {Id}", id);
    }

    public async Task<TrainingRun> StartRunAsync(
        string configurationId,
        string? name = null,
        string? initiatedBy = null,
        Dictionary<string, object>? inputs = null,
        CancellationToken ct = default)
    {
        var config = await _configRepository.GetByIdAsync(configurationId, ct);
        if (config == null)
        {
            throw new ArgumentException($"Training configuration {configurationId} not found");
        }

        var run = new TrainingRun
        {
            Id = Guid.NewGuid().ToString(),
            Name = name ?? $"Training Run - {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm}",
            WorkflowId = config.WorkflowId,
            ConfigurationId = configurationId,
            TotalIterations = config.Iterations,
            ParallelIterations = config.ParallelIterations,
            InitiatedBy = initiatedBy,
            Tags = config.Tags.ToList()
        };

        await _runRepository.SaveAsync(run, ct);

        _logger?.LogInformation("Created training run {RunId} for configuration {ConfigId}",
            run.Id, configurationId);

        // Start execution in background
        var cts = new CancellationTokenSource();
        lock (_lock)
        {
            _activeRuns[run.Id] = cts;
        }

        _ = ExecuteRunAsync(run, config, inputs, cts.Token);

        return run;
    }

    private async Task ExecuteRunAsync(
        TrainingRun run,
        TrainingConfiguration config,
        Dictionary<string, object>? inputs,
        CancellationToken ct)
    {
        // Create a new scope for background execution to avoid disposed services
        using var scope = _serviceScopeFactory.CreateScope();
        var workflowExecutor = scope.ServiceProvider.GetRequiredService<IWorkflowExecutor>();
        var runRepository = scope.ServiceProvider.GetRequiredService<ITrainingRunRepository>();

        try
        {
            run.Start();
            await runRepository.SaveAsync(run, ct);

            _logger?.LogInformation("Started training run {RunId}: {TotalIterations} iterations",
                run.Id, run.TotalIterations);

            // Execute iterations
            var semaphore = new SemaphoreSlim(config.ParallelIterations);
            var tasks = new List<Task>();

            for (int i = 1; i <= run.TotalIterations; i++)
            {
                if (ct.IsCancellationRequested)
                {
                    break;
                }

                // Check if paused
                while (run.Status == TrainingRunStatus.Paused)
                {
                    await Task.Delay(1000, ct);
                    run = await runRepository.GetByIdAsync(run.Id, ct) ?? run;
                }

                if (run.Status == TrainingRunStatus.Cancelled)
                {
                    break;
                }

                await semaphore.WaitAsync(ct);
                var iterationNumber = i;

                tasks.Add(Task.Run(async () =>
                {
                    // Each iteration gets its own scope for proper service lifetime
                    using var iterationScope = _serviceScopeFactory.CreateScope();
                    var iterationExecutor = iterationScope.ServiceProvider.GetRequiredService<IWorkflowExecutor>();
                    var iterationRunRepo = iterationScope.ServiceProvider.GetRequiredService<ITrainingRunRepository>();

                    try
                    {
                        await ExecuteIterationAsync(run, config, iterationNumber, inputs, iterationExecutor, iterationRunRepo, ct);
                    }
                    finally
                    {
                        semaphore.Release();
                    }
                }, ct));

                // Delay between iterations
                if (config.DelayBetweenIterationsMs > 0 && i < run.TotalIterations)
                {
                    await Task.Delay(config.DelayBetweenIterationsMs, ct);
                }
            }

            await Task.WhenAll(tasks);

            // Complete the run - refresh state first
            run = await runRepository.GetByIdAsync(run.Id, ct) ?? run;
            run.Complete();
            await runRepository.SaveAsync(run, ct);

            _logger?.LogInformation("Completed training run {RunId}: {Completed}/{Total} iterations succeeded",
                run.Id, run.CompletedIterations, run.TotalIterations);
        }
        catch (OperationCanceledException)
        {
            run.Cancel();
            await runRepository.SaveAsync(run);
            _logger?.LogInformation("Training run {RunId} was cancelled", run.Id);
        }
        catch (Exception ex)
        {
            run.Fail(ex.Message);
            await runRepository.SaveAsync(run);
            _logger?.LogError(ex, "Training run {RunId} failed", run.Id);
        }
        finally
        {
            lock (_lock)
            {
                _activeRuns.Remove(run.Id);
            }
        }
    }

    private async Task ExecuteIterationAsync(
        TrainingRun run,
        TrainingConfiguration config,
        int iterationNumber,
        Dictionary<string, object>? inputs,
        IWorkflowExecutor workflowExecutor,
        ITrainingRunRepository runRepository,
        CancellationToken ct)
    {
        var executionId = $"{run.Id}-iter-{iterationNumber}";
        var startedAt = DateTimeOffset.UtcNow;

        _logger?.LogDebug("Starting iteration {Iteration} of training run {RunId}",
            iterationNumber, run.Id);

        var iteration = new TrainingIteration
        {
            IterationNumber = iterationNumber,
            ExecutionId = executionId,
            StartedAt = startedAt
        };

        try
        {
            // Prepare inputs based on config
            var iterationInputs = PrepareIterationInputs(config, iterationNumber, inputs);

            // Load the actual workflow from block discovery service
            var workflowBlock = await _blockDiscoveryService.GetByIdAsync(config.WorkflowId, ct);
            if (workflowBlock == null)
            {
                throw new InvalidOperationException($"Workflow {config.WorkflowId} not found");
            }

            _logger?.LogInformation("Executing workflow {WorkflowId} for iteration {Iteration}",
                config.WorkflowId, iterationNumber);

            // Build workflow definition from block
            // For training purposes, we execute the workflow block directly
            var workflow = new WorkflowDefinition(
                config.WorkflowId,
                new List<Domain.Entities.BlockDefinition> { workflowBlock },
                new List<ConnectionDefinition>()
            );

            // Start metrics tracking
            await _metricsCollector.BeginExecutionAsync(executionId, config.WorkflowId, ct);
            _metricsCollector.SetTrainingContext(executionId, run.Id, iterationNumber);

            // Execute workflow
            var result = await workflowExecutor.ExecuteAsync(
                workflow,
                iterationInputs,
                new ExecutionOptions { MaxRetries = 2 },
                ct: ct);

            _logger?.LogInformation("Iteration {Iteration} completed: Success={Success}, Error={Error}",
                iterationNumber, result.Success, result.Error ?? "none");

            // Complete metrics
            var metrics = await _metricsCollector.CompleteExecutionAsync(
                executionId,
                result.Success ? "Completed" : "Failed",
                result.Error,
                ct: ct);

            iteration.Success = result.Success;
            iteration.ErrorMessage = result.Error;
            iteration.Metrics = metrics;
            iteration.CompletedAt = DateTimeOffset.UtcNow;

            // Calculate fitness score if service is available
            if (_fitnessService != null && metrics != null)
            {
                try
                {
                    // Determine model ID from metrics (use first model or default)
                    var modelId = metrics.TokensByModel.Keys.FirstOrDefault() ?? "unknown";
                    var taskType = workflowBlock.BlockType ?? "general";

                    var fitnessScore = await _fitnessService.CalculateFitnessAsync(
                        metrics, modelId, taskType, ct);

                    iteration.FitnessScore = fitnessScore;

                    // Record for historical tracking
                    await _fitnessService.RecordFitnessAsync(fitnessScore, ct);

                    _logger?.LogDebug(
                        "Iteration {Iteration} fitness: {Fitness:F3} (P={P:F3}, S={S:F3}, W={W:F3})",
                        iterationNumber,
                        fitnessScore.TotalFitness,
                        fitnessScore.Performance,
                        fitnessScore.Specialization,
                        fitnessScore.Composability);
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex, "Failed to calculate fitness for iteration {Iteration}", iterationNumber);
                }
            }

            // Check constraints
            if (config.Constraints != null)
            {
                if (config.Constraints.StopOnFailure && !result.Success)
                {
                    _logger?.LogWarning("Stopping training run {RunId} due to failure in iteration {Iteration}",
                        run.Id, iterationNumber);
                    run.Fail($"Iteration {iterationNumber} failed: {result.Error}");
                }

                if (config.Constraints.MaxTotalCost.HasValue)
                {
                    var totalCost = run.Iterations.Sum(i => i.Metrics?.TotalCostUsd ?? 0) + metrics.TotalCostUsd;
                    if (totalCost > config.Constraints.MaxTotalCost.Value)
                    {
                        _logger?.LogWarning("Stopping training run {RunId} due to cost limit exceeded",
                            run.Id);
                        run.Cancel();
                    }
                }
            }
        }
        catch (Exception ex)
        {
            iteration.Success = false;
            iteration.ErrorMessage = ex.Message;
            iteration.CompletedAt = DateTimeOffset.UtcNow;

            _logger?.LogError(ex, "Iteration {Iteration} of training run {RunId} failed",
                iterationNumber, run.Id);
        }

        run.RecordIteration(iteration);
        await runRepository.SaveAsync(run, ct);
    }

    private Dictionary<string, object>? PrepareIterationInputs(
        TrainingConfiguration config,
        int iterationNumber,
        Dictionary<string, object>? baseInputs)
    {
        var inputs = baseInputs ?? new Dictionary<string, object>();

        switch (config.InputVariation.Type)
        {
            case InputVariationType.Fixed:
                if (config.InputVariation.FixedInputs != null)
                {
                    foreach (var kv in config.InputVariation.FixedInputs)
                    {
                        inputs[kv.Key] = kv.Value;
                    }
                }
                break;

            case InputVariationType.Dataset:
                // TODO: Load from dataset file
                break;

            case InputVariationType.Generated:
                // TODO: Generate inputs
                break;
        }

        // Add iteration metadata
        inputs["__iteration"] = iterationNumber;
        inputs["__trainingRunId"] = config.Id;

        return inputs;
    }

    public async Task<TrainingRun?> GetRunAsync(string runId, CancellationToken ct = default)
    {
        return await _runRepository.GetByIdAsync(runId, ct);
    }

    public Task<IReadOnlyList<TrainingRun>> GetAllRunsAsync(int? limit = null, int? offset = null, CancellationToken ct = default)
    {
        return _runRepository.GetAllAsync(limit, offset, ct);
    }

    public Task<IReadOnlyList<TrainingRun>> GetRunsByConfigurationAsync(string configurationId, CancellationToken ct = default)
    {
        return _runRepository.GetByConfigurationIdAsync(configurationId, ct);
    }

    public async Task<TrainingRun> PauseRunAsync(string runId, CancellationToken ct = default)
    {
        var run = await _runRepository.GetByIdAsync(runId, ct);
        if (run == null)
        {
            throw new ArgumentException($"Training run {runId} not found");
        }

        run.Pause();
        await _runRepository.SaveAsync(run, ct);

        _logger?.LogInformation("Paused training run {RunId}", runId);

        return run;
    }

    public async Task<TrainingRun> ResumeRunAsync(string runId, CancellationToken ct = default)
    {
        var run = await _runRepository.GetByIdAsync(runId, ct);
        if (run == null)
        {
            throw new ArgumentException($"Training run {runId} not found");
        }

        run.Resume();
        await _runRepository.SaveAsync(run, ct);

        _logger?.LogInformation("Resumed training run {RunId}", runId);

        return run;
    }

    public async Task<TrainingRun> CancelRunAsync(string runId, CancellationToken ct = default)
    {
        var run = await _runRepository.GetByIdAsync(runId, ct);
        if (run == null)
        {
            throw new ArgumentException($"Training run {runId} not found");
        }

        // Cancel the execution
        lock (_lock)
        {
            if (_activeRuns.TryGetValue(runId, out var cts))
            {
                cts.Cancel();
                _activeRuns.Remove(runId);
            }
        }

        run.Cancel();
        await _runRepository.SaveAsync(run, ct);

        _logger?.LogInformation("Cancelled training run {RunId}", runId);

        return run;
    }

    public async Task DeleteRunAsync(string runId, CancellationToken ct = default)
    {
        // Cancel if active
        lock (_lock)
        {
            if (_activeRuns.TryGetValue(runId, out var cts))
            {
                cts.Cancel();
                _activeRuns.Remove(runId);
            }
        }

        await _runRepository.DeleteAsync(runId, ct);

        _logger?.LogInformation("Deleted training run {RunId}", runId);
    }
}
