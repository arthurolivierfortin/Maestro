using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Serialization;
using Maestro.Application.Interfaces;
using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.Configuration;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Sessions;

/// <summary>
/// Filesystem-based implementation of IProjectSessionRepository.
/// Sessions are stored in {project}/.maestro/sessions/{session-id}.json
/// </summary>
public class FileSystemProjectSessionRepository : IProjectSessionRepository
{
    private readonly ConcurrentDictionary<string, ProjectSession> _cache = new();
    private readonly IProjectRepository _projectRepository;
    private readonly ILogger<FileSystemProjectSessionRepository>? _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    public FileSystemProjectSessionRepository(
        IProjectRepository projectRepository,
        ILogger<FileSystemProjectSessionRepository>? logger = null)
    {
        _projectRepository = projectRepository;
        _logger = logger;
    }

    public async Task<ProjectSession?> GetByIdAsync(SessionId id, CancellationToken ct = default)
    {
        // Check cache first
        if (_cache.TryGetValue(id.Value, out var cached))
        {
            return cached;
        }

        // Search across all projects
        var projects = await _projectRepository.GetAllAsync(ct);
        foreach (var project in projects)
        {
            var sessionPath = GetSessionFilePath(project.RootPath, id);
            if (File.Exists(sessionPath))
            {
                var session = await LoadSessionFromFileAsync(sessionPath, ct);
                if (session != null)
                {
                    _cache[id.Value] = session;
                    return session;
                }
            }
        }

        return null;
    }

    public async Task<IEnumerable<ProjectSession>> GetByProjectIdAsync(string projectId, CancellationToken ct = default)
    {
        var project = await FindProjectByIdAsync(projectId, ct);
        if (project == null)
        {
            return Enumerable.Empty<ProjectSession>();
        }

        return await LoadSessionsFromProjectAsync(project, ct);
    }

    public async Task<IEnumerable<ProjectSession>> GetAllAsync(
        SessionStatus? status = null,
        string? projectId = null,
        string? workflowId = null,
        int? limit = null,
        CancellationToken ct = default)
    {
        var allSessions = new List<ProjectSession>();

        if (projectId != null)
        {
            // Load sessions from specific project
            var project = await FindProjectByIdAsync(projectId, ct);
            if (project != null)
            {
                allSessions.AddRange(await LoadSessionsFromProjectAsync(project, ct));
            }
        }
        else
        {
            // Load sessions from all projects
            var projects = await _projectRepository.GetAllAsync(ct);
            foreach (var project in projects)
            {
                allSessions.AddRange(await LoadSessionsFromProjectAsync(project, ct));
            }
        }

        // Apply filters
        IEnumerable<ProjectSession> filtered = allSessions;

        if (status.HasValue)
        {
            filtered = filtered.Where(s => s.Status == status.Value);
        }

        if (workflowId != null)
        {
            filtered = filtered.Where(s => s.Config.WorkflowId == workflowId);
        }

        // Order by creation date descending (newest first)
        filtered = filtered.OrderByDescending(s => s.CreatedAt);

        if (limit.HasValue)
        {
            filtered = filtered.Take(limit.Value);
        }

        return filtered.ToList();
    }

    public async Task SaveAsync(ProjectSession session, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(session);

        var project = await FindProjectByIdAsync(session.Config.ProjectId, ct);
        if (project == null)
        {
            throw new InvalidOperationException($"Project {session.Config.ProjectId} not found");
        }

        var sessionsFolder = GetSessionsFolderPath(project.RootPath);
        Directory.CreateDirectory(sessionsFolder);

        var sessionPath = GetSessionFilePath(project.RootPath, session.Id);
        var json = SerializeSession(session);
        await File.WriteAllTextAsync(sessionPath, json, ct);

        // Update cache
        _cache[session.Id.Value] = session;

        _logger?.LogInformation("Saved session {SessionId} for project {ProjectId}",
            session.Id.Value, session.Config.ProjectId);
    }

    public async Task DeleteAsync(SessionId id, CancellationToken ct = default)
    {
        var session = await GetByIdAsync(id, ct);
        if (session == null) return;

        var project = await FindProjectByIdAsync(session.Config.ProjectId, ct);
        if (project == null) return;

        var sessionPath = GetSessionFilePath(project.RootPath, id);
        if (File.Exists(sessionPath))
        {
            File.Delete(sessionPath);
        }

        _cache.TryRemove(id.Value, out _);
        _logger?.LogInformation("Deleted session {SessionId}", id.Value);
    }

    private async Task<Project?> FindProjectByIdAsync(string projectId, CancellationToken ct)
    {
        var projects = await _projectRepository.GetAllAsync(ct);
        return projects.FirstOrDefault(p => p.Id.ToString() == projectId);
    }

    private async Task<IEnumerable<ProjectSession>> LoadSessionsFromProjectAsync(Project project, CancellationToken ct)
    {
        var sessions = new List<ProjectSession>();
        var sessionsFolder = GetSessionsFolderPath(project.RootPath);

        if (!Directory.Exists(sessionsFolder))
        {
            return sessions;
        }

        var sessionFiles = Directory.GetFiles(sessionsFolder, "*.json");
        foreach (var file in sessionFiles)
        {
            try
            {
                var session = await LoadSessionFromFileAsync(file, ct);
                if (session != null)
                {
                    _cache[session.Id.Value] = session;
                    sessions.Add(session);
                }
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to load session from {Path}", file);
            }
        }

        return sessions;
    }

    private async Task<ProjectSession?> LoadSessionFromFileAsync(string path, CancellationToken ct)
    {
        if (!File.Exists(path)) return null;

        var json = await File.ReadAllTextAsync(path, ct);
        return DeserializeSession(json);
    }

    private static string GetSessionsFolderPath(string projectRootPath)
    {
        return Path.Combine(projectRootPath, MaestroConstants.MaestroFolderName, MaestroConstants.SessionsFolderName);
    }

    private static string GetSessionFilePath(string projectRootPath, SessionId sessionId)
    {
        return Path.Combine(GetSessionsFolderPath(projectRootPath), $"{sessionId.Value}.json");
    }

    private static string SerializeSession(ProjectSession session)
    {
        var dto = new SessionJsonDto
        {
            Id = session.Id.Value,
            Name = session.Name,
            Status = session.Status.ToString().ToLowerInvariant(),
            Authority = session.Authority.ToString(),
            WorkingDirectory = session.WorkingDirectory,
            Config = new SessionConfigJsonDto
            {
                ProjectId = session.Config.ProjectId,
                WorkflowId = session.Config.WorkflowId,
                Task = session.Config.Task,
                Context = session.Config.Context,
                Access = new AccessConfigJsonDto
                {
                    Level = session.Config.Access.Level.ToString().ToLowerInvariant(),
                    AllowedPaths = session.Config.Access.AllowedPaths.ToList(),
                    DeniedPaths = session.Config.Access.DeniedPaths.ToList(),
                    RequireApprovalPaths = session.Config.Access.RequireApprovalPaths.ToList()
                },
                Validation = new ValidationConfigJsonDto
                {
                    RunTests = session.Config.Validation.RunTests,
                    TestCommand = session.Config.Validation.TestCommand,
                    RunLinter = session.Config.Validation.RunLinter,
                    LinterCommand = session.Config.Validation.LinterCommand,
                    RequireCleanDiff = session.Config.Validation.RequireCleanDiff,
                    MaxSteps = session.Config.Validation.MaxSteps,
                    TimeoutMs = session.Config.Validation.TimeoutMs
                },
                Inputs = new Dictionary<string, object>(session.Config.Inputs)
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
            ErrorMessage = session.ErrorMessage,
            TestResult = session.TestResult != null ? new TestResultJsonDto
            {
                Passed = session.TestResult.Passed,
                TotalTests = session.TestResult.TotalTests,
                PassedTests = session.TestResult.PassedTests,
                FailedTests = session.TestResult.FailedTests,
                Output = session.TestResult.Output,
                DurationMs = session.TestResult.DurationMs
            } : null,
            LinterResult = session.LinterResult != null ? new LinterResultJsonDto
            {
                Clean = session.LinterResult.Clean,
                ErrorCount = session.LinterResult.ErrorCount,
                WarningCount = session.LinterResult.WarningCount,
                Output = session.LinterResult.Output
            } : null,
            CommitInfo = session.CommitInfo != null ? new CommitInfoJsonDto
            {
                CommitHash = session.CommitInfo.CommitHash,
                Message = session.CommitInfo.Message,
                Branch = session.CommitInfo.Branch,
                Pushed = session.CommitInfo.Pushed,
                CreatedAt = session.CommitInfo.CreatedAt
            } : null
        };

        return JsonSerializer.Serialize(dto, JsonOptions);
    }

    private static ProjectSession? DeserializeSession(string json)
    {
        var dto = JsonSerializer.Deserialize<SessionJsonDto>(json, JsonOptions);
        if (dto == null) return null;

        var config = new ProjectSessionConfig
        {
            ProjectId = dto.Config.ProjectId,
            WorkflowId = dto.Config.WorkflowId,
            Task = dto.Config.Task,
            Context = dto.Config.Context,
            Access = new AccessConfig
            {
                Level = Enum.Parse<AccessLevel>(dto.Config.Access.Level, ignoreCase: true),
                AllowedPaths = dto.Config.Access.AllowedPaths,
                DeniedPaths = dto.Config.Access.DeniedPaths,
                RequireApprovalPaths = dto.Config.Access.RequireApprovalPaths
            },
            Validation = new ValidationConfig
            {
                RunTests = dto.Config.Validation.RunTests,
                TestCommand = dto.Config.Validation.TestCommand,
                RunLinter = dto.Config.Validation.RunLinter,
                LinterCommand = dto.Config.Validation.LinterCommand,
                RequireCleanDiff = dto.Config.Validation.RequireCleanDiff,
                MaxSteps = dto.Config.Validation.MaxSteps,
                TimeoutMs = dto.Config.Validation.TimeoutMs
            },
            Inputs = dto.Config.Inputs ?? new Dictionary<string, object>()
        };

        // Parse authority
        var authority = !string.IsNullOrEmpty(dto.Authority)
            ? Authority.Parse(dto.Authority)
            : Authority.Human();

        // Create session with authority
        var session = ProjectSession.Create(dto.Name, authority, config);

        // Parse status and restore state
        var status = Enum.Parse<SessionStatus>(dto.Status, ignoreCase: true);

        // Restore session state based on serialized status
        RestoreSessionState(session, dto, status);

        return session;
    }

    private static void RestoreSessionState(ProjectSession session, SessionJsonDto dto, SessionStatus status)
    {
        // Use reflection to set private fields
        var type = typeof(ProjectSession);
        var bindingFlags = System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public;

        // Set Status
        var statusField = type.GetField("<Status>k__BackingField", bindingFlags);
        statusField?.SetValue(session, status);

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

        // Restore test result
        if (dto.TestResult != null)
        {
            session.SetTestResult(new TestResult
            {
                Passed = dto.TestResult.Passed,
                TotalTests = dto.TestResult.TotalTests,
                PassedTests = dto.TestResult.PassedTests,
                FailedTests = dto.TestResult.FailedTests,
                Output = dto.TestResult.Output,
                DurationMs = dto.TestResult.DurationMs
            });
        }

        // Restore linter result
        if (dto.LinterResult != null)
        {
            session.SetLinterResult(new LinterResult
            {
                Clean = dto.LinterResult.Clean,
                ErrorCount = dto.LinterResult.ErrorCount,
                WarningCount = dto.LinterResult.WarningCount,
                Output = dto.LinterResult.Output
            });
        }

        // Restore commit info
        if (dto.CommitInfo != null)
        {
            session.SetCommitInfo(new CommitInfo
            {
                CommitHash = dto.CommitInfo.CommitHash,
                Message = dto.CommitInfo.Message,
                Branch = dto.CommitInfo.Branch,
                Pushed = dto.CommitInfo.Pushed,
                CreatedAt = dto.CommitInfo.CreatedAt
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
        public string WorkingDirectory { get; set; } = ".";
        public SessionConfigJsonDto Config { get; set; } = new();
        public DateTime CreatedAt { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public int CommandCount { get; set; }
        public List<FileChangeJsonDto> ModifiedFiles { get; set; } = new();
        public string? ErrorMessage { get; set; }
        public TestResultJsonDto? TestResult { get; set; }
        public LinterResultJsonDto? LinterResult { get; set; }
        public CommitInfoJsonDto? CommitInfo { get; set; }
    }

    private class SessionConfigJsonDto
    {
        public string ProjectId { get; set; } = string.Empty;
        public string? WorkflowId { get; set; }
        public string? Task { get; set; }
        public string? Context { get; set; }
        public AccessConfigJsonDto Access { get; set; } = new();
        public ValidationConfigJsonDto Validation { get; set; } = new();
        public Dictionary<string, object>? Inputs { get; set; }
    }

    private class AccessConfigJsonDto
    {
        public string Level { get; set; } = "controlled";
        public List<string> AllowedPaths { get; set; } = new();
        public List<string> DeniedPaths { get; set; } = new();
        public List<string> RequireApprovalPaths { get; set; } = new();
    }

    private class ValidationConfigJsonDto
    {
        public bool RunTests { get; set; }
        public string? TestCommand { get; set; }
        public bool RunLinter { get; set; }
        public string? LinterCommand { get; set; }
        public bool RequireCleanDiff { get; set; }
        public int MaxSteps { get; set; } = 50;
        public int TimeoutMs { get; set; } = 600000;
    }

    private class FileChangeJsonDto
    {
        public string Path { get; set; } = string.Empty;
        public string ChangeType { get; set; } = "modified";
    }

    private class TestResultJsonDto
    {
        public bool Passed { get; set; }
        public int TotalTests { get; set; }
        public int PassedTests { get; set; }
        public int FailedTests { get; set; }
        public string? Output { get; set; }
        public long DurationMs { get; set; }
    }

    private class LinterResultJsonDto
    {
        public bool Clean { get; set; }
        public int ErrorCount { get; set; }
        public int WarningCount { get; set; }
        public string? Output { get; set; }
    }

    private class CommitInfoJsonDto
    {
        public string CommitHash { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string Branch { get; set; } = string.Empty;
        public bool Pushed { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
