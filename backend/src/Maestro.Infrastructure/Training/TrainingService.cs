using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.Metrics;
using Maestro.Infrastructure.Orchestration;
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
    private readonly IWorkflowExecutor _workflowExecutor;
    private readonly MetricsCollector _metricsCollector;
    private readonly ILogger<TrainingService>? _logger;

    // Active training run cancellation tokens
    private readonly Dictionary<string, CancellationTokenSource> _activeRuns = new();
    private readonly object _lock = new();

    public TrainingService(
        ITrainingConfigurationRepository configRepository,
        ITrainingRunRepository runRepository,
        IBlockDiscoveryService blockDiscoveryService,
        IWorkflowExecutor workflowExecutor,
        MetricsCollector metricsCollector,
        ILogger<TrainingService>? logger = null)
    {
        _configRepository = configRepository;
        _runRepository = runRepository;
        _blockDiscoveryService = blockDiscoveryService;
        _workflowExecutor = workflowExecutor;
        _metricsCollector = metricsCollector;
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
        try
        {
            run.Start();
            await _runRepository.SaveAsync(run, ct);

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
                    run = await _runRepository.GetByIdAsync(run.Id, ct) ?? run;
                }

                if (run.Status == TrainingRunStatus.Cancelled)
                {
                    break;
                }

                await semaphore.WaitAsync(ct);
                var iterationNumber = i;

                tasks.Add(Task.Run(async () =>
                {
                    try
                    {
                        await ExecuteIterationAsync(run, config, iterationNumber, inputs, ct);
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

            // Complete the run
            run.Complete();
            await _runRepository.SaveAsync(run, ct);

            _logger?.LogInformation("Completed training run {RunId}: {Completed}/{Total} iterations succeeded",
                run.Id, run.CompletedIterations, run.TotalIterations);
        }
        catch (OperationCanceledException)
        {
            run.Cancel();
            await _runRepository.SaveAsync(run);
            _logger?.LogInformation("Training run {RunId} was cancelled", run.Id);
        }
        catch (Exception ex)
        {
            run.Fail(ex.Message);
            await _runRepository.SaveAsync(run);
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
            var result = await _workflowExecutor.ExecuteAsync(
                workflow,
                iterationInputs,
                new ExecutionOptions { MaxRetries = 2 },
                ct: ct);

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
        await _runRepository.SaveAsync(run, ct);
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
