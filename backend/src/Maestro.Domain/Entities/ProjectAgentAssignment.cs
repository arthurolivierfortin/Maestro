using System;

namespace Maestro.Domain.Entities
{
    /// <summary>
    /// Represents an assignment of an agent to a project
    /// </summary>
    public class ProjectAgentAssignment
    {
        public string Id { get; private set; }
        public string ProjectId { get; private set; }
        public string AgentId { get; private set; }
        public string? AgentName { get; private set; }
        public string Role { get; private set; } // "primary", "reviewer", "tester", "support"
        public DateTime AssignedAt { get; private set; }
        public string? AssignedBy { get; private set; }
        public bool IsActive { get; private set; }
        public DateTime? DeactivatedAt { get; private set; }

        private ProjectAgentAssignment() { }

        public static ProjectAgentAssignment Create(
            string projectId,
            string agentId,
            string role = "primary",
            string? agentName = null,
            string? assignedBy = null)
        {
            if (string.IsNullOrWhiteSpace(projectId))
                throw new ArgumentException("Project ID is required", nameof(projectId));
            if (string.IsNullOrWhiteSpace(agentId))
                throw new ArgumentException("Agent ID is required", nameof(agentId));

            return new ProjectAgentAssignment
            {
                Id = $"assign-{Guid.NewGuid():N}",
                ProjectId = projectId,
                AgentId = agentId,
                AgentName = agentName,
                Role = role.ToLower(),
                AssignedAt = DateTime.UtcNow,
                AssignedBy = assignedBy,
                IsActive = true
            };
        }

        public void UpdateRole(string newRole)
        {
            Role = newRole.ToLower();
        }

        public void Deactivate()
        {
            IsActive = false;
            DeactivatedAt = DateTime.UtcNow;
        }

        public void Reactivate()
        {
            IsActive = true;
            DeactivatedAt = null;
        }
    }
}
