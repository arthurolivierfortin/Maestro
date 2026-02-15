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
/// Filesystem-based implementation of IFoundrySessionRepository.
/// Sessions are stored in content/user/sessions/{session-id}.session.json
/// </summary>
public class FileSystemFoundrySessionRepository : IFoundrySessionRepository
{
    private readonly ConcurrentDictionary<string, FoundrySession> _cache = new();
    private readonly string _basePath;
    private readonly ILogger<FileSystemFoundrySessionRepository>? _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    public FileSystemFoundrySessionRepository(
        ILogger<FileSystemFoundrySessionRepository>? logger = null,
        string? basePath = null)
    {
        _basePath = basePath ?? Path.Combine("content", "user", "sessions");
        _logger = logger;

        // Ensure directory exists
        if (!Directory.Exists(_basePath))
        {
            Directory.CreateDirectory(_basePath);
        }
    }

    public async Task<FoundrySession?> GetByIdAsync(SessionId id, CancellationToken ct = default)
    {
        var sessionId = id.Value;

        // Check cache first
        if (_cache.TryGetValue(sessionId, out var cached))
        {
            return cached;
        }

        // Try to load from file
        var filePath = GetSessionFilePath(sessionId);
        if (!File.Exists(filePath))
        {
            return null;
        }

        try
        {
            var json = await File.ReadAllTextAsync(filePath, ct);
            var dto = JsonSerializer.Deserialize<FoundrySessionJsonDto>(json, JsonOptions);
            if (dto == null)
            {
                return null;
            }

            var session = ReconstitueFromDto(dto);
            _cache[sessionId] = session;
            return session;
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to load foundry session {SessionId} from {Path}", sessionId, filePath);
            return null;
        }
    }

    public async Task<IEnumerable<FoundrySession>> GetByDraftIdAsync(string draftId, CancellationToken ct = default)
    {
        var allSessions = await GetAllAsync(ct: ct);
        return allSessions.Where(s => s.Config.DraftId == draftId);
    }

    public async Task<IEnumerable<FoundrySession>> GetAllAsync(
        SessionStatus? status = null,
        string? draftId = null,
        int? limit = null,
        CancellationToken ct = default)
    {
        var sessions = new List<FoundrySession>();

        if (!Directory.Exists(_basePath))
        {
            return sessions;
        }

        var files = Directory.GetFiles(_basePath, "*.session.json");

        foreach (var file in files)
        {
            try
            {
                var sessionId = Path.GetFileNameWithoutExtension(file).Replace(".session", "");

                // Check cache first
                if (_cache.TryGetValue(sessionId, out var cached))
                {
                    sessions.Add(cached);
                    continue;
                }

                var json = await File.ReadAllTextAsync(file, ct);
                var dto = JsonSerializer.Deserialize<FoundrySessionJsonDto>(json, JsonOptions);
                if (dto != null)
                {
                    var session = ReconstitueFromDto(dto);
                    _cache[session.Id] = session;
                    sessions.Add(session);
                }
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to load foundry session from {Path}", file);
            }
        }

        // Apply filters
        var query = sessions.AsEnumerable();

        if (status.HasValue)
        {
            var containerStatus = MapSessionStatusToContainerStatus(status.Value);
            query = query.Where(s => s.Status == containerStatus);

            // For terminal states, also check TerminalReason
            if (status == SessionStatus.Completed)
            {
                query = query.Where(s => s.TerminalReason == SessionTerminalReason.Completed);
            }
            else if (status == SessionStatus.Failed)
            {
                query = query.Where(s => s.TerminalReason == SessionTerminalReason.Failed);
            }
            else if (status == SessionStatus.Cancelled)
            {
                query = query.Where(s => s.TerminalReason == SessionTerminalReason.Cancelled);
            }
            else if (status == SessionStatus.Stopped)
            {
                query = query.Where(s => s.TerminalReason == SessionTerminalReason.Stopped);
            }
        }

        if (!string.IsNullOrEmpty(draftId))
        {
            query = query.Where(s => s.Config.DraftId == draftId);
        }

        // Order by creation time descending
        query = query.OrderByDescending(s => s.CreatedAt);

        if (limit.HasValue)
        {
            query = query.Take(limit.Value);
        }

        return query.ToList();
    }

    public async Task SaveAsync(FoundrySession session, CancellationToken ct = default)
    {
        var dto = MapToDto(session);
        var json = JsonSerializer.Serialize(dto, JsonOptions);

        var filePath = GetSessionFilePath(session.Id);
        await File.WriteAllTextAsync(filePath, json, ct);

        _cache[session.Id] = session;

        _logger?.LogDebug("Saved foundry session {SessionId} to {Path}", session.Id, filePath);
    }

    public async Task DeleteAsync(SessionId id, CancellationToken ct = default)
    {
        var sessionId = id.Value;
        var filePath = GetSessionFilePath(sessionId);

        if (File.Exists(filePath))
        {
            File.Delete(filePath);
            _logger?.LogInformation("Deleted foundry session file: {Path}", filePath);
        }

        _cache.TryRemove(sessionId, out _);
        await Task.CompletedTask;
    }

    private string GetSessionFilePath(string sessionId)
    {
        return Path.Combine(_basePath, $"{sessionId}.session.json");
    }

    private static FoundrySessionJsonDto MapToDto(FoundrySession session)
    {
        return new FoundrySessionJsonDto
        {
            Id = session.Id,
            Name = session.Name,
            Description = session.Description,
            SessionType = session.SessionType.ToString(),
            Status = session.GetSessionStatus().ToString(),
            ContainerStatus = session.Status.ToString(),
            TerminalReason = session.TerminalReason.ToString(),
            Authority = new AuthorityJsonDto
            {
                Type = session.Authority.Type.ToString(),
                Identifier = session.Authority.Identifier
            },
            Config = MapConfigToDto(session.Config),
            LoadedDraftId = session.LoadedDraftId,
            TrainingStatus = session.FoundryTrainingStatus.ToString(),
            ParentWorkspaceId = session.ParentWorkspaceId,
            ParentSessionId = session.ParentSessionId,
            Permissions = MapPermissionsToDto(session.Permissions),
            Binding = MapBindingToDto(session.Binding),
            BlockRegistry = session.BlockRegistry.AvailableBlocks.ToList(),
            Metrics = MapMetricsToDto(session.Metrics),
            Iterations = session.Iterations.Select(MapIterationToDto).ToList(),
            Improvements = session.Improvements.Select(MapImprovementToDto).ToList(),
            ErrorMessage = session.ErrorMessage,
            CreatedAt = session.CreatedAt,
            StartedAt = session.StartedAt,
            CompletedAt = session.CompletedAt,
            UpdatedAt = session.UpdatedAt,
            CreatedBy = session.CreatedBy,
            RepositoryPath = session.RepositoryPath
        };
    }

    private static FoundrySession ReconstitueFromDto(FoundrySessionJsonDto dto)
    {
        var authority = ParseAuthority(dto.Authority);
        var config = MapConfigFromDto(dto.Config);
        var permissions = MapPermissionsFromDto(dto.Permissions);
        var binding = MapBindingFromDto(dto.Binding);
        var blockRegistry = dto.BlockRegistry != null
            ? SessionBlockRegistry.From(dto.BlockRegistry)
            : SessionBlockRegistry.Empty();
        var metrics = MapMetricsFromDto(dto.Metrics);
        var iterations = dto.Iterations?.Select(MapIterationFromDto).ToList() ?? new List<FoundryIteration>();
        var improvements = dto.Improvements?.Select(MapImprovementFromDto).ToList() ?? new List<ImprovementSuggestion>();

        var containerStatus = Enum.TryParse<ContainerSessionStatus>(dto.ContainerStatus, ignoreCase: true, out var cs)
            ? cs
            : MapSessionStatusToContainerStatus(Enum.Parse<SessionStatus>(dto.Status, ignoreCase: true));

        var terminalReason = Enum.TryParse<SessionTerminalReason>(dto.TerminalReason, ignoreCase: true, out var tr)
            ? tr
            : SessionTerminalReason.None;

        var trainingStatus = Enum.TryParse<FoundryTrainingStatus>(dto.TrainingStatus, ignoreCase: true, out var ts)
            ? ts
            : FoundryTrainingStatus.Idle;

        return FoundrySession.Reconstitute(
            id: dto.Id,
            name: dto.Name,
            authority: authority,
            config: config,
            status: containerStatus,
            terminalReason: terminalReason,
            parentWorkspaceId: dto.ParentWorkspaceId,
            parentSessionId: dto.ParentSessionId,
            loadedDraftId: dto.LoadedDraftId,
            trainingStatus: trainingStatus,
            permissions: permissions,
            binding: binding,
            blockRegistry: blockRegistry,
            metrics: metrics,
            iterations: iterations,
            improvements: improvements,
            errorMessage: dto.ErrorMessage,
            createdAt: dto.CreatedAt,
            startedAt: dto.StartedAt,
            completedAt: dto.CompletedAt,
            updatedAt: dto.UpdatedAt,
            createdBy: dto.CreatedBy,
            repositoryPath: dto.RepositoryPath);
    }

    // ===== Authority Mapping =====

    private static Authority ParseAuthority(AuthorityJsonDto dto)
    {
        var type = Enum.TryParse<AuthorityType>(dto.Type, ignoreCase: true, out var t)
            ? t
            : AuthorityType.Human;

        return type switch
        {
            AuthorityType.Human => Authority.Human(dto.Identifier),
            AuthorityType.Agent => Authority.Agent(dto.Identifier ?? "unknown"),
            AuthorityType.AI => Authority.AI(dto.Identifier ?? "unknown"),
            _ => Authority.Human(dto.Identifier)
        };
    }

    // ===== Config Mapping =====

    private static FoundryConfigJsonDto MapConfigToDto(FoundrySessionConfig config)
    {
        return new FoundryConfigJsonDto
        {
            DraftId = config.DraftId,
            Source = config.Source.ToString(),
            RepositoryConfig = config.RepositoryConfig != null ? new RepositorySourceConfigJsonDto
            {
                RepositoryPath = config.RepositoryConfig.RepositoryPath,
                DockerBindPath = config.RepositoryConfig.DockerBindPath,
                AccessLevel = config.RepositoryConfig.AccessLevel.ToString(),
                Branch = config.RepositoryConfig.Branch,
                ExcludePatterns = config.RepositoryConfig.ExcludePatterns.ToList()
            } : null,
            Training = new TrainingRunConfigJsonDto
            {
                Iterations = config.Training.Iterations,
                Parallel = config.Training.Parallel,
                DelayMs = config.Training.DelayMs,
                TimeoutMs = config.Training.TimeoutMs,
                Tags = config.Training.Tags.ToList()
            },
            Evaluation = new EvaluationConfigJsonDto
            {
                Mode = config.Evaluation.Mode.ToString(),
                PassThreshold = config.Evaluation.PassThreshold,
                HumanReviewThreshold = config.Evaluation.HumanReviewThreshold,
                Criteria = config.Evaluation.Criteria.ToList()
            }
        };
    }

    private static FoundrySessionConfig MapConfigFromDto(FoundryConfigJsonDto dto)
    {
        var config = new FoundrySessionConfig
        {
            DraftId = dto.DraftId,
            Source = Enum.TryParse<SessionSource>(dto.Source, ignoreCase: true, out var src)
                ? src
                : SessionSource.Sandbox,
            Training = new TrainingRunConfig
            {
                Iterations = dto.Training?.Iterations ?? 10,
                Parallel = dto.Training?.Parallel ?? 1,
                DelayMs = dto.Training?.DelayMs ?? 0,
                TimeoutMs = dto.Training?.TimeoutMs ?? 60000,
                Tags = dto.Training?.Tags ?? new List<string>()
            },
            Evaluation = new EvaluationConfig
            {
                Mode = Enum.TryParse<EvaluationMode>(dto.Evaluation?.Mode, ignoreCase: true, out var mode)
                    ? mode
                    : EvaluationMode.Manual,
                PassThreshold = dto.Evaluation?.PassThreshold ?? 0.7,
                HumanReviewThreshold = dto.Evaluation?.HumanReviewThreshold ?? 0.5,
                Criteria = dto.Evaluation?.Criteria ?? new List<string> { "Correctness", "Quality", "Efficiency" }
            }
        };

        if (dto.RepositoryConfig != null)
        {
            config.RepositoryConfig = new RepositorySourceConfig
            {
                RepositoryPath = dto.RepositoryConfig.RepositoryPath,
                DockerBindPath = dto.RepositoryConfig.DockerBindPath ?? "/workspace",
                AccessLevel = Enum.TryParse<Domain.Configuration.RepositoryAccessLevel>(dto.RepositoryConfig.AccessLevel, ignoreCase: true, out var al)
                    ? al
                    : Domain.Configuration.RepositoryAccessLevel.Controlled,
                Branch = dto.RepositoryConfig.Branch,
                ExcludePatterns = dto.RepositoryConfig.ExcludePatterns ?? new List<string>()
            };
        }

        return config;
    }

    // ===== Permissions Mapping =====

    private static PermissionsJsonDto MapPermissionsToDto(ContextPermissions permissions)
    {
        return new PermissionsJsonDto
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

    private static ContextPermissions MapPermissionsFromDto(PermissionsJsonDto? dto)
    {
        if (dto == null) return ContextPermissions.Full;

        return new ContextPermissions
        {
            AllowedCommands = dto.AllowedCommands ?? new List<string>(),
            AllowedTools = dto.AllowedTools ?? new List<string>(),
            AllowedBlocks = dto.AllowedBlocks ?? new List<string>(),
            CanCreateBlocks = dto.CanCreateBlocks,
            CanCreateSessions = dto.CanCreateSessions,
            DataCollections = dto.DataCollections ?? new List<string>(),
            AllowedPaths = dto.AllowedPaths ?? new List<string>()
        };
    }

    // ===== Binding Mapping =====

    private static BindingJsonDto MapBindingToDto(ContainerBinding binding)
    {
        return new BindingJsonDto
        {
            Type = binding.Type.ToString(),
            SandboxImage = binding.SandboxImage,
            RepositoryPath = binding.RepositoryPath,
            DockerBindPath = binding.DockerBindPath,
            AccessLevel = binding.AccessLevel.ToString(),
            ExcludePatterns = binding.ExcludePatterns.ToList()
        };
    }

    private static ContainerBinding MapBindingFromDto(BindingJsonDto? dto)
    {
        if (dto == null) return ContainerBinding.CreateSandbox();

        var type = Enum.TryParse<ContainerBindingType>(dto.Type, ignoreCase: true, out var t)
            ? t
            : ContainerBindingType.Sandbox;

        return type switch
        {
            ContainerBindingType.Repository when dto.RepositoryPath != null =>
                ContainerBinding.CreateRepositoryBound(
                    dto.RepositoryPath,
                    Enum.TryParse<Domain.ValueObjects.RepositoryAccessLevel>(dto.AccessLevel, ignoreCase: true, out var al)
                        ? al
                        : Domain.ValueObjects.RepositoryAccessLevel.Controlled),
            _ => ContainerBinding.CreateSandbox(dto.SandboxImage)
        };
    }

    // ===== Metrics Mapping =====

    private static MetricsJsonDto MapMetricsToDto(SessionMetrics metrics)
    {
        return new MetricsJsonDto
        {
            TotalIterations = metrics.TotalIterations,
            EvaluatedIterations = metrics.EvaluatedIterations,
            AverageScore = metrics.AverageScore,
            MinScore = metrics.MinScore,
            MaxScore = metrics.MaxScore,
            AverageDurationMs = metrics.AverageDurationMs,
            TotalDurationMs = metrics.TotalDurationMs,
            PassRate = metrics.PassRate
        };
    }

    private static SessionMetrics MapMetricsFromDto(MetricsJsonDto? dto)
    {
        if (dto == null) return new SessionMetrics();

        return new SessionMetrics
        {
            TotalIterations = dto.TotalIterations,
            EvaluatedIterations = dto.EvaluatedIterations,
            AverageScore = dto.AverageScore,
            MinScore = dto.MinScore,
            MaxScore = dto.MaxScore,
            AverageDurationMs = dto.AverageDurationMs,
            TotalDurationMs = dto.TotalDurationMs,
            PassRate = dto.PassRate
        };
    }

    // ===== Iteration Mapping =====

    private static IterationJsonDto MapIterationToDto(FoundryIteration iteration)
    {
        return new IterationJsonDto
        {
            Id = iteration.Id,
            IterationNumber = iteration.IterationNumber,
            Inputs = new Dictionary<string, object>(iteration.Inputs),
            Output = iteration.Output,
            DurationMs = iteration.DurationMs,
            ExecutedAt = iteration.ExecutedAt,
            Evaluated = iteration.Evaluated,
            Score = iteration.Score,
            Feedback = iteration.Feedback,
            NeedsHumanReview = iteration.NeedsHumanReview,
            EvaluatedAt = iteration.EvaluatedAt
        };
    }

    private static FoundryIteration MapIterationFromDto(IterationJsonDto dto)
    {
        var iteration = new FoundryIteration
        {
            Id = dto.Id,
            IterationNumber = dto.IterationNumber,
            Inputs = dto.Inputs ?? new Dictionary<string, object>(),
            Output = dto.Output,
            DurationMs = dto.DurationMs,
            ExecutedAt = dto.ExecutedAt
        };

        if (dto.Evaluated && dto.Score.HasValue)
        {
            iteration.Evaluate(dto.Score.Value, dto.Feedback, dto.NeedsHumanReview);
        }

        return iteration;
    }

    // ===== Improvement Mapping =====

    private static ImprovementJsonDto MapImprovementToDto(ImprovementSuggestion improvement)
    {
        return new ImprovementJsonDto
        {
            Id = improvement.Id,
            Title = improvement.Title,
            Description = improvement.Description,
            Type = improvement.Type,
            Priority = improvement.Priority,
            SuggestedChanges = improvement.SuggestedChanges,
            CreatedAt = improvement.CreatedAt,
            Applied = improvement.Applied,
            AppliedAt = improvement.AppliedAt
        };
    }

    private static ImprovementSuggestion MapImprovementFromDto(ImprovementJsonDto dto)
    {
        return new ImprovementSuggestion
        {
            Id = dto.Id,
            Title = dto.Title,
            Description = dto.Description,
            Type = dto.Type,
            Priority = dto.Priority ?? "medium",
            SuggestedChanges = dto.SuggestedChanges,
            CreatedAt = dto.CreatedAt,
            Applied = dto.Applied,
            AppliedAt = dto.AppliedAt
        };
    }

    // ===== Status Mapping =====

    private static ContainerSessionStatus MapSessionStatusToContainerStatus(SessionStatus status)
    {
        return status switch
        {
            SessionStatus.Created => ContainerSessionStatus.Created,
            SessionStatus.Running => ContainerSessionStatus.Active,
            SessionStatus.Idle => ContainerSessionStatus.Active,
            SessionStatus.Paused => ContainerSessionStatus.Paused,
            SessionStatus.Completed => ContainerSessionStatus.Ended,
            SessionStatus.Failed => ContainerSessionStatus.Ended,
            SessionStatus.Cancelled => ContainerSessionStatus.Ended,
            SessionStatus.Stopped => ContainerSessionStatus.Ended,
            _ => ContainerSessionStatus.Created
        };
    }

    // ===== JSON DTOs =====

    private class FoundrySessionJsonDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string SessionType { get; set; } = "foundry";
        public string Status { get; set; } = "created";
        public string ContainerStatus { get; set; } = "created";
        public string TerminalReason { get; set; } = "none";
        public AuthorityJsonDto Authority { get; set; } = new();
        public FoundryConfigJsonDto Config { get; set; } = new();
        public string? LoadedDraftId { get; set; }
        public string TrainingStatus { get; set; } = "idle";
        public string? ParentWorkspaceId { get; set; }
        public string? ParentSessionId { get; set; }
        public PermissionsJsonDto? Permissions { get; set; }
        public BindingJsonDto? Binding { get; set; }
        public List<string>? BlockRegistry { get; set; }
        public MetricsJsonDto? Metrics { get; set; }
        public List<IterationJsonDto>? Iterations { get; set; }
        public List<ImprovementJsonDto>? Improvements { get; set; }
        public string? ErrorMessage { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? StartedAt { get; set; }
        public DateTimeOffset? CompletedAt { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }
        public string? CreatedBy { get; set; }
        public string? RepositoryPath { get; set; }
    }

    private class AuthorityJsonDto
    {
        public string Type { get; set; } = "human";
        public string? Identifier { get; set; }
    }

    private class FoundryConfigJsonDto
    {
        public string? DraftId { get; set; }
        public string Source { get; set; } = "sandbox";
        public RepositorySourceConfigJsonDto? RepositoryConfig { get; set; }
        public TrainingRunConfigJsonDto? Training { get; set; }
        public EvaluationConfigJsonDto? Evaluation { get; set; }
    }

    private class RepositorySourceConfigJsonDto
    {
        public string RepositoryPath { get; set; } = string.Empty;
        public string? DockerBindPath { get; set; }
        public string AccessLevel { get; set; } = "controlled";
        public string? Branch { get; set; }
        public List<string>? ExcludePatterns { get; set; }
    }

    private class TrainingRunConfigJsonDto
    {
        public int Iterations { get; set; } = 10;
        public int Parallel { get; set; } = 1;
        public int DelayMs { get; set; }
        public int TimeoutMs { get; set; } = 60000;
        public List<string>? Tags { get; set; }
    }

    private class EvaluationConfigJsonDto
    {
        public string Mode { get; set; } = "manual";
        public double PassThreshold { get; set; } = 0.7;
        public double HumanReviewThreshold { get; set; } = 0.5;
        public List<string>? Criteria { get; set; }
    }

    private class PermissionsJsonDto
    {
        public List<string>? AllowedCommands { get; set; }
        public List<string>? AllowedTools { get; set; }
        public List<string>? AllowedBlocks { get; set; }
        public bool CanCreateBlocks { get; set; } = true;
        public bool CanCreateSessions { get; set; } = true;
        public List<string>? DataCollections { get; set; }
        public List<string>? AllowedPaths { get; set; }
    }

    private class BindingJsonDto
    {
        public string Type { get; set; } = "sandbox";
        public string? SandboxImage { get; set; }
        public string? RepositoryPath { get; set; }
        public string? DockerBindPath { get; set; }
        public string? AccessLevel { get; set; }
        public List<string>? ExcludePatterns { get; set; }
    }

    private class MetricsJsonDto
    {
        public int TotalIterations { get; set; }
        public int EvaluatedIterations { get; set; }
        public double AverageScore { get; set; }
        public double MinScore { get; set; }
        public double MaxScore { get; set; }
        public double AverageDurationMs { get; set; }
        public long TotalDurationMs { get; set; }
        public double PassRate { get; set; }
    }

    private class IterationJsonDto
    {
        public string Id { get; set; } = string.Empty;
        public int IterationNumber { get; set; }
        public Dictionary<string, object>? Inputs { get; set; }
        public object? Output { get; set; }
        public long DurationMs { get; set; }
        public DateTime ExecutedAt { get; set; }
        public bool Evaluated { get; set; }
        public double? Score { get; set; }
        public string? Feedback { get; set; }
        public bool NeedsHumanReview { get; set; }
        public DateTime? EvaluatedAt { get; set; }
    }

    private class ImprovementJsonDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string? Priority { get; set; }
        public object? SuggestedChanges { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool Applied { get; set; }
        public DateTime? AppliedAt { get; set; }
    }
}
