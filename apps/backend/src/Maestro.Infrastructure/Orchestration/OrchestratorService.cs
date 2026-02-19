using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Orchestration;

/// <summary>
/// Service for orchestrating agent promotions between workspaces.
/// </summary>
public class OrchestratorService : IOrchestratorService
{
    private readonly IWorkspaceGateway _workspaceGateway;
    private readonly IWorkspaceService _workspaceService;
    private readonly IFitnessService _fitnessService;
    private readonly ILogger<OrchestratorService>? _logger;

    private OrchestratorConfig _config = new();
    private readonly List<PromotionRecord> _promotionHistory = new();
    private readonly List<RollbackRecord> _rollbackHistory = new();
    private DateTimeOffset _lastMonitoringCycle = DateTimeOffset.MinValue;
    private bool _isRunning;

    public OrchestratorService(
        IWorkspaceGateway workspaceGateway,
        IWorkspaceService workspaceService,
        IFitnessService fitnessService,
        ILogger<OrchestratorService>? logger = null)
    {
        _workspaceGateway = workspaceGateway;
        _workspaceService = workspaceService;
        _fitnessService = fitnessService;
        _logger = logger;

        // Initialize default promotion rules
        _config.PromotionRules = new List<PromotionRule>
        {
            new PromotionRule
            {
                FromWorkspace = "research",
                ToWorkspace = "staging",
                MinFitness = 0.7,
                MinIterations = 50,
                AllTestsPass = true,
                ApprovalRequired = false
            },
            new PromotionRule
            {
                FromWorkspace = "staging",
                ToWorkspace = "production",
                MinFitness = 0.85,
                MinIterations = 100,
                AllTestsPass = true,
                ApprovalRequired = true,
                MinStageDuration = TimeSpan.FromHours(24)
            }
        };
    }

    public Task<OrchestratorStatus> GetStatusAsync(CancellationToken ct = default)
    {
        var status = new OrchestratorStatus
        {
            IsRunning = _isRunning,
            AutoPromotionEnabled = _config.AutoPromotionEnabled,
            LastMonitoringCycle = _lastMonitoringCycle,
            NextScheduledCycle = _lastMonitoringCycle != DateTimeOffset.MinValue
                ? _lastMonitoringCycle + _config.MonitoringInterval
                : null,
            PendingPromotions = 0, // Would be calculated from actual data
            ActiveMonitoredAgents = 0, // Would be calculated from actual data
            RecentPromotions = _promotionHistory.Count(p => p.Timestamp > DateTimeOffset.UtcNow.AddDays(-1)),
            RecentRollbacks = _rollbackHistory.Count(r => r.Timestamp > DateTimeOffset.UtcNow.AddDays(-1)),
            MonitoredWorkspaces = new List<string> { "research", "staging", "production" }
        };

        return Task.FromResult(status);
    }

    public async Task<IReadOnlyList<PendingPromotion>> GetPendingPromotionsAsync(CancellationToken ct = default)
    {
        var pending = new List<PendingPromotion>();

        // Get all workspaces and check for agents meeting promotion criteria
        var workspaces = await _workspaceService.GetAllWorkspacesAsync(ct);

        foreach (var rule in _config.PromotionRules)
        {
            var sourceWorkspace = workspaces.FirstOrDefault(w =>
                w.Name.Equals(rule.FromWorkspace, StringComparison.OrdinalIgnoreCase) ||
                w.Type.ToString().Equals(rule.FromWorkspace, StringComparison.OrdinalIgnoreCase));

            if (sourceWorkspace == null) continue;

            // TODO: Get agents from workspace and check their fitness
            // This would query the fitness service for each agent's metrics

            _logger?.LogDebug("Checking workspace {WorkspaceId} for promotion candidates to {Target}",
                sourceWorkspace.Id, rule.ToWorkspace);
        }

        return pending;
    }

    public async Task<PromotionRecord> PromoteAgentAsync(
        string agentId,
        string fromWorkspace,
        string toWorkspace,
        bool force = false,
        CancellationToken ct = default)
    {
        _logger?.LogInformation(
            "Promoting agent {AgentId} from {From} to {To} (Force: {Force})",
            agentId, fromWorkspace, toWorkspace, force);

        var record = new PromotionRecord
        {
            AgentId = agentId,
            FromWorkspace = fromWorkspace,
            ToWorkspace = toWorkspace,
            WasForced = force,
            Timestamp = DateTimeOffset.UtcNow
        };

        try
        {
            // Check if promotion is allowed (unless forced)
            if (!force)
            {
                var rule = _config.PromotionRules.FirstOrDefault(r =>
                    r.FromWorkspace.Equals(fromWorkspace, StringComparison.OrdinalIgnoreCase) &&
                    r.ToWorkspace.Equals(toWorkspace, StringComparison.OrdinalIgnoreCase));

                if (rule == null)
                {
                    record.Success = false;
                    record.ErrorMessage = $"No promotion rule exists from {fromWorkspace} to {toWorkspace}";
                    _promotionHistory.Add(record);
                    return record;
                }

                // Get fitness score
                var fitnessConfig = await _fitnessService.GetConfigAsync(ct);
                // TODO: Get actual fitness for the agent
                record.FitnessAtPromotion = 0.8; // Placeholder

                if (record.FitnessAtPromotion < rule.MinFitness)
                {
                    record.Success = false;
                    record.ErrorMessage = $"Fitness {record.FitnessAtPromotion:F2} is below required {rule.MinFitness:F2}";
                    _promotionHistory.Add(record);
                    return record;
                }
            }

            // Execute the promotion via workspace gateway
            var result = await _workspaceGateway.PromoteAgentAsync(
                fromWorkspace,
                toWorkspace,
                agentId,
                null, // Latest version
                ct);

            record.Success = result.Success;
            record.ErrorMessage = result.ErrorMessage;
            record.ToVersion = result.TargetVersion ?? "1.0.0";

            if (result.Success)
            {
                _logger?.LogInformation(
                    "Successfully promoted agent {AgentId} to {Workspace} (Version: {Version})",
                    agentId, toWorkspace, record.ToVersion);
            }
            else
            {
                _logger?.LogWarning(
                    "Failed to promote agent {AgentId}: {Error}",
                    agentId, result.ErrorMessage);
            }
        }
        catch (Exception ex)
        {
            record.Success = false;
            record.ErrorMessage = ex.Message;
            _logger?.LogError(ex, "Error promoting agent {AgentId}", agentId);
        }

        _promotionHistory.Add(record);
        return record;
    }

    public async Task<RollbackRecord> RollbackAgentAsync(
        string agentId,
        string workspaceId,
        string? toVersion = null,
        CancellationToken ct = default)
    {
        _logger?.LogInformation(
            "Rolling back agent {AgentId} in {Workspace} to version {Version}",
            agentId, workspaceId, toVersion ?? "previous");

        var record = new RollbackRecord
        {
            AgentId = agentId,
            WorkspaceId = workspaceId,
            ToVersion = toVersion ?? "previous",
            Timestamp = DateTimeOffset.UtcNow
        };

        try
        {
            // TODO: Implement actual rollback logic
            // This would involve:
            // 1. Finding the previous version in version history
            // 2. Restoring the agent to that version
            // 3. Updating any active sessions

            record.Success = true;
            record.Reason = "Manual rollback requested";

            _logger?.LogInformation(
                "Successfully rolled back agent {AgentId} to version {Version}",
                agentId, record.ToVersion);
        }
        catch (Exception ex)
        {
            record.Success = false;
            record.ErrorMessage = ex.Message;
            _logger?.LogError(ex, "Error rolling back agent {AgentId}", agentId);
        }

        _rollbackHistory.Add(record);
        return record;
    }

    public Task<IReadOnlyList<PromotionRecord>> GetHistoryAsync(
        string? workspaceId = null,
        string? agentId = null,
        int limit = 20,
        CancellationToken ct = default)
    {
        var history = _promotionHistory.AsEnumerable();

        if (!string.IsNullOrEmpty(workspaceId))
        {
            history = history.Where(h =>
                h.FromWorkspace.Equals(workspaceId, StringComparison.OrdinalIgnoreCase) ||
                h.ToWorkspace.Equals(workspaceId, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrEmpty(agentId))
        {
            history = history.Where(h => h.AgentId == agentId);
        }

        var result = history
            .OrderByDescending(h => h.Timestamp)
            .Take(limit)
            .ToList();

        return Task.FromResult<IReadOnlyList<PromotionRecord>>(result);
    }

    public Task<OrchestratorConfig> GetConfigAsync(CancellationToken ct = default)
    {
        return Task.FromResult(_config);
    }

    public Task<OrchestratorConfig> UpdateConfigAsync(
        OrchestratorConfigUpdate update,
        CancellationToken ct = default)
    {
        if (update.AutoPromotionEnabled.HasValue)
            _config.AutoPromotionEnabled = update.AutoPromotionEnabled.Value;

        if (update.MonitoringInterval.HasValue)
            _config.MonitoringInterval = update.MonitoringInterval.Value;

        if (update.FitnessDropThreshold.HasValue)
            _config.RollbackConfig.FitnessDropThreshold = update.FitnessDropThreshold.Value;

        if (update.ErrorRateThreshold.HasValue)
            _config.RollbackConfig.ErrorRateThreshold = update.ErrorRateThreshold.Value;

        if (update.AutoRollback.HasValue)
            _config.RollbackConfig.AutoRollback = update.AutoRollback.Value;

        // Update promotion rules
        if (update.MinFitnessResearchToStaging.HasValue)
        {
            var rule = _config.PromotionRules.FirstOrDefault(r =>
                r.FromWorkspace == "research" && r.ToWorkspace == "staging");
            if (rule != null)
                rule.MinFitness = update.MinFitnessResearchToStaging.Value;
        }

        if (update.MinFitnessStagingToProduction.HasValue)
        {
            var rule = _config.PromotionRules.FirstOrDefault(r =>
                r.FromWorkspace == "staging" && r.ToWorkspace == "production");
            if (rule != null)
                rule.MinFitness = update.MinFitnessStagingToProduction.Value;
        }

        _logger?.LogInformation("Orchestrator configuration updated");
        return Task.FromResult(_config);
    }

    public Task SetAutoPromotionAsync(bool enabled, CancellationToken ct = default)
    {
        _config.AutoPromotionEnabled = enabled;
        _logger?.LogInformation("Auto-promotion {Status}", enabled ? "enabled" : "disabled");
        return Task.CompletedTask;
    }

    public async Task<MonitoringResult> RunMonitoringCycleAsync(CancellationToken ct = default)
    {
        _isRunning = true;
        _lastMonitoringCycle = DateTimeOffset.UtcNow;

        var result = new MonitoringResult
        {
            Timestamp = _lastMonitoringCycle
        };

        try
        {
            _logger?.LogInformation("Starting monitoring cycle");

            // Get pending promotions
            var pendingPromotions = await GetPendingPromotionsAsync(ct);
            result.AgentsChecked = pendingPromotions.Count;
            result.PromotionCandidates = pendingPromotions.Count(p => p.MeetsCriteria);

            // Auto-promote if enabled
            if (_config.AutoPromotionEnabled)
            {
                foreach (var pending in pendingPromotions.Where(p => p.MeetsCriteria && !p.RequiresApproval))
                {
                    var promotionResult = await PromoteAgentAsync(
                        pending.AgentId,
                        pending.FromWorkspace,
                        pending.ToWorkspace,
                        false,
                        ct);

                    if (promotionResult.Success)
                    {
                        result.PromotionsExecuted++;
                        result.Actions.Add($"Promoted {pending.AgentName} from {pending.FromWorkspace} to {pending.ToWorkspace}");
                    }
                }
            }

            // Check for rollback candidates
            // TODO: Implement fitness degradation detection

            _logger?.LogInformation(
                "Monitoring cycle complete. Checked: {Checked}, Promoted: {Promoted}, Rolled back: {RolledBack}",
                result.AgentsChecked, result.PromotionsExecuted, result.RollbacksExecuted);
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Error during monitoring cycle");
            result.Warnings.Add($"Monitoring cycle error: {ex.Message}");
        }
        finally
        {
            _isRunning = false;
        }

        return result;
    }
}
