using System;
using System.Collections.Generic;

namespace Maestro.Domain.Entities
{
    /// <summary>
    /// Status of a training session
    /// </summary>
    public enum TrainingStatus
    {
        Draft,
        Ready,
        Running,
        Completed,
        Failed,
        Cancelled
    }

    /// <summary>
    /// Represents a training session for comparing workflow performance
    /// </summary>
    public class TrainingSession
    {
        public string Id { get; private set; }
        public string Name { get; private set; }
        public string? Description { get; private set; }
        public List<string> WorkflowIds { get; private set; } = new();
        public List<TrainingTask> Tasks { get; private set; } = new();
        public TrainingStatus Status { get; private set; }
        public string? CreatedBy { get; private set; }
        public DateTime CreatedAt { get; private set; }
        public DateTime? StartedAt { get; private set; }
        public DateTime? CompletedAt { get; private set; }
        public Dictionary<string, object> Configuration { get; private set; } = new();
        public TrainingComparison? ComparisonResult { get; private set; }

        private TrainingSession() { }

        public static TrainingSession Create(string name, string? description = null, string? createdBy = null)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Session name is required", nameof(name));

            return new TrainingSession
            {
                Id = $"training-{Guid.NewGuid():N}",
                Name = name,
                Description = description,
                Status = TrainingStatus.Draft,
                CreatedBy = createdBy,
                CreatedAt = DateTime.UtcNow
            };
        }

        public void AddWorkflow(string workflowId)
        {
            if (!WorkflowIds.Contains(workflowId))
            {
                WorkflowIds.Add(workflowId);
            }
        }

        public void RemoveWorkflow(string workflowId)
        {
            WorkflowIds.Remove(workflowId);
        }

        public TrainingTask AddTask(string description, string? expectedOutcome = null)
        {
            var task = TrainingTask.Create(Id, description, expectedOutcome);
            Tasks.Add(task);
            return task;
        }

        public void SetReady()
        {
            if (WorkflowIds.Count < 2)
                throw new InvalidOperationException("At least 2 workflows are required for comparison");
            if (Tasks.Count == 0)
                throw new InvalidOperationException("At least 1 task is required");

            Status = TrainingStatus.Ready;
        }

        public void SetRunning()
        {
            Status = TrainingStatus.Running;
            StartedAt = DateTime.UtcNow;
        }

        public void SetCompleted(TrainingComparison? comparison = null)
        {
            Status = TrainingStatus.Completed;
            CompletedAt = DateTime.UtcNow;
            ComparisonResult = comparison;
        }

        public void SetFailed()
        {
            Status = TrainingStatus.Failed;
            CompletedAt = DateTime.UtcNow;
        }

        public void SetCancelled()
        {
            Status = TrainingStatus.Cancelled;
            CompletedAt = DateTime.UtcNow;
        }

        public void SetConfiguration(Dictionary<string, object> config)
        {
            Configuration = config ?? new Dictionary<string, object>();
        }
    }

    /// <summary>
    /// A task within a training session
    /// </summary>
    public class TrainingTask
    {
        public string Id { get; private set; }
        public string SessionId { get; private set; }
        public string Description { get; private set; }
        public string? ExpectedOutcome { get; private set; }
        public List<WorkflowRun> WorkflowRuns { get; private set; } = new();
        public DateTime CreatedAt { get; private set; }

        private TrainingTask() { }

        public static TrainingTask Create(string sessionId, string description, string? expectedOutcome = null)
        {
            return new TrainingTask
            {
                Id = $"task-{Guid.NewGuid():N}",
                SessionId = sessionId,
                Description = description,
                ExpectedOutcome = expectedOutcome,
                CreatedAt = DateTime.UtcNow
            };
        }

        public WorkflowRun AddRun(string workflowId, string workflowName)
        {
            var run = new WorkflowRun
            {
                Id = $"run-{Guid.NewGuid():N}",
                WorkflowId = workflowId,
                WorkflowName = workflowName,
                Status = "pending",
                StartedAt = DateTime.UtcNow
            };
            WorkflowRuns.Add(run);
            return run;
        }
    }

    /// <summary>
    /// A workflow run within a training task
    /// </summary>
    public class WorkflowRun
    {
        public string Id { get; set; }
        public string WorkflowId { get; set; }
        public string WorkflowName { get; set; }
        public string Status { get; set; } // "pending", "running", "completed", "failed"
        public DateTime StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public double? DurationSeconds { get; set; }
        public string? Output { get; set; }
        public string? ErrorMessage { get; set; }
        public Dictionary<string, double> Metrics { get; set; } = new();
    }

    /// <summary>
    /// Result of comparing workflow runs
    /// </summary>
    public class TrainingComparison
    {
        public string TaskId { get; set; }
        public List<WorkflowResult> Results { get; set; } = new();
        public string? BestPerformerId { get; set; }
        public string? BestPerformerName { get; set; }
        public Dictionary<string, double> AggregateMetrics { get; set; } = new();
        public string? Summary { get; set; }
    }

    /// <summary>
    /// Result for a specific workflow in comparison
    /// </summary>
    public class WorkflowResult
    {
        public string WorkflowId { get; set; }
        public string WorkflowName { get; set; }
        public double OverallScore { get; set; }
        public Dictionary<string, double> Metrics { get; set; } = new();
        public string? Output { get; set; }
        public bool Success { get; set; }
        public double DurationSeconds { get; set; }
    }
}
