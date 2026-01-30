using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Metrics;

namespace Maestro.Api.Controllers;

/// <summary>
/// Controller for training configurations and runs.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class TrainingController : ControllerBase
{
    private readonly ITrainingService _trainingService;
    private readonly IBlockDiscoveryService _blockDiscoveryService;
    private readonly IWorkflowExecutor _workflowExecutor;
    private readonly MetricsCollector _metricsCollector;
    private readonly ILogger<TrainingController> _logger;

    public TrainingController(
        ITrainingService trainingService,
        IBlockDiscoveryService blockDiscoveryService,
        IWorkflowExecutor workflowExecutor,
        MetricsCollector metricsCollector,
        ILogger<TrainingController> logger)
    {
        _trainingService = trainingService;
        _blockDiscoveryService = blockDiscoveryService;
        _workflowExecutor = workflowExecutor;
        _metricsCollector = metricsCollector;
        _logger = logger;
    }

    #region Configurations

    /// <summary>
    /// Get all training configurations.
    /// </summary>
    [HttpGet("configurations")]
    public async Task<ActionResult<IEnumerable<TrainingConfigurationDto>>> GetConfigurations()
    {
        var configs = await _trainingService.GetAllConfigurationsAsync();
        return Ok(configs.Select(TrainingConfigurationDto.FromDomain));
    }

    /// <summary>
    /// Get a training configuration by ID.
    /// </summary>
    [HttpGet("configurations/{id}")]
    public async Task<ActionResult<TrainingConfigurationDto>> GetConfiguration(string id)
    {
        var config = await _trainingService.GetConfigurationAsync(id);

        if (config == null)
        {
            return NotFound($"Training configuration {id} not found");
        }

        return Ok(TrainingConfigurationDto.FromDomain(config));
    }

    /// <summary>
    /// Create a new training configuration.
    /// </summary>
    [HttpPost("configurations")]
    public async Task<ActionResult<TrainingConfigurationDto>> CreateConfiguration(
        [FromBody] CreateTrainingConfigRequest request)
    {
        var dto = new TrainingConfigurationDto
        {
            Name = request.Name,
            Description = request.Description,
            WorkflowId = request.WorkflowId,
            Iterations = request.Iterations,
            ParallelIterations = request.ParallelIterations,
            OptimizationGoal = request.OptimizationGoal,
            QualityEvaluation = request.QualityEvaluation ?? new QualityEvaluationConfigDto(),
            Constraints = request.Constraints,
            ModelOverrides = request.ModelOverrides ?? new Dictionary<string, string>(),
            Tags = request.Tags ?? new List<string>(),
            IsActive = true
        };

        var config = await _trainingService.CreateConfigurationAsync(dto.ToDomain());

        _logger.LogInformation("Created training configuration {Id}: {Name}", config.Id, config.Name);

        return CreatedAtAction(
            nameof(GetConfiguration),
            new { id = config.Id },
            TrainingConfigurationDto.FromDomain(config));
    }

    /// <summary>
    /// Update a training configuration.
    /// </summary>
    [HttpPut("configurations/{id}")]
    public async Task<ActionResult<TrainingConfigurationDto>> UpdateConfiguration(
        string id,
        [FromBody] TrainingConfigurationDto dto)
    {
        var existing = await _trainingService.GetConfigurationAsync(id);
        if (existing == null)
        {
            return NotFound($"Training configuration {id} not found");
        }

        dto.Id = id;
        var config = await _trainingService.UpdateConfigurationAsync(dto.ToDomain());

        return Ok(TrainingConfigurationDto.FromDomain(config));
    }

    /// <summary>
    /// Delete a training configuration.
    /// </summary>
    [HttpDelete("configurations/{id}")]
    public async Task<ActionResult> DeleteConfiguration(string id)
    {
        var existing = await _trainingService.GetConfigurationAsync(id);
        if (existing == null)
        {
            return NotFound($"Training configuration {id} not found");
        }

        await _trainingService.DeleteConfigurationAsync(id);

        return NoContent();
    }

    #endregion

    #region Runs

    /// <summary>
    /// Get all training runs.
    /// </summary>
    [HttpGet("runs")]
    public async Task<ActionResult<IEnumerable<TrainingRunDto>>> GetRuns(
        [FromQuery] int? limit = 50,
        [FromQuery] int? offset = 0)
    {
        var runs = await _trainingService.GetAllRunsAsync(limit, offset);
        return Ok(runs.Select(TrainingRunDto.FromDomain));
    }

    /// <summary>
    /// Get a training run by ID.
    /// </summary>
    [HttpGet("runs/{id}")]
    public async Task<ActionResult<TrainingRunDto>> GetRun(string id)
    {
        var run = await _trainingService.GetRunAsync(id);

        if (run == null)
        {
            return NotFound($"Training run {id} not found");
        }

        return Ok(TrainingRunDto.FromDomain(run));
    }

    /// <summary>
    /// Get runs for a specific configuration.
    /// </summary>
    [HttpGet("configurations/{configId}/runs")]
    public async Task<ActionResult<IEnumerable<TrainingRunDto>>> GetRunsByConfiguration(string configId)
    {
        var runs = await _trainingService.GetRunsByConfigurationAsync(configId);
        return Ok(runs.Select(TrainingRunDto.FromDomain));
    }

    /// <summary>
    /// Start a new training run.
    /// </summary>
    [HttpPost("configurations/{configId}/runs")]
    public async Task<ActionResult<TrainingRunDto>> StartRun(
        string configId,
        [FromBody] StartTrainingRunRequest? request = null)
    {
        try
        {
            var run = await _trainingService.StartRunAsync(
                configId,
                request?.Name,
                request?.InitiatedBy,
                request?.Inputs);

            _logger.LogInformation("Started training run {RunId} for configuration {ConfigId}",
                run.Id, configId);

            return CreatedAtAction(
                nameof(GetRun),
                new { id = run.Id },
                TrainingRunDto.FromDomain(run));
        }
        catch (ArgumentException ex)
        {
            return NotFound(ex.Message);
        }
    }

    /// <summary>
    /// Pause a running training run.
    /// </summary>
    [HttpPost("runs/{id}/pause")]
    public async Task<ActionResult<TrainingRunDto>> PauseRun(string id)
    {
        try
        {
            var run = await _trainingService.PauseRunAsync(id);
            return Ok(TrainingRunDto.FromDomain(run));
        }
        catch (ArgumentException ex)
        {
            return NotFound(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>
    /// Resume a paused training run.
    /// </summary>
    [HttpPost("runs/{id}/resume")]
    public async Task<ActionResult<TrainingRunDto>> ResumeRun(string id)
    {
        try
        {
            var run = await _trainingService.ResumeRunAsync(id);
            return Ok(TrainingRunDto.FromDomain(run));
        }
        catch (ArgumentException ex)
        {
            return NotFound(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>
    /// Cancel a training run.
    /// </summary>
    [HttpDelete("runs/{id}")]
    public async Task<ActionResult<TrainingRunDto>> CancelRun(string id)
    {
        try
        {
            var run = await _trainingService.CancelRunAsync(id);
            return Ok(TrainingRunDto.FromDomain(run));
        }
        catch (ArgumentException ex)
        {
            return NotFound(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    #endregion

    #region Sessions (Workflow Comparison)

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, Domain.Entities.TrainingSession> _sessions = new();

    /// <summary>
    /// Create a new training session for comparing workflows
    /// </summary>
    [HttpPost("sessions")]
    public ActionResult<TrainingSessionResponse> CreateSession([FromBody] CreateSessionRequest request)
    {
        var session = Domain.Entities.TrainingSession.Create(
            request.Name,
            request.Description,
            request.CreatedBy);

        if (request.WorkflowIds != null)
        {
            foreach (var workflowId in request.WorkflowIds)
            {
                session.AddWorkflow(workflowId);
            }
        }

        if (request.Configuration != null)
        {
            session.SetConfiguration(request.Configuration);
        }

        _sessions[session.Id] = session;

        _logger.LogInformation("Created training session {SessionId}: {Name}", session.Id, session.Name);

        return CreatedAtAction(nameof(GetSession), new { id = session.Id }, MapSessionToResponse(session));
    }

    /// <summary>
    /// Get all training sessions
    /// </summary>
    [HttpGet("sessions")]
    public ActionResult<IEnumerable<TrainingSessionResponse>> GetSessions(
        [FromQuery] string? status = null,
        [FromQuery] int limit = 50)
    {
        var sessions = _sessions.Values.AsEnumerable();

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<Domain.Entities.TrainingStatus>(status, true, out var statusEnum))
        {
            sessions = sessions.Where(s => s.Status == statusEnum);
        }

        return Ok(sessions
            .OrderByDescending(s => s.CreatedAt)
            .Take(limit)
            .Select(MapSessionToResponse)
            .ToList());
    }

    /// <summary>
    /// Get a training session by ID
    /// </summary>
    [HttpGet("sessions/{id}")]
    public ActionResult<TrainingSessionResponse> GetSession(string id)
    {
        if (!_sessions.TryGetValue(id, out var session))
        {
            return NotFound(new { error = "Training session not found" });
        }

        return Ok(MapSessionToResponse(session));
    }

    /// <summary>
    /// Add a task to a training session
    /// </summary>
    [HttpPost("sessions/{id}/tasks")]
    public ActionResult<TrainingTaskResponse> AddTask(string id, [FromBody] AddTaskRequest request)
    {
        if (!_sessions.TryGetValue(id, out var session))
        {
            return NotFound(new { error = "Training session not found" });
        }

        if (session.Status != Domain.Entities.TrainingStatus.Draft)
        {
            return BadRequest(new { error = "Can only add tasks to draft sessions" });
        }

        var task = session.AddTask(request.Description, request.ExpectedOutcome);

        return Ok(new TrainingTaskResponse
        {
            Id = task.Id,
            SessionId = task.SessionId,
            Description = task.Description,
            ExpectedOutcome = task.ExpectedOutcome,
            WorkflowRuns = new List<WorkflowRunResponse>(),
            CreatedAt = task.CreatedAt
        });
    }

    /// <summary>
    /// Add a workflow to compare in the session
    /// </summary>
    [HttpPost("sessions/{id}/workflows/{workflowId}")]
    public ActionResult AddWorkflowToSession(string id, string workflowId)
    {
        if (!_sessions.TryGetValue(id, out var session))
        {
            return NotFound(new { error = "Training session not found" });
        }

        if (session.Status != Domain.Entities.TrainingStatus.Draft)
        {
            return BadRequest(new { error = "Can only add workflows to draft sessions" });
        }

        session.AddWorkflow(workflowId);

        return Ok(new { message = "Workflow added to session" });
    }

    /// <summary>
    /// Set session ready for running
    /// </summary>
    [HttpPost("sessions/{id}/ready")]
    public ActionResult SetSessionReady(string id)
    {
        if (!_sessions.TryGetValue(id, out var session))
        {
            return NotFound(new { error = "Training session not found" });
        }

        try
        {
            session.SetReady();
            return Ok(MapSessionToResponse(session));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Run the training session (executes all workflows against all tasks)
    /// </summary>
    [HttpPost("sessions/{id}/run")]
    public ActionResult<TrainingSessionResponse> RunSession(string id)
    {
        if (!_sessions.TryGetValue(id, out var session))
        {
            return NotFound(new { error = "Training session not found" });
        }

        if (session.Status != Domain.Entities.TrainingStatus.Ready &&
            session.Status != Domain.Entities.TrainingStatus.Draft)
        {
            return BadRequest(new { error = $"Session cannot be run in status: {session.Status}" });
        }

        // Set ready if still in draft
        if (session.Status == Domain.Entities.TrainingStatus.Draft)
        {
            try
            {
                session.SetReady();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        session.SetRunning();

        // Run actual workflows in background
        _ = ExecuteSessionAsync(session);

        return Ok(MapSessionToResponse(session));
    }

    private async Task ExecuteSessionAsync(Domain.Entities.TrainingSession session)
    {
        try
        {
            foreach (var task in session.Tasks)
            {
                foreach (var workflowId in session.WorkflowIds)
                {
                    var run = task.AddRun(workflowId, $"Workflow-{workflowId}");
                    run.Status = "running";

                    try
                    {
                        // Load the workflow block
                        var workflowBlock = await _blockDiscoveryService.GetByIdAsync(workflowId);
                        if (workflowBlock == null)
                        {
                            run.Status = "failed";
                            run.ErrorMessage = $"Workflow {workflowId} not found";
                            run.CompletedAt = DateTime.UtcNow;
                            run.DurationSeconds = (run.CompletedAt.Value - run.StartedAt).TotalSeconds;
                            continue;
                        }

                        // Build workflow definition
                        var workflow = new WorkflowDefinition(
                            workflowId,
                            new List<BlockDefinition> { workflowBlock },
                            new List<Maestro.Domain.Entities.ConnectionDefinition>()
                        );

                        // Create execution ID and start metrics tracking
                        var executionId = $"session-{session.Id}-task-{task.Id}-{workflowId}";
                        await _metricsCollector.BeginExecutionAsync(executionId, workflowId);

                        // Execute workflow with task description as input
                        var inputs = new Dictionary<string, object>
                        {
                            { "task", task.Description },
                            { "expectedOutcome", task.ExpectedOutcome ?? "" }
                        };

                        _logger.LogInformation("Executing workflow {WorkflowId} for session task {TaskId}", workflowId, task.Id);

                        var result = await _workflowExecutor.ExecuteAsync(
                            workflow,
                            inputs,
                            new ExecutionOptions { MaxRetries = 2 });

                        // Complete metrics
                        var metrics = await _metricsCollector.CompleteExecutionAsync(
                            executionId,
                            result.Success ? "Completed" : "Failed",
                            result.Error);

                        run.Status = result.Success ? "completed" : "failed";
                        run.CompletedAt = DateTime.UtcNow;
                        run.DurationSeconds = (run.CompletedAt.Value - run.StartedAt).TotalSeconds;
                        run.Output = result.Outputs != null ? string.Join(", ", result.Outputs.Values) : "";
                        run.ErrorMessage = result.Error;
                        run.Metrics = new Dictionary<string, double>
                        {
                            { "quality", metrics.Quality?.Score ?? 0 },
                            { "cost", (double)metrics.TotalCostUsd },
                            { "tokens", metrics.TotalInputTokens + metrics.TotalOutputTokens },
                            { "duration_ms", (double)metrics.TotalDurationMs }
                        };

                        _logger.LogInformation("Workflow {WorkflowId} completed: Success={Success}", workflowId, result.Success);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error executing workflow {WorkflowId} for session {SessionId}", workflowId, session.Id);
                        run.Status = "failed";
                        run.ErrorMessage = ex.Message;
                        run.CompletedAt = DateTime.UtcNow;
                        run.DurationSeconds = (run.CompletedAt.Value - run.StartedAt).TotalSeconds;
                    }
                }
            }

            // Generate comparison
            var comparison = GenerateComparison(session);
            session.SetCompleted(comparison);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Training session {SessionId} failed", session.Id);
            session.SetCancelled();
        }
    }

    /// <summary>
    /// Get comparison results for a completed session
    /// </summary>
    [HttpGet("sessions/{id}/compare")]
    public ActionResult<TrainingComparisonResponse> GetComparison(string id)
    {
        if (!_sessions.TryGetValue(id, out var session))
        {
            return NotFound(new { error = "Training session not found" });
        }

        if (session.ComparisonResult == null)
        {
            if (session.Status != Domain.Entities.TrainingStatus.Completed)
            {
                return BadRequest(new { error = "Session has not completed yet" });
            }
            return NotFound(new { error = "No comparison result available" });
        }

        return Ok(new TrainingComparisonResponse
        {
            SessionId = session.Id,
            TaskId = session.ComparisonResult.TaskId,
            Results = session.ComparisonResult.Results.Select(r => new WorkflowResultResponse
            {
                WorkflowId = r.WorkflowId,
                WorkflowName = r.WorkflowName,
                OverallScore = r.OverallScore,
                Metrics = r.Metrics,
                Output = r.Output,
                Success = r.Success,
                DurationSeconds = r.DurationSeconds
            }).ToList(),
            BestPerformerId = session.ComparisonResult.BestPerformerId,
            BestPerformerName = session.ComparisonResult.BestPerformerName,
            AggregateMetrics = session.ComparisonResult.AggregateMetrics,
            Summary = session.ComparisonResult.Summary
        });
    }

    /// <summary>
    /// Cancel a training session
    /// </summary>
    [HttpDelete("sessions/{id}")]
    public ActionResult CancelSession(string id)
    {
        if (!_sessions.TryGetValue(id, out var session))
        {
            return NotFound(new { error = "Training session not found" });
        }

        session.SetCancelled();

        return Ok(new { message = "Session cancelled" });
    }

    private static Domain.Entities.TrainingComparison GenerateComparison(Domain.Entities.TrainingSession session)
    {
        var results = new List<Domain.Entities.WorkflowResult>();
        var workflowScores = new Dictionary<string, List<double>>();

        foreach (var task in session.Tasks)
        {
            foreach (var run in task.WorkflowRuns)
            {
                if (!workflowScores.ContainsKey(run.WorkflowId))
                {
                    workflowScores[run.WorkflowId] = new List<double>();
                }

                var score = run.Metrics.GetValueOrDefault("quality", 0.5);
                workflowScores[run.WorkflowId].Add(score);
            }
        }

        foreach (var kvp in workflowScores)
        {
            var avgScore = kvp.Value.Any() ? kvp.Value.Average() : 0;
            results.Add(new Domain.Entities.WorkflowResult
            {
                WorkflowId = kvp.Key,
                WorkflowName = $"Workflow-{kvp.Key}",
                OverallScore = avgScore,
                Success = true,
                DurationSeconds = session.Tasks
                    .SelectMany(t => t.WorkflowRuns)
                    .Where(r => r.WorkflowId == kvp.Key)
                    .Sum(r => r.DurationSeconds ?? 0),
                Metrics = new Dictionary<string, double>
                {
                    { "average_quality", avgScore },
                    { "task_count", session.Tasks.Count }
                }
            });
        }

        var best = results.OrderByDescending(r => r.OverallScore).FirstOrDefault();

        return new Domain.Entities.TrainingComparison
        {
            TaskId = session.Tasks.FirstOrDefault()?.Id ?? "",
            Results = results,
            BestPerformerId = best?.WorkflowId,
            BestPerformerName = best?.WorkflowName,
            AggregateMetrics = new Dictionary<string, double>
            {
                { "total_tasks", session.Tasks.Count },
                { "total_workflows", session.WorkflowIds.Count },
                { "best_score", best?.OverallScore ?? 0 }
            },
            Summary = $"Best performer: {best?.WorkflowName} with score {best?.OverallScore:F2}"
        };
    }

    private static TrainingSessionResponse MapSessionToResponse(Domain.Entities.TrainingSession session)
    {
        return new TrainingSessionResponse
        {
            Id = session.Id,
            Name = session.Name,
            Description = session.Description,
            WorkflowIds = session.WorkflowIds,
            Tasks = session.Tasks.Select(t => new TrainingTaskResponse
            {
                Id = t.Id,
                SessionId = t.SessionId,
                Description = t.Description,
                ExpectedOutcome = t.ExpectedOutcome,
                WorkflowRuns = t.WorkflowRuns.Select(r => new WorkflowRunResponse
                {
                    Id = r.Id,
                    WorkflowId = r.WorkflowId,
                    WorkflowName = r.WorkflowName,
                    Status = r.Status,
                    StartedAt = r.StartedAt,
                    CompletedAt = r.CompletedAt,
                    DurationSeconds = r.DurationSeconds,
                    Output = r.Output,
                    ErrorMessage = r.ErrorMessage,
                    Metrics = r.Metrics
                }).ToList(),
                CreatedAt = t.CreatedAt
            }).ToList(),
            Status = session.Status.ToString().ToLower(),
            CreatedBy = session.CreatedBy,
            CreatedAt = session.CreatedAt,
            StartedAt = session.StartedAt,
            CompletedAt = session.CompletedAt,
            Configuration = session.Configuration,
            HasComparison = session.ComparisonResult != null
        };
    }

    #endregion
}

#region Session DTOs

public class CreateSessionRequest
{
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public List<string>? WorkflowIds { get; set; }
    public string? CreatedBy { get; set; }
    public Dictionary<string, object>? Configuration { get; set; }
}

public class AddTaskRequest
{
    public string Description { get; set; } = "";
    public string? ExpectedOutcome { get; set; }
}

public class TrainingSessionResponse
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public List<string> WorkflowIds { get; set; } = new();
    public List<TrainingTaskResponse> Tasks { get; set; } = new();
    public string Status { get; set; } = "";
    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Dictionary<string, object> Configuration { get; set; } = new();
    public bool HasComparison { get; set; }
}

public class TrainingTaskResponse
{
    public string Id { get; set; } = "";
    public string SessionId { get; set; } = "";
    public string Description { get; set; } = "";
    public string? ExpectedOutcome { get; set; }
    public List<WorkflowRunResponse> WorkflowRuns { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}

public class WorkflowRunResponse
{
    public string Id { get; set; } = "";
    public string WorkflowId { get; set; } = "";
    public string WorkflowName { get; set; } = "";
    public string Status { get; set; } = "";
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public double? DurationSeconds { get; set; }
    public string? Output { get; set; }
    public string? ErrorMessage { get; set; }
    public Dictionary<string, double> Metrics { get; set; } = new();
}

public class TrainingComparisonResponse
{
    public string SessionId { get; set; } = "";
    public string TaskId { get; set; } = "";
    public List<WorkflowResultResponse> Results { get; set; } = new();
    public string? BestPerformerId { get; set; }
    public string? BestPerformerName { get; set; }
    public Dictionary<string, double> AggregateMetrics { get; set; } = new();
    public string? Summary { get; set; }
}

public class WorkflowResultResponse
{
    public string WorkflowId { get; set; } = "";
    public string WorkflowName { get; set; } = "";
    public double OverallScore { get; set; }
    public Dictionary<string, double> Metrics { get; set; } = new();
    public string? Output { get; set; }
    public bool Success { get; set; }
    public double DurationSeconds { get; set; }
}

#endregion
