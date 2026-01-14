using System;
using System.Collections.Generic;
using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities
{
    public class ExecutionContext
    {
        public ExecutionId Id { get; private set; }
        public string WorkflowId { get; private set; }
        public string Status { get; private set; }
        public Dictionary<string, object> Variables { get; private set; } = new();
        public Dictionary<string, BlockExecutionState> BlockStates { get; private set; } = new();
        public List<ExecutionLog> Logs { get; private set; } = new();
        public ExecutionMetrics Metrics { get; private set; } = new();
        public DateTimeOffset StartedAt { get; private set; }
        public DateTimeOffset? CompletedAt { get; private set; }

        private ExecutionContext() { }

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
