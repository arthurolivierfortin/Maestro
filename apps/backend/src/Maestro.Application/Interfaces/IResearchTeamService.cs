using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Service for managing the research team workflow.
/// Orchestrates the self-improvement pipeline: Research -> Train -> Test -> Evaluate -> Document -> Publish
/// </summary>
public interface IResearchTeamService
{
    /// <summary>
    /// Start a research cycle for an agent.
    /// </summary>
    Task<ResearchCycleResult> StartResearchCycleAsync(
        ResearchCycleRequest request,
        CancellationToken ct = default);

    /// <summary>
    /// Get the status of a running research cycle.
    /// </summary>
    Task<ResearchCycleStatus> GetCycleStatusAsync(
        string cycleId,
        CancellationToken ct = default);

    /// <summary>
    /// Stop a running research cycle.
    /// </summary>
    Task StopCycleAsync(string cycleId, CancellationToken ct = default);

    /// <summary>
    /// Get research history for an agent.
    /// </summary>
    Task<IReadOnlyList<ResearchCycleResult>> GetHistoryAsync(
        string? agentId = null,
        int limit = 20,
        CancellationToken ct = default);

    /// <summary>
    /// Get pending improvements from research.
    /// </summary>
    Task<IReadOnlyList<ResearchProposal>> GetPendingProposalsAsync(
        string? agentId = null,
        CancellationToken ct = default);

    /// <summary>
    /// Approve a research proposal for implementation.
    /// </summary>
    Task<bool> ApproveProposalAsync(
        string proposalId,
        string? approvedBy = null,
        CancellationToken ct = default);

    /// <summary>
    /// Reject a research proposal.
    /// </summary>
    Task<bool> RejectProposalAsync(
        string proposalId,
        string reason,
        string? rejectedBy = null,
        CancellationToken ct = default);

    /// <summary>
    /// Get research team configuration.
    /// </summary>
    Task<ResearchTeamConfig> GetConfigAsync(CancellationToken ct = default);

    /// <summary>
    /// Update research team configuration.
    /// </summary>
    Task<ResearchTeamConfig> UpdateConfigAsync(
        ResearchTeamConfigUpdate update,
        CancellationToken ct = default);
}

/// <summary>
/// Request to start a research cycle.
/// </summary>
public class ResearchCycleRequest
{
    public string AgentId { get; set; } = string.Empty;
    public string? ImprovementGoal { get; set; }
    public double FitnessTarget { get; set; } = 0.85;
    public int MaxIterations { get; set; } = 50;
    public int MaxCycles { get; set; } = 3;
    public bool AutoPublish { get; set; } = false;
    public string? WorkspaceId { get; set; }
}

/// <summary>
/// Result of a research cycle.
/// </summary>
public class ResearchCycleResult
{
    public string CycleId { get; set; } = Guid.NewGuid().ToString();
    public string AgentId { get; set; } = string.Empty;
    public string AgentName { get; set; } = string.Empty;
    public ResearchCyclePhase FinalPhase { get; set; }
    public bool Success { get; set; }
    public double InitialFitness { get; set; }
    public double FinalFitness { get; set; }
    public double FitnessImprovement => FinalFitness - InitialFitness;
    public int CyclesRun { get; set; }
    public int TotalIterations { get; set; }
    public List<ResearchProposal> ProposalsImplemented { get; set; } = new();
    public string? PublishedVersion { get; set; }
    public string? DocumentationGenerated { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }
    public TimeSpan? Duration => CompletedAt.HasValue ? CompletedAt.Value - StartedAt : null;
}

/// <summary>
/// Status of a running research cycle.
/// </summary>
public class ResearchCycleStatus
{
    public string CycleId { get; set; } = string.Empty;
    public string AgentId { get; set; } = string.Empty;
    public ResearchCyclePhase CurrentPhase { get; set; }
    public int CurrentCycle { get; set; }
    public int MaxCycles { get; set; }
    public int CurrentIteration { get; set; }
    public int MaxIterations { get; set; }
    public double CurrentFitness { get; set; }
    public double TargetFitness { get; set; }
    public string? CurrentActivity { get; set; }
    public double ProgressPercent { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public TimeSpan Elapsed => DateTimeOffset.UtcNow - StartedAt;
    public List<string> RecentEvents { get; set; } = new();
}

/// <summary>
/// Phases of the research cycle.
/// </summary>
public enum ResearchCyclePhase
{
    NotStarted,
    Researching,
    Training,
    Testing,
    Evaluating,
    Documenting,
    Publishing,
    AnalyzingFailure,
    Completed,
    Failed,
    Stopped
}

/// <summary>
/// A research proposal for improvement.
/// </summary>
public class ResearchProposal
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string AgentId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public ProposalType Type { get; set; }
    public ProposalPriority Priority { get; set; }
    public double Confidence { get; set; }
    public double ExpectedImprovement { get; set; }
    public string? Evidence { get; set; }
    public Dictionary<string, object> SuggestedChanges { get; set; } = new();
    public ProposalStatus Status { get; set; } = ProposalStatus.Pending;
    public string? ApprovedBy { get; set; }
    public string? RejectedBy { get; set; }
    public string? RejectionReason { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ResolvedAt { get; set; }
}

/// <summary>
/// Type of research proposal.
/// </summary>
public enum ProposalType
{
    PromptOptimization,
    ConfigurationChange,
    ArchitecturalChange,
    ToolAddition,
    WorkflowModification,
    CapabilityExpansion,
    PerformanceOptimization,
    CostReduction
}

/// <summary>
/// Priority of a research proposal.
/// </summary>
public enum ProposalPriority
{
    Low,
    Medium,
    High,
    Critical
}

/// <summary>
/// Status of a research proposal.
/// </summary>
public enum ProposalStatus
{
    Pending,
    Approved,
    Rejected,
    Implemented,
    Validated,
    Failed
}

/// <summary>
/// Configuration for the research team.
/// </summary>
public class ResearchTeamConfig
{
    public bool Enabled { get; set; } = true;
    public double FitnessThreshold { get; set; } = 0.85;
    public int DefaultMaxIterations { get; set; } = 50;
    public int DefaultMaxCycles { get; set; } = 3;
    public bool AutoApproveProposals { get; set; } = false;
    public double AutoApproveMinConfidence { get; set; } = 0.9;
    public bool AutoPublishOnSuccess { get; set; } = false;
    public TimeSpan CycleTimeout { get; set; } = TimeSpan.FromHours(2);
    public List<string> ExcludedAgents { get; set; } = new();
    public List<string> PriorityAgents { get; set; } = new();
}

/// <summary>
/// Update for research team configuration.
/// </summary>
public class ResearchTeamConfigUpdate
{
    public bool? Enabled { get; set; }
    public double? FitnessThreshold { get; set; }
    public int? DefaultMaxIterations { get; set; }
    public int? DefaultMaxCycles { get; set; }
    public bool? AutoApproveProposals { get; set; }
    public double? AutoApproveMinConfidence { get; set; }
    public bool? AutoPublishOnSuccess { get; set; }
    public int? CycleTimeoutMinutes { get; set; }
}
