using Microsoft.AspNetCore.Mvc;
using Maestro.Domain.Entities;
using System.Collections.Concurrent;

namespace Maestro.Api.Controllers
{
    /// <summary>
    /// Controller for project monitoring and agent activity tracking
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class MonitoringController : ControllerBase
    {
        private static readonly ConcurrentDictionary<string, ProjectAgentAssignment> _assignments = new();
        private static readonly ConcurrentDictionary<string, AgentActivity> _activities = new();
        private readonly ILogger<MonitoringController> _logger;

        public MonitoringController(ILogger<MonitoringController> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// Get monitoring dashboard for a project
        /// </summary>
        [HttpGet("projects/{projectId}")]
        public ActionResult<ProjectMonitoringDashboard> GetProjectMonitoring(string projectId)
        {
            var assignments = _assignments.Values
                .Where(a => a.ProjectId == projectId && a.IsActive)
                .ToList();

            var activities = _activities.Values
                .Where(a => a.ProjectId == projectId)
                .OrderByDescending(a => a.Timestamp)
                .Take(50)
                .ToList();

            var dashboard = new ProjectMonitoringDashboard
            {
                ProjectId = projectId,
                AssignedAgents = assignments.Select(a => new AssignedAgentSummary
                {
                    AssignmentId = a.Id,
                    AgentId = a.AgentId,
                    AgentName = a.AgentName ?? a.AgentId,
                    Role = a.Role,
                    AssignedAt = a.AssignedAt,
                    RecentActivityCount = _activities.Values.Count(act =>
                        act.AgentId == a.AgentId &&
                        act.ProjectId == projectId &&
                        act.Timestamp > DateTime.UtcNow.AddHours(-24))
                }).ToList(),
                RecentActivity = activities.Select(MapActivityToResponse).ToList(),
                Stats = new ProjectStats
                {
                    TotalAgents = assignments.Count,
                    ActiveAgentsLast24h = assignments.Count(a =>
                        _activities.Values.Any(act =>
                            act.AgentId == a.AgentId &&
                            act.ProjectId == projectId &&
                            act.Timestamp > DateTime.UtcNow.AddHours(-24))),
                    TotalActivitiesToday = activities.Count(a => a.Timestamp.Date == DateTime.UtcNow.Date),
                    SuccessRate = activities.Any()
                        ? activities.Where(a => a.Success.HasValue).Average(a => a.Success == true ? 100.0 : 0.0)
                        : 0
                }
            };

            return Ok(dashboard);
        }

        /// <summary>
        /// Get agent activity for a project
        /// </summary>
        [HttpGet("projects/{projectId}/agents/activity")]
        public ActionResult<IEnumerable<AgentActivityResponse>> GetProjectAgentActivity(
            string projectId,
            [FromQuery] string? agentId = null,
            [FromQuery] DateTime? since = null,
            [FromQuery] int limit = 100)
        {
            var activities = _activities.Values
                .Where(a => a.ProjectId == projectId)
                .AsEnumerable();

            if (!string.IsNullOrEmpty(agentId))
            {
                activities = activities.Where(a => a.AgentId == agentId);
            }

            if (since.HasValue)
            {
                activities = activities.Where(a => a.Timestamp >= since.Value);
            }

            var result = activities
                .OrderByDescending(a => a.Timestamp)
                .Take(limit)
                .Select(MapActivityToResponse)
                .ToList();

            return Ok(result);
        }

        /// <summary>
        /// Attach an agent to a project
        /// </summary>
        [HttpPost("projects/{projectId}/agents/{agentId}/attach")]
        public ActionResult<ProjectAgentAssignmentResponse> AttachAgent(
            string projectId,
            string agentId,
            [FromBody] AttachAgentRequest? request)
        {
            // Check if already attached
            var existing = _assignments.Values
                .FirstOrDefault(a => a.ProjectId == projectId && a.AgentId == agentId && a.IsActive);

            if (existing != null)
            {
                return BadRequest(new { error = "Agent is already attached to this project" });
            }

            var assignment = ProjectAgentAssignment.Create(
                projectId,
                agentId,
                request?.Role ?? "primary",
                request?.AgentName,
                request?.AssignedBy);

            _assignments[assignment.Id] = assignment;

            // Log the activity
            var activity = AgentActivity.Create(
                agentId,
                "agent_attached",
                $"Agent attached to project with role: {assignment.Role}",
                projectId,
                request?.AgentName);
            _activities[activity.Id] = activity;

            _logger.LogInformation("Attached agent {AgentId} to project {ProjectId} with role {Role}",
                agentId, projectId, assignment.Role);

            return Ok(new ProjectAgentAssignmentResponse
            {
                Id = assignment.Id,
                ProjectId = assignment.ProjectId,
                AgentId = assignment.AgentId,
                AgentName = assignment.AgentName,
                Role = assignment.Role,
                AssignedAt = assignment.AssignedAt,
                IsActive = assignment.IsActive
            });
        }

        /// <summary>
        /// Detach an agent from a project
        /// </summary>
        [HttpDelete("projects/{projectId}/agents/{agentId}")]
        public ActionResult DetachAgent(string projectId, string agentId)
        {
            var assignment = _assignments.Values
                .FirstOrDefault(a => a.ProjectId == projectId && a.AgentId == agentId && a.IsActive);

            if (assignment == null)
            {
                return NotFound(new { error = "Agent is not attached to this project" });
            }

            assignment.Deactivate();

            // Log the activity
            var activity = AgentActivity.Create(
                agentId,
                "agent_detached",
                "Agent detached from project",
                projectId,
                assignment.AgentName);
            _activities[activity.Id] = activity;

            _logger.LogInformation("Detached agent {AgentId} from project {ProjectId}", agentId, projectId);

            return Ok(new { message = "Agent detached successfully" });
        }

        /// <summary>
        /// Record an agent activity
        /// </summary>
        [HttpPost("activity")]
        public ActionResult<AgentActivityResponse> RecordActivity([FromBody] RecordActivityRequest request)
        {
            var activity = AgentActivity.Create(
                request.AgentId,
                request.ActionType,
                request.Description,
                request.ProjectId,
                request.AgentName);

            if (request.Metadata != null)
            {
                activity.SetMetadata(request.Metadata);
            }

            if (!string.IsNullOrEmpty(request.ExecutionId) || !string.IsNullOrEmpty(request.RelatedBlockId))
            {
                activity.SetExecutionContext(request.ExecutionId, request.RelatedBlockId);
            }

            if (request.Duration.HasValue && request.Success.HasValue)
            {
                activity.SetResult(request.Duration.Value, request.Success.Value);
            }

            _activities[activity.Id] = activity;

            return Ok(MapActivityToResponse(activity));
        }

        /// <summary>
        /// Get all assigned agents for a project
        /// </summary>
        [HttpGet("projects/{projectId}/agents")]
        public ActionResult<IEnumerable<ProjectAgentAssignmentResponse>> GetProjectAgents(
            string projectId,
            [FromQuery] bool includeInactive = false)
        {
            var assignments = _assignments.Values
                .Where(a => a.ProjectId == projectId)
                .Where(a => includeInactive || a.IsActive)
                .Select(a => new ProjectAgentAssignmentResponse
                {
                    Id = a.Id,
                    ProjectId = a.ProjectId,
                    AgentId = a.AgentId,
                    AgentName = a.AgentName,
                    Role = a.Role,
                    AssignedAt = a.AssignedAt,
                    IsActive = a.IsActive,
                    DeactivatedAt = a.DeactivatedAt
                })
                .ToList();

            return Ok(assignments);
        }

        private static AgentActivityResponse MapActivityToResponse(AgentActivity activity)
        {
            return new AgentActivityResponse
            {
                Id = activity.Id,
                AgentId = activity.AgentId,
                AgentName = activity.AgentName,
                ProjectId = activity.ProjectId,
                ActionType = activity.ActionType,
                Description = activity.Description,
                Timestamp = activity.Timestamp,
                Metadata = activity.Metadata,
                ExecutionId = activity.ExecutionId,
                RelatedBlockId = activity.RelatedBlockId,
                Duration = activity.Duration,
                Success = activity.Success
            };
        }
    }

    // Request/Response DTOs
    public class AttachAgentRequest
    {
        public string? AgentName { get; set; }
        public string Role { get; set; } = "primary";
        public string? AssignedBy { get; set; }
    }

    public class RecordActivityRequest
    {
        public string AgentId { get; set; } = "";
        public string? AgentName { get; set; }
        public string? ProjectId { get; set; }
        public string ActionType { get; set; } = "";
        public string Description { get; set; } = "";
        public Dictionary<string, object>? Metadata { get; set; }
        public string? ExecutionId { get; set; }
        public string? RelatedBlockId { get; set; }
        public double? Duration { get; set; }
        public bool? Success { get; set; }
    }

    public class ProjectAgentAssignmentResponse
    {
        public string Id { get; set; } = "";
        public string ProjectId { get; set; } = "";
        public string AgentId { get; set; } = "";
        public string? AgentName { get; set; }
        public string Role { get; set; } = "";
        public DateTime AssignedAt { get; set; }
        public bool IsActive { get; set; }
        public DateTime? DeactivatedAt { get; set; }
    }

    public class AgentActivityResponse
    {
        public string Id { get; set; } = "";
        public string AgentId { get; set; } = "";
        public string? AgentName { get; set; }
        public string? ProjectId { get; set; }
        public string ActionType { get; set; } = "";
        public string Description { get; set; } = "";
        public DateTime Timestamp { get; set; }
        public Dictionary<string, object>? Metadata { get; set; }
        public string? ExecutionId { get; set; }
        public string? RelatedBlockId { get; set; }
        public double? Duration { get; set; }
        public bool? Success { get; set; }
    }

    public class ProjectMonitoringDashboard
    {
        public string ProjectId { get; set; } = "";
        public List<AssignedAgentSummary> AssignedAgents { get; set; } = new();
        public List<AgentActivityResponse> RecentActivity { get; set; } = new();
        public ProjectStats Stats { get; set; } = new();
    }

    public class AssignedAgentSummary
    {
        public string AssignmentId { get; set; } = "";
        public string AgentId { get; set; } = "";
        public string AgentName { get; set; } = "";
        public string Role { get; set; } = "";
        public DateTime AssignedAt { get; set; }
        public int RecentActivityCount { get; set; }
    }

    public class ProjectStats
    {
        public int TotalAgents { get; set; }
        public int ActiveAgentsLast24h { get; set; }
        public int TotalActivitiesToday { get; set; }
        public double SuccessRate { get; set; }
    }
}
