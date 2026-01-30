using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;

namespace Maestro.Api.Controllers;

/// <summary>
/// Controller for execution metrics.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class MetricsController : ControllerBase
{
    private readonly IMetricsRepository _repository;
    private readonly ILogger<MetricsController> _logger;

    public MetricsController(IMetricsRepository repository, ILogger<MetricsController> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    /// <summary>
    /// List all execution metrics.
    /// </summary>
    [HttpGet("executions")]
    public async Task<ActionResult<IEnumerable<WorkflowExecutionMetricsDto>>> ListExecutionMetrics(
        [FromQuery] string? workflowId = null,
        [FromQuery] int? limit = 50,
        [FromQuery] int? offset = 0)
    {
        var query = new MetricsQuery
        {
            WorkflowId = workflowId,
            Limit = limit ?? 50,
            Offset = offset ?? 0,
            OrderBy = "StartedAt",
            Descending = true
        };
        var metrics = await _repository.QueryAsync(query);
        return Ok(metrics.Select(WorkflowExecutionMetricsDto.FromDomain));
    }

    /// <summary>
    /// Get metrics for a specific execution.
    /// </summary>
    [HttpGet("executions/{executionId}")]
    public async Task<ActionResult<WorkflowExecutionMetricsDto>> GetExecutionMetrics(string executionId)
    {
        var metrics = await _repository.GetByExecutionIdAsync(executionId);

        if (metrics == null)
        {
            return NotFound($"Metrics for execution {executionId} not found");
        }

        return Ok(WorkflowExecutionMetricsDto.FromDomain(metrics));
    }

    /// <summary>
    /// Get metrics for a workflow (all executions).
    /// </summary>
    [HttpGet("workflows/{workflowId}")]
    public async Task<ActionResult<IEnumerable<WorkflowExecutionMetricsDto>>> GetWorkflowMetrics(
        string workflowId,
        [FromQuery] int? limit = 50,
        [FromQuery] int? offset = 0)
    {
        var metrics = await _repository.GetByWorkflowIdAsync(workflowId, limit, offset);
        return Ok(metrics.Select(WorkflowExecutionMetricsDto.FromDomain));
    }

    /// <summary>
    /// Get metrics for a training run (all iterations).
    /// </summary>
    [HttpGet("runs/{trainingRunId}")]
    public async Task<ActionResult<IEnumerable<WorkflowExecutionMetricsDto>>> GetTrainingRunMetrics(
        string trainingRunId)
    {
        var metrics = await _repository.GetByTrainingRunIdAsync(trainingRunId);
        return Ok(metrics.Select(WorkflowExecutionMetricsDto.FromDomain));
    }

    /// <summary>
    /// Query metrics with filters.
    /// </summary>
    [HttpPost("query")]
    public async Task<ActionResult<IEnumerable<WorkflowExecutionMetricsDto>>> QueryMetrics(
        [FromBody] MetricsQueryRequest request)
    {
        var query = new MetricsQuery
        {
            WorkflowId = request.WorkflowId,
            TrainingRunId = request.TrainingRunId,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Status = request.Status,
            MinQualityScore = request.MinQualityScore,
            MaxCost = request.MaxCost,
            Limit = request.Limit ?? 100,
            Offset = request.Offset ?? 0,
            OrderBy = request.OrderBy ?? "StartedAt",
            Descending = request.Descending ?? true
        };

        var metrics = await _repository.QueryAsync(query);
        return Ok(metrics.Select(WorkflowExecutionMetricsDto.FromDomain));
    }

    /// <summary>
    /// Get aggregated metrics.
    /// </summary>
    [HttpGet("aggregate")]
    public async Task<ActionResult<AggregatedMetricsDto>> GetAggregatedMetrics(
        [FromQuery] string? workflowId = null,
        [FromQuery] DateTimeOffset? startDate = null,
        [FromQuery] DateTimeOffset? endDate = null)
    {
        var aggregated = await _repository.GetAggregatedAsync(workflowId, startDate, endDate);

        return Ok(new AggregatedMetricsDto
        {
            TotalExecutions = aggregated.TotalExecutions,
            AverageDurationMs = aggregated.AverageDurationMs,
            TotalCostUsd = aggregated.TotalCostUsd,
            AverageCostUsd = aggregated.AverageCostUsd,
            TotalTokens = aggregated.TotalTokens,
            AverageQualityScore = aggregated.AverageQualityScore ?? 0,
            SuccessRate = aggregated.SuccessRate,
            CostByModel = aggregated.CostByModel,
            ExecutionsByStatus = aggregated.ExecutionsByStatus
        });
    }

    /// <summary>
    /// Delete metrics older than a certain date.
    /// </summary>
    [HttpDelete("cleanup")]
    public async Task<ActionResult<int>> CleanupOldMetrics([FromQuery] DateTimeOffset cutoff)
    {
        var deleted = await _repository.DeleteOlderThanAsync(cutoff);
        _logger.LogInformation("Deleted {Count} metrics older than {Cutoff}", deleted, cutoff);
        return Ok(deleted);
    }
}

/// <summary>
/// Request for querying metrics.
/// </summary>
public class MetricsQueryRequest
{
    public string? WorkflowId { get; set; }
    public string? TrainingRunId { get; set; }
    public DateTimeOffset? StartDate { get; set; }
    public DateTimeOffset? EndDate { get; set; }
    public string? Status { get; set; }
    public int? MinQualityScore { get; set; }
    public decimal? MaxCost { get; set; }
    public int? Limit { get; set; }
    public int? Offset { get; set; }
    public string? OrderBy { get; set; }
    public bool? Descending { get; set; }
}
