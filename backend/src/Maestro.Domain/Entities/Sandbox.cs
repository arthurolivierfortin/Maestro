using System;
using System.Collections.Generic;

namespace Maestro.Domain.Entities
{
    /// <summary>
    /// Status of a sandbox execution environment
    /// </summary>
    public enum SandboxStatus
    {
        Creating,
        Ready,
        Running,
        Completed,
        Failed,
        Destroyed
    }

    /// <summary>
    /// Represents an isolated sandbox environment for testing blocks, agents, or tools
    /// </summary>
    public class Sandbox
    {
        public string Id { get; private set; }
        public string? ContainerId { get; private set; }
        public string Type { get; private set; } // "block", "agent", "tool"
        public string TargetId { get; private set; }
        public string? TargetName { get; private set; }
        public SandboxStatus Status { get; private set; }
        public List<string> MockedBlocks { get; private set; } = new();
        public Dictionary<string, object> Configuration { get; private set; } = new();
        public List<SandboxLogEntry> Logs { get; private set; } = new();
        public string? ErrorMessage { get; private set; }
        public DateTime CreatedAt { get; private set; }
        public DateTime? StartedAt { get; private set; }
        public DateTime? CompletedAt { get; private set; }
        public int? ExitCode { get; private set; }
        public Dictionary<string, object>? Result { get; private set; }

        private Sandbox() { }

        public static Sandbox Create(string targetType, string targetId, string? targetName = null)
        {
            if (string.IsNullOrWhiteSpace(targetType))
                throw new ArgumentException("Target type is required", nameof(targetType));
            if (string.IsNullOrWhiteSpace(targetId))
                throw new ArgumentException("Target ID is required", nameof(targetId));

            return new Sandbox
            {
                Id = $"sandbox-{Guid.NewGuid():N}",
                Type = targetType.ToLower(),
                TargetId = targetId,
                TargetName = targetName,
                Status = SandboxStatus.Creating,
                CreatedAt = DateTime.UtcNow
            };
        }

        public void SetContainerId(string containerId)
        {
            ContainerId = containerId;
        }

        public void SetReady()
        {
            Status = SandboxStatus.Ready;
        }

        public void SetRunning()
        {
            Status = SandboxStatus.Running;
            StartedAt = DateTime.UtcNow;
        }

        public void SetCompleted(int exitCode, Dictionary<string, object>? result = null)
        {
            Status = SandboxStatus.Completed;
            CompletedAt = DateTime.UtcNow;
            ExitCode = exitCode;
            Result = result;
        }

        public void SetFailed(string errorMessage)
        {
            Status = SandboxStatus.Failed;
            CompletedAt = DateTime.UtcNow;
            ErrorMessage = errorMessage;
        }

        public void SetDestroyed()
        {
            Status = SandboxStatus.Destroyed;
        }

        public void AddMockedBlock(string blockId)
        {
            if (!MockedBlocks.Contains(blockId))
            {
                MockedBlocks.Add(blockId);
            }
        }

        public void SetConfiguration(Dictionary<string, object> config)
        {
            Configuration = config ?? new Dictionary<string, object>();
        }

        public void AddLog(string level, string message, string? source = null)
        {
            Logs.Add(new SandboxLogEntry
            {
                Timestamp = DateTime.UtcNow,
                Level = level,
                Message = message,
                Source = source
            });
        }
    }

    /// <summary>
    /// A log entry from sandbox execution
    /// </summary>
    public class SandboxLogEntry
    {
        public DateTime Timestamp { get; set; }
        public string Level { get; set; } = "info";
        public string Message { get; set; } = "";
        public string? Source { get; set; }
    }
}
