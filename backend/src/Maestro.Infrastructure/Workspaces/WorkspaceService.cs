using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Workspaces;

/// <summary>
/// Service for managing workspaces.
/// </summary>
public class WorkspaceService : IWorkspaceService
{
    private readonly IWorkspaceRepository _repository;
    private readonly ILogger<WorkspaceService>? _logger;

    public WorkspaceService(IWorkspaceRepository repository, ILogger<WorkspaceService>? logger = null)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task<Workspace> CreateWorkspaceAsync(
        string name,
        WorkspaceType type,
        string? description = null,
        bool isolated = false,
        WorkspaceIsolation? isolationConfig = null,
        CancellationToken ct = default)
    {
        Workspace workspace;

        if (isolated)
        {
            var isolation = isolationConfig ?? WorkspaceIsolation.CreateIsolated(
                $"maestro-{name.ToLowerInvariant().Replace(" ", "-")}-network",
                WorkspaceResourceLimits.Default,
                GetDefaultPermissionsForType(type));

            workspace = Workspace.CreateIsolated(name, type, isolation, description);
        }
        else
        {
            workspace = Workspace.Create(name, type, description);
        }

        await _repository.SaveAsync(workspace, ct);

        _logger?.LogInformation("Created workspace {Id}: {Name} (Type: {Type}, Isolated: {Isolated})",
            workspace.Id, workspace.Name, workspace.Type, isolated);

        return workspace;
    }

    public Task<Workspace?> GetWorkspaceAsync(string id, CancellationToken ct = default)
    {
        return _repository.GetByIdAsync(id, ct);
    }

    public Task<IReadOnlyList<Workspace>> GetAllWorkspacesAsync(CancellationToken ct = default)
    {
        return _repository.GetAllAsync(ct);
    }

    public Task<IReadOnlyList<Workspace>> GetWorkspacesByTypeAsync(WorkspaceType type, CancellationToken ct = default)
    {
        return _repository.GetByTypeAsync(type, ct);
    }

    public async Task<Workspace> UpdateWorkspaceAsync(
        string id,
        string? name = null,
        string? description = null,
        WorkspaceSettings? settings = null,
        CancellationToken ct = default)
    {
        var workspace = await _repository.GetByIdAsync(id, ct)
            ?? throw new ArgumentException($"Workspace {id} not found");

        if (!string.IsNullOrEmpty(name))
            workspace.UpdateName(name);

        if (description != null)
            workspace.UpdateDescription(description);

        if (settings != null)
            workspace.UpdateSettings(settings);

        await _repository.SaveAsync(workspace, ct);

        _logger?.LogInformation("Updated workspace {Id}", id);

        return workspace;
    }

    public async Task<Workspace> UpdateIsolationAsync(
        string id,
        WorkspaceIsolation isolation,
        CancellationToken ct = default)
    {
        var workspace = await _repository.GetByIdAsync(id, ct)
            ?? throw new ArgumentException($"Workspace {id} not found");

        workspace.UpdateIsolation(isolation);
        await _repository.SaveAsync(workspace, ct);

        _logger?.LogInformation("Updated isolation for workspace {Id}: Enabled={Enabled}", id, isolation.Enabled);

        return workspace;
    }

    public async Task DeleteWorkspaceAsync(string id, CancellationToken ct = default)
    {
        var workspace = await _repository.GetByIdAsync(id, ct);
        if (workspace == null)
            return;

        if (workspace.SessionIds.Count > 0 || workspace.ProjectIds.Count > 0)
        {
            throw new InvalidOperationException(
                $"Cannot delete workspace with active sessions ({workspace.SessionIds.Count}) or projects ({workspace.ProjectIds.Count})");
        }

        await _repository.DeleteAsync(id, ct);

        _logger?.LogInformation("Deleted workspace {Id}", id);
    }

    public async Task<Workspace> AddSessionAsync(string workspaceId, string sessionId, CancellationToken ct = default)
    {
        var workspace = await _repository.GetByIdAsync(workspaceId, ct)
            ?? throw new ArgumentException($"Workspace {workspaceId} not found");

        workspace.AddSession(sessionId);
        await _repository.SaveAsync(workspace, ct);

        _logger?.LogDebug("Added session {SessionId} to workspace {WorkspaceId}", sessionId, workspaceId);

        return workspace;
    }

    public async Task<Workspace> RemoveSessionAsync(string workspaceId, string sessionId, CancellationToken ct = default)
    {
        var workspace = await _repository.GetByIdAsync(workspaceId, ct)
            ?? throw new ArgumentException($"Workspace {workspaceId} not found");

        workspace.RemoveSession(sessionId);
        await _repository.SaveAsync(workspace, ct);

        _logger?.LogDebug("Removed session {SessionId} from workspace {WorkspaceId}", sessionId, workspaceId);

        return workspace;
    }

    public async Task<Workspace> AddProjectAsync(string workspaceId, string projectId, CancellationToken ct = default)
    {
        var workspace = await _repository.GetByIdAsync(workspaceId, ct)
            ?? throw new ArgumentException($"Workspace {workspaceId} not found");

        workspace.AddProject(projectId);
        await _repository.SaveAsync(workspace, ct);

        _logger?.LogDebug("Added project {ProjectId} to workspace {WorkspaceId}", projectId, workspaceId);

        return workspace;
    }

    public async Task<Workspace> RemoveProjectAsync(string workspaceId, string projectId, CancellationToken ct = default)
    {
        var workspace = await _repository.GetByIdAsync(workspaceId, ct)
            ?? throw new ArgumentException($"Workspace {workspaceId} not found");

        workspace.RemoveProject(projectId);
        await _repository.SaveAsync(workspace, ct);

        _logger?.LogDebug("Removed project {ProjectId} from workspace {WorkspaceId}", projectId, workspaceId);

        return workspace;
    }

    public async Task<Workspace> PauseWorkspaceAsync(string id, CancellationToken ct = default)
    {
        var workspace = await _repository.GetByIdAsync(id, ct)
            ?? throw new ArgumentException($"Workspace {id} not found");

        workspace.Pause();
        await _repository.SaveAsync(workspace, ct);

        _logger?.LogInformation("Paused workspace {Id}", id);

        return workspace;
    }

    public async Task<Workspace> ResumeWorkspaceAsync(string id, CancellationToken ct = default)
    {
        var workspace = await _repository.GetByIdAsync(id, ct)
            ?? throw new ArgumentException($"Workspace {id} not found");

        workspace.Resume();
        await _repository.SaveAsync(workspace, ct);

        _logger?.LogInformation("Resumed workspace {Id}", id);

        return workspace;
    }

    public async Task<Workspace> ArchiveWorkspaceAsync(string id, CancellationToken ct = default)
    {
        var workspace = await _repository.GetByIdAsync(id, ct)
            ?? throw new ArgumentException($"Workspace {id} not found");

        workspace.Archive();
        await _repository.SaveAsync(workspace, ct);

        _logger?.LogInformation("Archived workspace {Id}", id);

        return workspace;
    }

    public async Task<WorkspaceTopology> GetTopologyAsync(CancellationToken ct = default)
    {
        var workspaces = await _repository.GetAllAsync(ct);

        var topology = new WorkspaceTopology
        {
            Nodes = workspaces.Select(w => new WorkspaceNode
            {
                WorkspaceId = w.Id,
                Name = w.Name,
                Type = w.Type,
                SessionCount = w.SessionIds.Count,
                ProjectCount = w.ProjectIds.Count,
                IsIsolated = w.Isolation.Enabled
            }).ToList(),
            Edges = new List<WorkspaceEdge>()
        };

        // Build edges based on permissions
        foreach (var workspace in workspaces)
        {
            foreach (var targetId in workspace.Isolation.Permissions.CanPromoteTo)
            {
                if (targetId == "*")
                {
                    // Add edges to all other workspaces
                    foreach (var other in workspaces.Where(w => w.Id != workspace.Id))
                    {
                        topology.Edges.Add(new WorkspaceEdge
                        {
                            SourceWorkspaceId = workspace.Id,
                            TargetWorkspaceId = other.Id,
                            EdgeType = "promotion"
                        });
                    }
                }
                else
                {
                    topology.Edges.Add(new WorkspaceEdge
                    {
                        SourceWorkspaceId = workspace.Id,
                        TargetWorkspaceId = targetId,
                        EdgeType = "promotion"
                    });
                }
            }

            foreach (var sourceId in workspace.Isolation.Permissions.CanReadFrom)
            {
                if (sourceId == "*")
                {
                    foreach (var other in workspaces.Where(w => w.Id != workspace.Id))
                    {
                        topology.Edges.Add(new WorkspaceEdge
                        {
                            SourceWorkspaceId = workspace.Id,
                            TargetWorkspaceId = other.Id,
                            EdgeType = "read"
                        });
                    }
                }
                else
                {
                    topology.Edges.Add(new WorkspaceEdge
                    {
                        SourceWorkspaceId = workspace.Id,
                        TargetWorkspaceId = sourceId,
                        EdgeType = "read"
                    });
                }
            }
        }

        return topology;
    }

    private static WorkspacePermissions GetDefaultPermissionsForType(WorkspaceType type)
    {
        return type switch
        {
            WorkspaceType.Research => WorkspacePermissions.ForResearch(),
            WorkspaceType.Staging => WorkspacePermissions.ForStaging(),
            WorkspaceType.Production => WorkspacePermissions.ForProduction(),
            _ => new WorkspacePermissions()
        };
    }
}
