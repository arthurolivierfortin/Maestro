using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Service for orchestrating agent promotions between workspaces.
/// </summary>
public interface IOrchestratorService
{
    /// <summary>
    /// Get the current orchestrator status.
    /// </summary>
    Task<OrchestratorStatus> GetStatusAsync(CancellationToken ct = default);

    /// <summary>
    /// Get agents pending promotion.
    /// </summary>
    Task<IReadOnlyList<PendingPromotion>> GetPendingPromotionsAsync(CancellationToken ct = default);

    /// <summary>
    /// Promote an agent from one workspace to another.
    /// </summary>
    Task<PromotionRecord> PromoteAgentAsync(
        string agentId,
        string fromWorkspace,
        string toWorkspace,
        bool force = false,
        CancellationToken ct = default);

    /// <summary>
    /// Rollback an agent to a previous version.
    /// </summary>
    Task<RollbackRecord> RollbackAgentAsync(
        string agentId,
        string workspaceId,
        string? toVersion = null,
        CancellationToken ct = default);

    /// <summary>
    /// Get promotion history for an agent.
    /// </summary>
    Task<IReadOnlyList<PromotionRecord>> GetHistoryAsync(
        string? workspaceId = null,
        string? agentId = null,
        int limit = 20,
        CancellationToken ct = default);

    /// <summary>
    /// Get current orchestrator configuration.
    /// </summary>
    Task<OrchestratorConfig> GetConfigAsync(CancellationToken ct = default);

    /// <summary>
    /// Update orchestrator configuration.
    /// </summary>
    Task<OrchestratorConfig> UpdateConfigAsync(
        OrchestratorConfigUpdate update,
        CancellationToken ct = default);

    /// <summary>
    /// Enable or disable auto-promotion.
    /// </summary>
    Task SetAutoPromotionAsync(bool enabled, CancellationToken ct = default);

    /// <summary>
    /// Run a monitoring cycle (check for agents to promote/rollback).
    /// </summary>
    Task<MonitoringResult> RunMonitoringCycleAsync(CancellationToken ct = default);
}

/// <summary>
/// Current status of the orchestrator.
/// </summary>
public class OrchestratorStatus
{
    public bool IsRunning { get; set; }
    public bool AutoPromotionEnabled { get; set; }
    public DateTimeOffset LastMonitoringCycle { get; set; }
    public DateTimeOffset? NextScheduledCycle { get; set; }
    public int PendingPromotions { get; set; }
    public int ActiveMonitoredAgents { get; set; }
    public int RecentPromotions { get; set; }
    public int RecentRollbacks { get; set; }
    public List<string> MonitoredWorkspaces { get; set; } = new();
}

/// <summary>
/// An agent pending promotion.
/// </summary>
public class PendingPromotion
{
    public string AgentId { get; set; } = string.Empty;
    public string AgentName { get; set; } = string.Empty;
    public string FromWorkspace { get; set; } = string.Empty;
    public string ToWorkspace { get; set; } = string.Empty;
    public double CurrentFitness { get; set; }
    public double RequiredFitness { get; set; }
    public int Iterations { get; set; }
    public int RequiredIterations { get; set; }
    public bool TestsPassed { get; set; }
    public bool MeetsCriteria { get; set; }
    public bool RequiresApproval { get; set; }
    public DateTimeOffset QualifiedAt { get; set; }
    public string? BlockingReason { get; set; }
}

/// <summary>
/// Record of a promotion action.
/// </summary>
public class PromotionRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string AgentId { get; set; } = string.Empty;
    public string AgentName { get; set; } = string.Empty;
    public string FromWorkspace { get; set; } = string.Empty;
    public string ToWorkspace { get; set; } = string.Empty;
    public string FromVersion { get; set; } = string.Empty;
    public string ToVersion { get; set; } = string.Empty;
    public double FitnessAtPromotion { get; set; }
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public bool WasForced { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// Record of a rollback action.
/// </summary>
public class RollbackRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string AgentId { get; set; } = string.Empty;
    public string AgentName { get; set; } = string.Empty;
    public string WorkspaceId { get; set; } = string.Empty;
    public string FromVersion { get; set; } = string.Empty;
    public string ToVersion { get; set; } = string.Empty;
    public double FitnessBeforeRollback { get; set; }
    public string Reason { get; set; } = string.Empty;
    public bool WasAutomatic { get; set; }
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// Orchestrator configuration.
/// </summary>
public class OrchestratorConfig
{
    public bool AutoPromotionEnabled { get; set; } = true;
    public TimeSpan MonitoringInterval { get; set; } = TimeSpan.FromMinutes(5);
    public List<PromotionRule> PromotionRules { get; set; } = new();
    public RollbackConfig RollbackConfig { get; set; } = new();
    public AlertingConfig AlertingConfig { get; set; } = new();
}

/// <summary>
/// Rule for promoting agents between workspaces.
/// </summary>
public class PromotionRule
{
    public string FromWorkspace { get; set; } = string.Empty;
    public string ToWorkspace { get; set; } = string.Empty;
    public double MinFitness { get; set; } = 0.7;
    public int MinIterations { get; set; } = 50;
    public bool AllTestsPass { get; set; } = true;
    public bool NoRegressions { get; set; } = true;
    public bool ApprovalRequired { get; set; } = false;
    public TimeSpan? MinStageDuration { get; set; }
}

/// <summary>
/// Configuration for automatic rollbacks.
/// </summary>
public class RollbackConfig
{
    public double FitnessDropThreshold { get; set; } = 0.1;
    public double ErrorRateThreshold { get; set; } = 0.05;
    public double LatencyIncreaseThreshold { get; set; } = 0.5;
    public bool AutoRollback { get; set; } = true;
    public int MaxRollbackVersions { get; set; } = 3;
}

/// <summary>
/// Configuration for alerting.
/// </summary>
public class AlertingConfig
{
    public bool Enabled { get; set; } = true;
    public List<string> Channels { get; set; } = new() { "log", "event" };
    public double FitnessWarningThreshold { get; set; } = 0.75;
    public double FitnessCriticalThreshold { get; set; } = 0.6;
    public double ErrorRateWarningThreshold { get; set; } = 0.02;
    public double ErrorRateCriticalThreshold { get; set; } = 0.05;
}

/// <summary>
/// Update to orchestrator configuration.
/// </summary>
public class OrchestratorConfigUpdate
{
    public bool? AutoPromotionEnabled { get; set; }
    public TimeSpan? MonitoringInterval { get; set; }
    public double? MinFitnessResearchToStaging { get; set; }
    public double? MinFitnessStagingToProduction { get; set; }
    public double? FitnessDropThreshold { get; set; }
    public double? ErrorRateThreshold { get; set; }
    public bool? AutoRollback { get; set; }
}

/// <summary>
/// Result of a monitoring cycle.
/// </summary>
public class MonitoringResult
{
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
    public int AgentsChecked { get; set; }
    public int PromotionCandidates { get; set; }
    public int PromotionsExecuted { get; set; }
    public int RollbackCandidates { get; set; }
    public int RollbacksExecuted { get; set; }
    public int AlertsGenerated { get; set; }
    public List<string> Actions { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}
