using System;
using System.Collections.Generic;
using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities
{

    public class ExecutionContext
    {
        public ExecutionId Id { get; set; }
        public string WorkflowId { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public Dictionary<string, object> Variables { get; set; } = new();
        public Dictionary<string, BlockExecutionState> BlockStates { get; set; } = new();
        public List<ExecutionLog> Logs { get; set; } = new();
        public ExecutionMetrics Metrics { get; set; } = new();
        public DateTimeOffset StartedAt { get; set; }
        public DateTimeOffset? CompletedAt { get; set; }

        // Public parameterless ctor for deserialization
        public ExecutionContext() { }

        public static ExecutionContext Create(string workflowId)
        {
            return new ExecutionContext
            {
                Id = ExecutionId.New(),
                WorkflowId = workflowId,
                Status = "Running",
                StartedAt = DateTimeOffset.UtcNow
            };
        }

        public void SetBlockOutput(string blockId, string portId, object value)
        {
            var key = $"{blockId}:{portId}";
            Variables[key] = value;
        }

        public object? GetBlockOutput(string blockId, string portId)
        {
            var key = $"{blockId}:{portId}";
            return Variables.TryGetValue(key, out var v) ? v : null;
        }

        public void LogInfo(string message, string? blockId = null)
        {
            Logs.Add(new ExecutionLog { Level = "Info", Message = message, BlockId = blockId });
        }

        public void LogError(string message, Exception? ex = null, string? blockId = null)
        {
            var m = message;
            if (ex != null) m = m + " - " + ex.Message;
            Logs.Add(new ExecutionLog { Level = "Error", Message = m, BlockId = blockId });
        }

        public void Complete()
        {
            Status = "Completed";
            CompletedAt = DateTimeOffset.UtcNow;
            Metrics.Duration = CompletedAt.Value - StartedAt;
        }

        public void Pause()
        {
            if (Status == "Running") Status = "Paused";
        }

        public void Resume()
        {
            if (Status == "Paused") Status = "Running";
        }

        public void Cancel()
        {
            if (Status != "Completed") Status = "Cancelled";
            CompletedAt = DateTimeOffset.UtcNow;
            Metrics.Duration = CompletedAt.Value - StartedAt;
        }
    }
}
