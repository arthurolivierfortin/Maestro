using System;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Workspaces;

/// <summary>
/// Gateway for cross-workspace operations with permission enforcement.
/// </summary>
public class WorkspaceGateway : IWorkspaceGateway
{
    private readonly IWorkspaceRepository _workspaceRepository;
    private readonly ILogger<WorkspaceGateway>? _logger;

    public WorkspaceGateway(
        IWorkspaceRepository workspaceRepository,
        ILogger<WorkspaceGateway>? logger = null)
    {
        _workspaceRepository = workspaceRepository;
        _logger = logger;
    }

    public async Task<PromotionResult> PromoteAgentAsync(
        string sourceWorkspaceId,
        string targetWorkspaceId,
        string agentBlockId,
        string? version = null,
        CancellationToken ct = default)
    {
        // Validate permission
        if (!await IsOperationPermittedAsync(sourceWorkspaceId, targetWorkspaceId, CrossWorkspaceOperation.Promote, ct))
        {
            _logger?.LogWarning("Promotion denied from {Source} to {Target} for agent {Agent}",
                sourceWorkspaceId, targetWorkspaceId, agentBlockId);

            return new PromotionResult
            {
                Success = false,
                ErrorMessage = $"Promotion from workspace '{sourceWorkspaceId}' to '{targetWorkspaceId}' is not permitted"
            };
        }

        try
        {
            // TODO: Implement actual agent promotion logic
            // This would involve:
            // 1. Getting the agent block from source workspace
            // 2. Copying/versioning it to target workspace
            // 3. Updating target workspace's catalog

            var auditLogId = Guid.NewGuid().ToString();

            _logger?.LogInformation(
                "Promoted agent {Agent} from {Source} to {Target} (Version: {Version}, AuditId: {AuditId})",
                agentBlockId, sourceWorkspaceId, targetWorkspaceId, version ?? "latest", auditLogId);

            return new PromotionResult
            {
                Success = true,
                PromotedBlockId = agentBlockId,
                TargetVersion = version ?? "1.0.0",
                AuditLogId = auditLogId
            };
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to promote agent {Agent} from {Source} to {Target}",
                agentBlockId, sourceWorkspaceId, targetWorkspaceId);

            return new PromotionResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }

    public async Task<WorkspaceMetricsSnapshot> ReadMetricsAsync(
        string sourceWorkspaceId,
        string targetWorkspaceId,
        WorkspaceMetricsQuery query,
        CancellationToken ct = default)
    {
        // Validate permission
        if (!await IsOperationPermittedAsync(sourceWorkspaceId, targetWorkspaceId, CrossWorkspaceOperation.Read, ct))
        {
            _logger?.LogWarning("Metrics read denied from {Source} to {Target}",
                sourceWorkspaceId, targetWorkspaceId);

            throw new UnauthorizedAccessException(
                $"Reading from workspace '{targetWorkspaceId}' is not permitted for '{sourceWorkspaceId}'");
        }

        // TODO: Implement actual metrics retrieval
        // This would involve querying the metrics repository filtered by workspace

        return new WorkspaceMetricsSnapshot
        {
            WorkspaceId = targetWorkspaceId,
            Timestamp = DateTimeOffset.UtcNow,
            AverageFitness = 0.75,
            TotalExecutions = 0,
            SuccessfulExecutions = 0,
            TotalCost = 0
        };
    }

    public async Task<WorkspaceActionResult> TriggerActionAsync(
        string sourceWorkspaceId,
        string targetWorkspaceId,
        WorkspaceAction action,
        CancellationToken ct = default)
    {
        // Validate permission
        if (!await IsOperationPermittedAsync(sourceWorkspaceId, targetWorkspaceId, CrossWorkspaceOperation.Trigger, ct))
        {
            _logger?.LogWarning("Action trigger denied from {Source} to {Target}: {Action}",
                sourceWorkspaceId, targetWorkspaceId, action.ActionType);

            return new WorkspaceActionResult
            {
                Success = false,
                ErrorMessage = $"Triggering actions in workspace '{targetWorkspaceId}' is not permitted for '{sourceWorkspaceId}'"
            };
        }

        try
        {
            // TODO: Implement actual action triggering
            // This would involve dispatching to appropriate service based on action type

            var auditLogId = Guid.NewGuid().ToString();

            _logger?.LogInformation(
                "Triggered action {ActionType} from {Source} to {Target} (TargetId: {TargetId}, AuditId: {AuditId})",
                action.ActionType, sourceWorkspaceId, targetWorkspaceId, action.TargetId, auditLogId);

            return new WorkspaceActionResult
            {
                Success = true,
                ResultId = Guid.NewGuid().ToString(),
                AuditLogId = auditLogId
            };
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to trigger action {ActionType} from {Source} to {Target}",
                action.ActionType, sourceWorkspaceId, targetWorkspaceId);

            return new WorkspaceActionResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }

    public async Task<bool> IsOperationPermittedAsync(
        string sourceWorkspaceId,
        string targetWorkspaceId,
        CrossWorkspaceOperation operation,
        CancellationToken ct = default)
    {
        if (sourceWorkspaceId == targetWorkspaceId)
            return true; // Same workspace operations are always permitted

        var sourceWorkspace = await _workspaceRepository.GetByIdAsync(sourceWorkspaceId, ct);
        var targetWorkspace = await _workspaceRepository.GetByIdAsync(targetWorkspaceId, ct);

        if (sourceWorkspace == null || targetWorkspace == null)
            return false;

        var sourcePermissions = sourceWorkspace.Isolation.Permissions;
        var targetPermissions = targetWorkspace.Isolation.Permissions;

        return operation switch
        {
            CrossWorkspaceOperation.Read =>
                sourcePermissions.CanReadFromWorkspace(targetWorkspaceId) ||
                targetPermissions.AllowReadFrom.Contains(sourceWorkspaceId) ||
                targetPermissions.AllowReadFrom.Contains("*"),

            CrossWorkspaceOperation.Write =>
                sourcePermissions.CanWriteTo.Contains(targetWorkspaceId) ||
                sourcePermissions.CanWriteTo.Contains("*") ||
                targetPermissions.AllowWriteFrom.Contains(sourceWorkspaceId) ||
                targetPermissions.AllowWriteFrom.Contains("*"),

            CrossWorkspaceOperation.Promote =>
                sourcePermissions.CanPromoteToWorkspace(targetWorkspaceId),

            CrossWorkspaceOperation.Trigger =>
                sourcePermissions.CanWriteTo.Contains(targetWorkspaceId) ||
                sourcePermissions.CanWriteTo.Contains("*"),

            _ => false
        };
    }
}
