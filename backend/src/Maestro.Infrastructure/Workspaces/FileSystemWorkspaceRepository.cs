using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Workspaces;

/// <summary>
/// File system-based repository for workspaces.
/// </summary>
public class FileSystemWorkspaceRepository : IWorkspaceRepository
{
    private readonly string _storagePath;
    private readonly ILogger<FileSystemWorkspaceRepository>? _logger;
    private readonly ConcurrentDictionary<string, Workspace> _cache = new();
    private readonly SemaphoreSlim _lock = new(1, 1);
    private bool _initialized;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public FileSystemWorkspaceRepository(string storagePath, ILogger<FileSystemWorkspaceRepository>? logger = null)
    {
        _storagePath = storagePath;
        _logger = logger;

        if (!Directory.Exists(_storagePath))
        {
            Directory.CreateDirectory(_storagePath);
        }
    }

    private async Task EnsureInitializedAsync(CancellationToken ct)
    {
        if (_initialized) return;

        await _lock.WaitAsync(ct);
        try
        {
            if (_initialized) return;

            var files = Directory.GetFiles(_storagePath, "*.json");
            foreach (var file in files)
            {
                try
                {
                    var json = await File.ReadAllTextAsync(file, ct);
                    var workspace = JsonSerializer.Deserialize<WorkspaceData>(json, JsonOptions);
                    if (workspace != null)
                    {
                        _cache[workspace.Id] = workspace.ToDomain();
                    }
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex, "Failed to load workspace from {File}", file);
                }
            }

            _initialized = true;
            _logger?.LogInformation("Loaded {Count} workspaces", _cache.Count);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<Workspace?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);
        return _cache.TryGetValue(id, out var workspace) ? workspace : null;
    }

    public async Task<IReadOnlyList<Workspace>> GetAllAsync(CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);
        return _cache.Values.ToList();
    }

    public async Task<IReadOnlyList<Workspace>> GetByTypeAsync(WorkspaceType type, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);
        return _cache.Values.Where(w => w.Type == type).ToList();
    }

    public async Task<IReadOnlyList<Workspace>> GetBySessionIdAsync(string sessionId, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);
        return _cache.Values.Where(w => w.SessionIds.Contains(sessionId)).ToList();
    }

    public async Task<IReadOnlyList<Workspace>> GetByProjectIdAsync(string projectId, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);
        return _cache.Values.Where(w => w.ProjectIds.Contains(projectId)).ToList();
    }

    public async Task SaveAsync(Workspace workspace, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        var data = WorkspaceData.FromDomain(workspace);
        var json = JsonSerializer.Serialize(data, JsonOptions);
        var filePath = Path.Combine(_storagePath, $"{workspace.Id}.json");

        await File.WriteAllTextAsync(filePath, json, ct);
        _cache[workspace.Id] = workspace;

        _logger?.LogDebug("Saved workspace {Id}", workspace.Id);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        var filePath = Path.Combine(_storagePath, $"{id}.json");
        if (File.Exists(filePath))
        {
            File.Delete(filePath);
        }

        _cache.TryRemove(id, out _);
        _logger?.LogDebug("Deleted workspace {Id}", id);
    }

    /// <summary>
    /// Internal data model for serialization.
    /// </summary>
    private class WorkspaceData
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Type { get; set; } = "Custom";
        public string Status { get; set; } = "Active";
        public string? Path { get; set; }
        public List<string> SessionIds { get; set; } = new();
        public List<string> ProjectIds { get; set; } = new();
        public string? CatalogRef { get; set; }
        public WorkspaceSettingsData Settings { get; set; } = new();
        public WorkspaceIsolationData Isolation { get; set; } = new();
        public ContextPermissionsData Permissions { get; set; } = new();
        public Dictionary<string, SessionTemplateData> SessionTemplates { get; set; } = new();
        public Dictionary<string, string> EntryPoints { get; set; } = new();
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }
        public string? CreatedBy { get; set; }

        public static WorkspaceData FromDomain(Workspace workspace)
        {
            return new WorkspaceData
            {
                Id = workspace.Id,
                Name = workspace.Name,
                Description = workspace.Description,
                Type = workspace.Type.ToString(),
                Status = workspace.Status.ToString(),
                Path = workspace.Path,
                SessionIds = workspace.SessionIds.ToList(),
                ProjectIds = workspace.ProjectIds.ToList(),
                CatalogRef = workspace.CatalogRef,
                Settings = WorkspaceSettingsData.FromDomain(workspace.Settings),
                Isolation = WorkspaceIsolationData.FromDomain(workspace.Isolation),
                Permissions = ContextPermissionsData.FromDomain(workspace.Permissions),
                SessionTemplates = workspace.SessionTemplates.ToDictionary(
                    kvp => kvp.Key,
                    kvp => SessionTemplateData.FromDomain(kvp.Value)),
                EntryPoints = new Dictionary<string, string>(workspace.EntryPoints),
                CreatedAt = workspace.CreatedAt,
                UpdatedAt = workspace.UpdatedAt,
                CreatedBy = workspace.CreatedBy
            };
        }

        public Workspace ToDomain()
        {
            var type = Enum.TryParse<WorkspaceType>(Type, true, out var t) ? t : WorkspaceType.Custom;
            var status = ParseStatus(Status);

            return Workspace.Reconstitute(
                id: Id,
                name: Name,
                description: Description,
                type: type,
                status: status,
                path: Path,
                sessionIds: SessionIds,
                projectIds: ProjectIds,
                catalogRef: CatalogRef,
                settings: Settings.ToDomain(),
                isolation: Isolation.ToDomain(),
                permissions: Permissions.ToDomain(),
                sessionTemplates: SessionTemplates.ToDictionary(
                    kvp => kvp.Key,
                    kvp => kvp.Value.ToDomain()),
                entryPoints: new Dictionary<string, string>(EntryPoints),
                createdAt: CreatedAt,
                updatedAt: UpdatedAt,
                createdBy: CreatedBy
            );
        }

        private static ContainerSessionStatus ParseStatus(string status)
        {
            // Support both old WorkspaceStatus and new ContainerSessionStatus values
            return status.ToLowerInvariant() switch
            {
                "active" => ContainerSessionStatus.Active,
                "paused" => ContainerSessionStatus.Paused,
                "archived" => ContainerSessionStatus.Archived,
                "created" => ContainerSessionStatus.Created,
                "ended" => ContainerSessionStatus.Ended,
                "expired" => ContainerSessionStatus.Expired,
                _ => ContainerSessionStatus.Active
            };
        }
    }

    private class ContextPermissionsData
    {
        public List<string> AllowedCommands { get; set; } = new();
        public List<string> AllowedTools { get; set; } = new();
        public List<string> AllowedBlocks { get; set; } = new();
        public bool CanCreateBlocks { get; set; }
        public bool CanCreateSessions { get; set; }
        public List<string> DataCollections { get; set; } = new();
        public List<string> AllowedPaths { get; set; } = new();

        public static ContextPermissionsData FromDomain(ContextPermissions permissions)
        {
            return new ContextPermissionsData
            {
                AllowedCommands = permissions.AllowedCommands.ToList(),
                AllowedTools = permissions.AllowedTools.ToList(),
                AllowedBlocks = permissions.AllowedBlocks.ToList(),
                CanCreateBlocks = permissions.CanCreateBlocks,
                CanCreateSessions = permissions.CanCreateSessions,
                DataCollections = permissions.DataCollections.ToList(),
                AllowedPaths = permissions.AllowedPaths.ToList()
            };
        }

        public ContextPermissions ToDomain()
        {
            return new ContextPermissions
            {
                AllowedCommands = AllowedCommands.ToList(),
                AllowedTools = AllowedTools.ToList(),
                AllowedBlocks = AllowedBlocks.ToList(),
                CanCreateBlocks = CanCreateBlocks,
                CanCreateSessions = CanCreateSessions,
                DataCollections = DataCollections.ToList(),
                AllowedPaths = AllowedPaths.ToList()
            };
        }
    }

    private class SessionTemplateData
    {
        public string Type { get; set; } = string.Empty;
        public string? Description { get; set; }
        public ContextPermissionsData Permissions { get; set; } = new();
        public bool LogAllCommands { get; set; }
        public int MaxDurationMinutes { get; set; }
        public int MaxIterations { get; set; }
        public bool AllowNestedSessions { get; set; }
        public string? DefaultModelId { get; set; }

        public static SessionTemplateData FromDomain(SessionTemplate template)
        {
            return new SessionTemplateData
            {
                Type = template.Type,
                Description = template.Description,
                Permissions = ContextPermissionsData.FromDomain(template.Permissions),
                LogAllCommands = template.LogAllCommands,
                MaxDurationMinutes = template.MaxDurationMinutes,
                MaxIterations = template.MaxIterations,
                AllowNestedSessions = template.AllowNestedSessions,
                DefaultModelId = template.DefaultModelId
            };
        }

        public SessionTemplate ToDomain()
        {
            return new SessionTemplate
            {
                Type = Type,
                Description = Description,
                Permissions = Permissions.ToDomain(),
                LogAllCommands = LogAllCommands,
                MaxDurationMinutes = MaxDurationMinutes,
                MaxIterations = MaxIterations,
                AllowNestedSessions = AllowNestedSessions,
                DefaultModelId = DefaultModelId
            };
        }
    }

    private class WorkspaceSettingsData
    {
        public string? DefaultModelId { get; set; }
        public int MaxConcurrentSessions { get; set; } = 10;
        public int MaxConcurrentTrainingRuns { get; set; } = 3;
        public bool AutoPromotionEnabled { get; set; }
        public double MinFitnessForPromotion { get; set; } = 0.7;
        public List<string> Tags { get; set; } = new();

        public static WorkspaceSettingsData FromDomain(WorkspaceSettings settings)
        {
            return new WorkspaceSettingsData
            {
                DefaultModelId = settings.DefaultModelId,
                MaxConcurrentSessions = settings.MaxConcurrentSessions,
                MaxConcurrentTrainingRuns = settings.MaxConcurrentTrainingRuns,
                AutoPromotionEnabled = settings.AutoPromotionEnabled,
                MinFitnessForPromotion = settings.MinFitnessForPromotion,
                Tags = settings.Tags.ToList()
            };
        }

        public WorkspaceSettings ToDomain()
        {
            return new WorkspaceSettings
            {
                DefaultModelId = DefaultModelId,
                MaxConcurrentSessions = MaxConcurrentSessions,
                MaxConcurrentTrainingRuns = MaxConcurrentTrainingRuns,
                AutoPromotionEnabled = AutoPromotionEnabled,
                MinFitnessForPromotion = MinFitnessForPromotion,
                Tags = Tags.ToList()
            };
        }
    }

    private class WorkspaceIsolationData
    {
        public bool Enabled { get; set; }
        public NetworkConfigData? Network { get; set; }
        public WorkspaceResourceLimitsData? Resources { get; set; }
        public WorkspacePermissionsData Permissions { get; set; } = new();

        public static WorkspaceIsolationData FromDomain(Domain.ValueObjects.WorkspaceIsolation isolation)
        {
            return new WorkspaceIsolationData
            {
                Enabled = isolation.Enabled,
                Network = isolation.Network != null ? NetworkConfigData.FromDomain(isolation.Network) : null,
                Resources = isolation.Resources != null ? WorkspaceResourceLimitsData.FromDomain(isolation.Resources) : null,
                Permissions = WorkspacePermissionsData.FromDomain(isolation.Permissions)
            };
        }

        public Domain.ValueObjects.WorkspaceIsolation ToDomain()
        {
            return new Domain.ValueObjects.WorkspaceIsolation
            {
                Enabled = Enabled,
                Network = Network?.ToDomain(),
                Resources = Resources?.ToDomain(),
                Permissions = Permissions.ToDomain()
            };
        }
    }

    private class NetworkConfigData
    {
        public string NetworkName { get; set; } = string.Empty;
        public string? Subnet { get; set; }
        public string? Gateway { get; set; }
        public bool Internal { get; set; }
        public Dictionary<string, string> Labels { get; set; } = new();

        public static NetworkConfigData FromDomain(Domain.ValueObjects.NetworkConfig config)
        {
            return new NetworkConfigData
            {
                NetworkName = config.NetworkName,
                Subnet = config.Subnet,
                Gateway = config.Gateway,
                Internal = config.Internal,
                Labels = config.Labels
            };
        }

        public Domain.ValueObjects.NetworkConfig ToDomain()
        {
            return new Domain.ValueObjects.NetworkConfig
            {
                NetworkName = NetworkName,
                Subnet = Subnet,
                Gateway = Gateway,
                Internal = Internal,
                Labels = Labels
            };
        }
    }

    private class WorkspaceResourceLimitsData
    {
        public double CpuPercentage { get; set; } = 50;
        public long MemoryMb { get; set; } = 4096;
        public long StorageGb { get; set; } = 50;
        public int MaxContainers { get; set; } = 10;

        public static WorkspaceResourceLimitsData FromDomain(Domain.ValueObjects.WorkspaceResourceLimits limits)
        {
            return new WorkspaceResourceLimitsData
            {
                CpuPercentage = limits.CpuPercentage,
                MemoryMb = limits.MemoryMb,
                StorageGb = limits.StorageGb,
                MaxContainers = limits.MaxContainers
            };
        }

        public Domain.ValueObjects.WorkspaceResourceLimits ToDomain()
        {
            return new Domain.ValueObjects.WorkspaceResourceLimits
            {
                CpuPercentage = CpuPercentage,
                MemoryMb = MemoryMb,
                StorageGb = StorageGb,
                MaxContainers = MaxContainers
            };
        }
    }

    private class WorkspacePermissionsData
    {
        public List<string> CanReadFrom { get; set; } = new();
        public List<string> CanWriteTo { get; set; } = new();
        public List<string> CanPromoteTo { get; set; } = new();
        public List<string> AllowReadFrom { get; set; } = new();
        public List<string> AllowWriteFrom { get; set; } = new();

        public static WorkspacePermissionsData FromDomain(Domain.ValueObjects.WorkspacePermissions permissions)
        {
            return new WorkspacePermissionsData
            {
                CanReadFrom = permissions.CanReadFrom.ToList(),
                CanWriteTo = permissions.CanWriteTo.ToList(),
                CanPromoteTo = permissions.CanPromoteTo.ToList(),
                AllowReadFrom = permissions.AllowReadFrom.ToList(),
                AllowWriteFrom = permissions.AllowWriteFrom.ToList()
            };
        }

        public Domain.ValueObjects.WorkspacePermissions ToDomain()
        {
            return new Domain.ValueObjects.WorkspacePermissions
            {
                CanReadFrom = CanReadFrom.ToList(),
                CanWriteTo = CanWriteTo.ToList(),
                CanPromoteTo = CanPromoteTo.ToList(),
                AllowReadFrom = AllowReadFrom.ToList(),
                AllowWriteFrom = AllowWriteFrom.ToList()
            };
        }
    }
}
