using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace Maestro.Infrastructure.Runs;

/// <summary>
/// Tracks execution runs with full traceability.
/// Stores run data in project's .maestro/runs/ folder or global runs folder.
/// </summary>
public class RunTracker
{
    private readonly string _globalRunsPath;
    private readonly JsonSerializerOptions _jsonOptions;

    public RunTracker(string globalRunsPath)
    {
        _globalRunsPath = globalRunsPath;
        Directory.CreateDirectory(_globalRunsPath);

        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
    }

    /// <summary>
    /// Creates a new run and returns its ID.
    /// </summary>
    public async Task<RunRecord> CreateRunAsync(string projectId, string blockId, string blockType, Dictionary<string, object> inputs, string? projectPath = null)
    {
        var run = new RunRecord
        {
            Id = Guid.NewGuid().ToString(),
            ProjectId = projectId,
            BlockId = blockId,
            BlockType = blockType,
            Status = RunStatus.Running,
            Inputs = inputs,
            StartedAt = DateTime.UtcNow,
            Steps = new List<RunStep>(),
            Decisions = new List<RunDecision>(),
            Artifacts = new List<RunArtifact>(),
            Errors = new List<RunError>()
        };

        await SaveRunAsync(run, projectPath);
        return run;
    }

    /// <summary>
    /// Records an LLM request step.
    /// </summary>
    public async Task RecordLLMRequestAsync(RunRecord run, string prompt, string? projectPath = null)
    {
        var step = new RunStep
        {
            StepId = Guid.NewGuid().ToString(),
            Timestamp = DateTime.UtcNow,
            Type = StepType.LLMRequest,
            Content = new Dictionary<string, object> { ["prompt"] = prompt }
        };
        run.Steps.Add(step);
        await SaveRunAsync(run, projectPath);
    }

    /// <summary>
    /// Records an LLM response step.
    /// </summary>
    public async Task RecordLLMResponseAsync(RunRecord run, string response, int promptTokens, int completionTokens, string? projectPath = null)
    {
        var step = new RunStep
        {
            StepId = Guid.NewGuid().ToString(),
            Timestamp = DateTime.UtcNow,
            Type = StepType.LLMResponse,
            Content = new Dictionary<string, object>
            {
                ["response"] = response,
                ["promptTokens"] = promptTokens,
                ["completionTokens"] = completionTokens
            }
        };
        run.Steps.Add(step);

        // Update token counts
        run.ModelInfo ??= new ModelInfo();
        run.ModelInfo.TokensUsed ??= new TokenUsage();
        run.ModelInfo.TokensUsed.Prompt += promptTokens;
        run.ModelInfo.TokensUsed.Completion += completionTokens;
        run.ModelInfo.TokensUsed.Total += promptTokens + completionTokens;

        await SaveRunAsync(run, projectPath);
    }

    /// <summary>
    /// Records a proposal from the model that needs approval.
    /// </summary>
    public async Task RecordProposalAsync(RunRecord run, object proposal, string? projectPath = null)
    {
        var step = new RunStep
        {
            StepId = Guid.NewGuid().ToString(),
            Timestamp = DateTime.UtcNow,
            Type = StepType.Decision,
            Proposal = proposal,
            Approved = null // Pending approval
        };
        run.Steps.Add(step);
        await SaveRunAsync(run, projectPath);
    }

    /// <summary>
    /// Records approval/rejection of a proposal.
    /// </summary>
    public async Task RecordApprovalAsync(RunRecord run, string stepId, bool approved, string approvedBy, string? projectPath = null)
    {
        var step = run.Steps.Find(s => s.StepId == stepId);
        if (step != null)
        {
            step.Approved = approved;
            step.ApprovedBy = approvedBy;
        }
        await SaveRunAsync(run, projectPath);
    }

    /// <summary>
    /// Records a tool call step.
    /// </summary>
    public async Task RecordToolCallAsync(RunRecord run, string toolId, Dictionary<string, object> args, string? projectPath = null)
    {
        var step = new RunStep
        {
            StepId = Guid.NewGuid().ToString(),
            Timestamp = DateTime.UtcNow,
            Type = StepType.ToolCall,
            Content = new Dictionary<string, object>
            {
                ["toolId"] = toolId,
                ["args"] = args
            }
        };
        run.Steps.Add(step);
        await SaveRunAsync(run, projectPath);
    }

    /// <summary>
    /// Records a tool result step.
    /// </summary>
    public async Task RecordToolResultAsync(RunRecord run, string toolId, object result, bool success, string? projectPath = null)
    {
        var step = new RunStep
        {
            StepId = Guid.NewGuid().ToString(),
            Timestamp = DateTime.UtcNow,
            Type = StepType.ToolResult,
            Content = new Dictionary<string, object>
            {
                ["toolId"] = toolId,
                ["result"] = result,
                ["success"] = success
            }
        };
        run.Steps.Add(step);
        await SaveRunAsync(run, projectPath);
    }

    /// <summary>
    /// Records a design decision made during execution.
    /// </summary>
    public async Task RecordDecisionAsync(RunRecord run, string question, List<string> options, string chosen, string reasoning, string? projectPath = null)
    {
        var decision = new RunDecision
        {
            Timestamp = DateTime.UtcNow,
            Question = question,
            Options = options,
            Chosen = chosen,
            Reasoning = reasoning
        };
        run.Decisions.Add(decision);
        await SaveRunAsync(run, projectPath);
    }

    /// <summary>
    /// Records an artifact (file created/modified).
    /// </summary>
    public async Task RecordArtifactAsync(RunRecord run, string path, string action, long size, string? projectPath = null)
    {
        var artifact = new RunArtifact
        {
            Path = path,
            Action = action,
            Size = size
        };
        run.Artifacts.Add(artifact);
        await SaveRunAsync(run, projectPath);
    }

    /// <summary>
    /// Records an error.
    /// </summary>
    public async Task RecordErrorAsync(RunRecord run, string type, string message, bool recoverable, string? projectPath = null)
    {
        var error = new RunError
        {
            Timestamp = DateTime.UtcNow,
            Type = type,
            Message = message,
            Recoverable = recoverable
        };
        run.Errors.Add(error);
        await SaveRunAsync(run, projectPath);
    }

    /// <summary>
    /// Completes a run with final status and scores.
    /// </summary>
    public async Task CompleteRunAsync(RunRecord run, RunStatus status, Dictionary<string, object>? outputs, RunScores? scores, string? projectPath = null)
    {
        run.Status = status;
        run.CompletedAt = DateTime.UtcNow;
        run.DurationMs = (long)(run.CompletedAt.Value - run.StartedAt).TotalMilliseconds;
        run.Outputs = outputs;
        run.Scores = scores;
        await SaveRunAsync(run, projectPath);
    }

    /// <summary>
    /// Gets a run by ID.
    /// </summary>
    public async Task<RunRecord?> GetRunAsync(string runId, string? projectPath = null)
    {
        var path = GetRunPath(runId, projectPath);
        if (!File.Exists(path)) return null;

        var json = await File.ReadAllTextAsync(path);
        return JsonSerializer.Deserialize<RunRecord>(json, _jsonOptions);
    }

    /// <summary>
    /// Lists all runs for a project.
    /// </summary>
    public async Task<List<RunRecord>> ListRunsAsync(string projectId, string? projectPath = null)
    {
        var runs = new List<RunRecord>();
        var runsDir = projectPath != null
            ? Path.Combine(projectPath, ".maestro", "runs")
            : _globalRunsPath;

        if (!Directory.Exists(runsDir)) return runs;

        foreach (var file in Directory.EnumerateFiles(runsDir, "*.run.json"))
        {
            try
            {
                var json = await File.ReadAllTextAsync(file);
                var run = JsonSerializer.Deserialize<RunRecord>(json, _jsonOptions);
                // Include run if projectId matches or if projectId is "*" (wildcard)
                if (run != null && (projectId == "*" || run.ProjectId == projectId))
                {
                    runs.Add(run);
                }
            }
            catch { /* Skip invalid files */ }
        }

        return runs;
    }

    private async Task SaveRunAsync(RunRecord run, string? projectPath)
    {
        var path = GetRunPath(run.Id, projectPath);
        var dir = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }

        var json = JsonSerializer.Serialize(run, _jsonOptions);
        await File.WriteAllTextAsync(path, json);
    }

    private string GetRunPath(string runId, string? projectPath)
    {
        var runsDir = projectPath != null
            ? Path.Combine(projectPath, ".maestro", "runs")
            : _globalRunsPath;
        return Path.Combine(runsDir, $"{runId}.run.json");
    }
}

#region Data Classes

public class RunRecord
{
    public string Id { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public string BlockId { get; set; } = string.Empty;
    public string BlockType { get; set; } = string.Empty;
    public RunStatus Status { get; set; }
    public Dictionary<string, object>? Inputs { get; set; }
    public Dictionary<string, object>? Outputs { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public long DurationMs { get; set; }
    public List<RunStep> Steps { get; set; } = new();
    public List<RunDecision> Decisions { get; set; } = new();
    public RunScores? Scores { get; set; }
    public List<RunArtifact> Artifacts { get; set; } = new();
    public List<RunError> Errors { get; set; } = new();
    public ModelInfo? ModelInfo { get; set; }
    public string? ParentRunId { get; set; }
    public List<string> ChildRunIds { get; set; } = new();
}

public enum RunStatus
{
    Pending,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled
}

public class RunStep
{
    public string StepId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public StepType Type { get; set; }
    public Dictionary<string, object>? Content { get; set; }
    public object? Proposal { get; set; }
    public bool? Approved { get; set; }
    public string? ApprovedBy { get; set; }
}

public enum StepType
{
    LLMRequest,
    LLMResponse,
    ToolCall,
    ToolResult,
    Decision,
    Validation,
    Error
}

public class RunDecision
{
    public DateTime Timestamp { get; set; }
    public string Question { get; set; } = string.Empty;
    public List<string> Options { get; set; } = new();
    public string Chosen { get; set; } = string.Empty;
    public string Reasoning { get; set; } = string.Empty;
}

public class RunScores
{
    public int Overall { get; set; }
    public int CodeQuality { get; set; }
    public int TaskCompletion { get; set; }
    public int Efficiency { get; set; }
}

public class RunArtifact
{
    public string Path { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? ContentHash { get; set; }
    public long Size { get; set; }
}

public class RunError
{
    public DateTime Timestamp { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool Recoverable { get; set; }
}

public class ModelInfo
{
    public string? ModelId { get; set; }
    public string? Provider { get; set; }
    public TokenUsage? TokensUsed { get; set; }
}

public class TokenUsage
{
    public int Prompt { get; set; }
    public int Completion { get; set; }
    public int Total { get; set; }
}

#endregion
