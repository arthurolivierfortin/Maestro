using System;
using System.Collections.Generic;

namespace Maestro.Domain.Entities
{
    /// <summary>
    /// Represents an activity record for an agent in a project context
    /// </summary>
    public class AgentActivity
    {
        public string Id { get; private set; }
        public string AgentId { get; private set; }
        public string? AgentName { get; private set; }
        public string? ProjectId { get; private set; }
        public string ActionType { get; private set; } // "task_started", "task_completed", "error", "file_modified", etc.
        public string Description { get; private set; }
        public DateTime Timestamp { get; private set; }
        public Dictionary<string, object> Metadata { get; private set; } = new();
        public string? ExecutionId { get; private set; }
        public string? RelatedBlockId { get; private set; }
        public double? Duration { get; private set; } // in seconds
        public bool? Success { get; private set; }

        private AgentActivity() { }

        public static AgentActivity Create(
            string agentId,
            string actionType,
            string description,
            string? projectId = null,
            string? agentName = null)
        {
            if (string.IsNullOrWhiteSpace(agentId))
                throw new ArgumentException("Agent ID is required", nameof(agentId));
            if (string.IsNullOrWhiteSpace(actionType))
                throw new ArgumentException("Action type is required", nameof(actionType));

            return new AgentActivity
            {
                Id = $"activity-{Guid.NewGuid():N}",
                AgentId = agentId,
                AgentName = agentName,
                ProjectId = projectId,
                ActionType = actionType.ToLower(),
                Description = description ?? "",
                Timestamp = DateTime.UtcNow
            };
        }

        public void SetMetadata(Dictionary<string, object> metadata)
        {
            Metadata = metadata ?? new Dictionary<string, object>();
        }

        public void SetExecutionContext(string? executionId, string? relatedBlockId)
        {
            ExecutionId = executionId;
            RelatedBlockId = relatedBlockId;
        }

        public void SetResult(double duration, bool success)
        {
            Duration = duration;
            Success = success;
        }
    }
}
