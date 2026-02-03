using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Serialization;
using Maestro.Application.Interfaces;
using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Sessions;

/// <summary>
/// Filesystem-based implementation of ISessionRepository for unified sessions.
/// Sessions are stored in data/sessions/{session-id}.json
/// </summary>
public class FileSystemSessionRepository : ISessionRepository
{
    private readonly ConcurrentDictionary<string, Session> _cache = new();
    private readonly string _dataPath;
    private readonly ILogger<FileSystemSessionRepository>? _logger;
    private bool _initialized;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    public FileSystemSessionRepository(
        string dataPath,
        ILogger<FileSystemSessionRepository>? logger = null)
    {
        _dataPath = Path.Combine(dataPath, "sessions");
        _logger = logger;
    }

    public async Task<Session?> GetByIdAsync(SessionId id, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        if (_cache.TryGetValue(id.Value, out var cached))
        {
            return cached;
        }

        return null;
    }

    public async Task<IEnumerable<Session>> GetAllAsync(
        SessionStatus? status = null,
        EnvironmentMode? mode = null,
        string? categoryId = null,
        string? templateId = null,
        int? limit = null,
        CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        IEnumerable<Session> sessions = _cache.Values;

        if (status.HasValue)
        {
            sessions = sessions.Where(s => s.Status == status.Value);
        }

        if (mode.HasValue)
        {
            sessions = sessions.Where(s => s.Config.Mode == mode.Value);
        }

        if (!string.IsNullOrEmpty(categoryId))
        {
            sessions = sessions.Where(s => s.Config.CategoryId == categoryId);
        }

        if (!string.IsNullOrEmpty(templateId))
        {
            sessions = sessions.Where(s => s.Config.TemplateId == templateId);
        }

        sessions = sessions.OrderByDescending(s => s.CreatedAt);

        if (limit.HasValue)
        {
            sessions = sessions.Take(limit.Value);
        }

        return sessions.ToList();
    }

    public async Task<IEnumerable<Session>> GetActiveAsync(CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        return _cache.Values
            .Where(s => s.Status == SessionStatus.Running || s.Status == SessionStatus.Paused)
            .OrderByDescending(s => s.StartedAt ?? s.CreatedAt)
            .ToList();
    }

    public async Task<IEnumerable<Session>> GetByCategoryAsync(
        string categoryId,
        SessionStatus? status = null,
        int? limit = null,
        CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);

        IEnumerable<Session> sessions = _cache.Values
            .Where(s => s.Config.CategoryId == categoryId);

        if (status.HasValue)
        {
            sessions = sessions.Where(s => s.Status == status.Value);
        }

        sessions = sessions.OrderByDescending(s => s.CreatedAt);

        if (limit.HasValue)
        {
            sessions = sessions.Take(limit.Value);
        }

        return sessions.ToList();
    }

    public async Task SaveAsync(Session session, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(session);

        Directory.CreateDirectory(_dataPath);
        var filePath = GetFilePath(session.Id);

        var json = SerializeSession(session);
        await File.WriteAllTextAsync(filePath, json, ct);

        _cache[session.Id.Value] = session;
        _logger?.LogInformation("Saved session: {SessionId}", session.Id.Value);
    }

    public async Task DeleteAsync(SessionId id, CancellationToken ct = default)
    {
        var filePath = GetFilePath(id);
        if (File.Exists(filePath))
        {
            File.Delete(filePath);
        }

        _cache.TryRemove(id.Value, out _);
        _logger?.LogInformation("Deleted session: {SessionId}", id.Value);
        await Task.CompletedTask;
    }

    public async Task<bool> ExistsAsync(SessionId id, CancellationToken ct = default)
    {
        await EnsureInitializedAsync(ct);
        return _cache.ContainsKey(id.Value);
    }

    private async Task EnsureInitializedAsync(CancellationToken ct)
    {
        if (_initialized) return;

        if (Directory.Exists(_dataPath))
        {
            var files = Directory.GetFiles(_dataPath, "*.json");
            foreach (var file in files)
            {
                try
                {
                    var json = await File.ReadAllTextAsync(file, ct);
                    var session = DeserializeSession(json);
                    if (session != null)
                    {
                        _cache[session.Id.Value] = session;
                    }
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex, "Failed to load session from {Path}", file);
                }
            }
        }

        _initialized = true;
        _logger?.LogInformation("Initialized session repository with {Count} sessions", _cache.Count);
    }

    private string GetFilePath(SessionId id)
    {
        return Path.Combine(_dataPath, $"{id.Value}.json");
    }

    private static string SerializeSession(Session session)
    {
        var dto = new SessionJsonDto
        {
            Id = session.Id.Value,
            Name = session.Name,
            Status = session.Status.ToString().ToLowerInvariant(),
            Authority = session.Authority.ToString(),
            ContainerId = session.ContainerId,
            WorkingDirectory = session.WorkingDirectory,
            Config = new SessionConfigJsonDto
            {
                Mode = session.Config.Mode.ToString().ToLowerInvariant(),
                SandboxImageId = session.Config.SandboxImageId,
                CategoryId = session.Config.CategoryId,
                RepoBind = session.Config.RepoBind != null ? new RepoBindJsonDto
                {
                    HostPath = session.Config.RepoBind.HostPath,
                    ContainerPath = session.Config.RepoBind.ContainerPath,
                    ReadOnly = session.Config.RepoBind.ReadOnly
                } : null,
                TemplateId = session.Config.TemplateId,
                Resources = new ResourceLimitsJsonDto
                {
                    CpuLimit = session.Config.Resources.CpuLimit,
                    MemoryLimit = session.Config.Resources.MemoryLimit,
                    TimeoutSeconds = session.Config.Resources.TimeoutSeconds
                },
                EnvironmentVariables = new Dictionary<string, string>(session.Config.EnvironmentVariables),
                WorkingDirectory = session.Config.WorkingDirectory
            },
            CreatedAt = session.CreatedAt,
            StartedAt = session.StartedAt,
            CompletedAt = session.CompletedAt,
            CommandCount = session.CommandCount,
            ModifiedFiles = session.ModifiedFiles.Select(f => new FileChangeJsonDto
            {
                Path = f.Path,
                ChangeType = f.ChangeType.ToString().ToLowerInvariant()
            }).ToList(),
            ErrorMessage = session.ErrorMessage
        };

        return JsonSerializer.Serialize(dto, JsonOptions);
    }

    private static Session? DeserializeSession(string json)
    {
        var dto = JsonSerializer.Deserialize<SessionJsonDto>(json, JsonOptions);
        if (dto == null) return null;

        var config = new SessionConfig
        {
            Mode = Enum.Parse<EnvironmentMode>(dto.Config.Mode, ignoreCase: true),
            SandboxImageId = dto.Config.SandboxImageId,
            CategoryId = dto.Config.CategoryId,
            RepoBind = dto.Config.RepoBind != null ? new RepoBind
            {
                HostPath = dto.Config.RepoBind.HostPath,
                ContainerPath = dto.Config.RepoBind.ContainerPath,
                ReadOnly = dto.Config.RepoBind.ReadOnly
            } : null,
            TemplateId = dto.Config.TemplateId,
            Resources = new ResourceLimits
            {
                CpuLimit = dto.Config.Resources?.CpuLimit,
                MemoryLimit = dto.Config.Resources?.MemoryLimit,
                TimeoutSeconds = dto.Config.Resources?.TimeoutSeconds
            },
            EnvironmentVariables = dto.Config.EnvironmentVariables ?? new Dictionary<string, string>(),
            WorkingDirectory = dto.Config.WorkingDirectory
        };

        var authority = !string.IsNullOrEmpty(dto.Authority)
            ? Authority.Parse(dto.Authority)
            : Authority.Human();

        var session = Session.Create(dto.Name, authority, config);

        // Restore session state
        RestoreSessionState(session, dto);

        return session;
    }

    private static void RestoreSessionState(Session session, SessionJsonDto dto)
    {
        var type = typeof(Session);
        var bindingFlags = System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public;

        // Set Status
        var status = Enum.Parse<SessionStatus>(dto.Status, ignoreCase: true);
        var statusField = type.GetField("<Status>k__BackingField", bindingFlags);
        statusField?.SetValue(session, status);

        // Set ContainerId
        if (dto.ContainerId != null)
        {
            var containerIdField = type.GetField("<ContainerId>k__BackingField", bindingFlags);
            containerIdField?.SetValue(session, dto.ContainerId);
        }

        // Set StartedAt
        if (dto.StartedAt.HasValue)
        {
            var startedAtField = type.GetField("<StartedAt>k__BackingField", bindingFlags);
            startedAtField?.SetValue(session, dto.StartedAt);
        }

        // Set CompletedAt
        if (dto.CompletedAt.HasValue)
        {
            var completedAtField = type.GetField("<CompletedAt>k__BackingField", bindingFlags);
            completedAtField?.SetValue(session, dto.CompletedAt);
        }

        // Set WorkingDirectory
        if (!string.IsNullOrEmpty(dto.WorkingDirectory))
        {
            var wdField = type.GetField("<WorkingDirectory>k__BackingField", bindingFlags);
            wdField?.SetValue(session, dto.WorkingDirectory);
        }

        // Set ErrorMessage
        if (dto.ErrorMessage != null)
        {
            var errorField = type.GetField("<ErrorMessage>k__BackingField", bindingFlags);
            errorField?.SetValue(session, dto.ErrorMessage);
        }

        // Restore modified files
        foreach (var fileDto in dto.ModifiedFiles)
        {
            session.RecordFileChange(new FileChange
            {
                Path = fileDto.Path,
                ChangeType = Enum.Parse<FileChangeType>(fileDto.ChangeType, ignoreCase: true)
            });
        }
    }

    // JSON DTOs for serialization
    private class SessionJsonDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Status { get; set; } = "created";
        public string Authority { get; set; } = "human";
        public string? ContainerId { get; set; }
        public string WorkingDirectory { get; set; } = "/workspace";
        public SessionConfigJsonDto Config { get; set; } = new();
        public DateTime CreatedAt { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public int CommandCount { get; set; }
        public List<FileChangeJsonDto> ModifiedFiles { get; set; } = new();
        public string? ErrorMessage { get; set; }
    }

    private class SessionConfigJsonDto
    {
        public string Mode { get; set; } = "sandbox";
        public string SandboxImageId { get; set; } = string.Empty;
        public string? CategoryId { get; set; }
        public RepoBindJsonDto? RepoBind { get; set; }
        public string? TemplateId { get; set; }
        public ResourceLimitsJsonDto? Resources { get; set; }
        public Dictionary<string, string>? EnvironmentVariables { get; set; }
        public string WorkingDirectory { get; set; } = "/workspace";
    }

    private class RepoBindJsonDto
    {
        public string HostPath { get; set; } = string.Empty;
        public string ContainerPath { get; set; } = "/workspace";
        public bool ReadOnly { get; set; }
    }

    private class ResourceLimitsJsonDto
    {
        public string? CpuLimit { get; set; }
        public string? MemoryLimit { get; set; }
        public int? TimeoutSeconds { get; set; }
    }

    private class FileChangeJsonDto
    {
        public string Path { get; set; } = string.Empty;
        public string ChangeType { get; set; } = "modified";
    }
}
