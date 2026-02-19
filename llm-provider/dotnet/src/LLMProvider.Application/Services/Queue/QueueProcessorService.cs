using System.Diagnostics;
using LLMProvider.Application.DTOs.Statistics;
using LLMProvider.Application.Interfaces;
using LLMProvider.Application.Interfaces.Providers;
using LLMProvider.Application.Options;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LLMProvider.Application.Services.Queue;

/// <summary>
/// Background service that processes queued requests, coordinating model switches with the optimizer.
/// </summary>
public sealed class QueueProcessorService : BackgroundService
{
    private readonly IRequestQueue _queue;
    private readonly ILLMProviderFactory _providerFactory;
    private readonly ModelSwitchOptimizer _optimizer;
    private readonly StatisticsService _statistics;
    private readonly QueueOptions _options;
    private readonly ILogger<QueueProcessorService> _logger;

    private ModelId? _currentActiveModel;

    public QueueProcessorService(
        IRequestQueue queue,
        ILLMProviderFactory providerFactory,
        ModelSwitchOptimizer optimizer,
        StatisticsService statistics,
        IOptions<QueueOptions> options,
        ILogger<QueueProcessorService> logger)
    {
        _queue = queue;
        _providerFactory = providerFactory;
        _optimizer = optimizer;
        _statistics = statistics;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_queue.IsEnabled)
        {
            _logger.LogInformation("Queue processor is disabled");
            return;
        }

        _logger.LogInformation("Queue processor started (poll interval: {Interval}ms)", _options.ProcessorPollIntervalMs);

        // Try to detect current active model on startup
        await InitializeActiveModelAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (_queue.Count == 0)
                {
                    await Task.Delay(_options.ProcessorPollIntervalMs, stoppingToken);
                    continue;
                }

                // Get all pending requests
                var pending = _queue.PeekAll();

                // Update queue statistics
                var depthByModel = pending
                    .GroupBy(r => r.TargetModel.Value)
                    .ToDictionary(g => g.Key, g => g.Count());
                _statistics.UpdateQueueDepth(_queue.Count, depthByModel, _currentActiveModel?.Value);

                // Run optimizer
                var decision = _optimizer.Evaluate(_currentActiveModel, pending);

                // Record decision
                var switchDuration = TimeSpan.Zero;
                _logger.LogInformation(
                    "Switch decision: {Decision} target={Target} score={Score:F1} reason={Reason}",
                    decision.Decision, decision.TargetModel, decision.Score, decision.Reason);

                // If switch needed, execute it
                if (decision.Decision is SwitchDecision.SwitchImmediate or SwitchDecision.ForcedByStarvation)
                {
                    switchDuration = await ExecuteModelSwitchAsync(decision.TargetModel, stoppingToken);
                }

                // Record switch event
                _statistics.RecordModelSwitch(new SwitchEvent(
                    From: _currentActiveModel ?? new ModelId("none"),
                    To: decision.TargetModel,
                    Decision: decision.Decision,
                    Score: decision.Score,
                    Reason: decision.Reason,
                    Duration: switchDuration,
                    Timestamp: DateTimeOffset.UtcNow
                ));

                // Process batch for current model
                await ProcessBatchAsync(stoppingToken);

                // Update queue depth after processing
                _statistics.UpdateQueueDepth(_queue.Count, new Dictionary<string, int>(), _currentActiveModel?.Value);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in queue processor loop");
                await Task.Delay(1000, stoppingToken);
            }
        }

        _logger.LogInformation("Queue processor stopped");
    }

    private async Task InitializeActiveModelAsync(CancellationToken ct)
    {
        try
        {
            if (_providerFactory.TryGetProvider(ProviderType.Local, out var provider) && provider is IModelSwitchable switchable)
            {
                var activeModel = await switchable.GetActiveModelAsync(ct);
                if (activeModel is not null)
                {
                    _currentActiveModel = new ModelId(activeModel);
                    _logger.LogInformation("Detected current active model: {Model}", activeModel);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Could not detect active model on startup");
        }
    }

    private async Task<TimeSpan> ExecuteModelSwitchAsync(ModelId targetModel, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            if (_providerFactory.TryGetProvider(ProviderType.Local, out var provider) && provider is IModelSwitchable switchable)
            {
                _logger.LogInformation("Switching model from {Current} to {Target}",
                    _currentActiveModel?.Value ?? "none", targetModel);

                await switchable.SwitchModelAsync(targetModel.Value, ct);
                _currentActiveModel = targetModel;

                sw.Stop();
                _statistics.RecordModelLoadTime(targetModel, sw.Elapsed);

                _logger.LogInformation("Model switch to {Model} completed in {Duration}ms",
                    targetModel, sw.ElapsedMilliseconds);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to switch model to {Model}", targetModel);
        }

        sw.Stop();
        return sw.Elapsed;
    }

    private async Task ProcessBatchAsync(CancellationToken ct)
    {
        // Dequeue and process all requests matching current model
        while (_queue.TryDequeue(out var item))
        {
            if (item is null)
            {
                break;
            }

            var (request, handle) = item.Value;

            try
            {
                var sw = Stopwatch.StartNew();

                _providerFactory.TryGetProvider(request.TargetProvider, out var provider);
                provider ??= _providerFactory.GetProvider(request.TargetProvider);

                var response = await provider.CompleteAsync(handle.Request, handle.ConversationHistory, ct);
                sw.Stop();

                // Record statistics
                _statistics.RecordRequest(new RequestMetricEntry
                {
                    ModelId = response.ModelUsed,
                    ProviderType = response.Provider,
                    LatencyMs = sw.ElapsedMilliseconds,
                    TokenUsage = response.TokenUsage,
                    Timestamp = DateTimeOffset.UtcNow,
                    QueueWaitTime = request.WaitTime
                });
                _statistics.RecordProcessed();

                handle.SetResult(response);

                _logger.LogDebug("Processed queued request {RequestId} in {Duration}ms",
                    request.Id, sw.ElapsedMilliseconds);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process queued request {RequestId}", request.Id);
                handle.SetException(ex);
            }
        }
    }
}
