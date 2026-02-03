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
        public List<string> SessionIds { get; set; } = new();
        public List<string> ProjectIds { get; set; } = new();
        public string? CatalogRef { get; set; }
        public WorkspaceSettingsData Settings { get; set; } = new();
        public WorkspaceIsolationData Isolation { get; set; } = new();
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
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
                SessionIds = workspace.SessionIds.ToList(),
                ProjectIds = workspace.ProjectIds.ToList(),
                CatalogRef = workspace.CatalogRef,
                Settings = WorkspaceSettingsData.FromDomain(workspace.Settings),
                Isolation = WorkspaceIsolationData.FromDomain(workspace.Isolation),
                CreatedAt = workspace.CreatedAt,
                UpdatedAt = workspace.UpdatedAt,
                CreatedBy = workspace.CreatedBy
            };
        }

        public Workspace ToDomain()
        {
            var type = Enum.TryParse<WorkspaceType>(Type, true, out var t) ? t : WorkspaceType.Custom;
            var workspace = Workspace.Create(Name, type, Description, CreatedBy);

            // Use reflection to set private properties (since we're deserializing)
            SetPrivateProperty(workspace, "Id", Id);
            SetPrivateProperty(workspace, "Status", Enum.TryParse<WorkspaceStatus>(Status, true, out var s) ? s : WorkspaceStatus.Active);
            SetPrivateProperty(workspace, "CreatedAt", CreatedAt);
            SetPrivateProperty(workspace, "UpdatedAt", UpdatedAt);
            SetPrivateProperty(workspace, "CatalogRef", CatalogRef);

            // Set lists
            foreach (var sessionId in SessionIds)
                workspace.AddSession(sessionId);
            foreach (var projectId in ProjectIds)
                workspace.AddProject(projectId);

            workspace.UpdateSettings(Settings.ToDomain());
            workspace.UpdateIsolation(Isolation.ToDomain());

            return workspace;
        }

        private static void SetPrivateProperty(object obj, string propertyName, object? value)
        {
            var prop = obj.GetType().GetProperty(propertyName);
            if (prop != null && prop.CanWrite == false)
            {
                var backingField = obj.GetType().GetField($"<{propertyName}>k__BackingField",
                    System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                backingField?.SetValue(obj, value);
            }
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
