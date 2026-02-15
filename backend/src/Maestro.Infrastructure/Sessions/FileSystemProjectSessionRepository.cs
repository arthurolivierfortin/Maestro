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

    /// <summary>
    /// Tracks repository paths for sessions created with --repo (no project).
    /// These paths are not covered by the project list and must be scanned separately.
    /// </summary>
    private readonly ConcurrentDictionary<string, byte> _knownRepoPaths = new();

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
        var sessionId = id.Value;

        // Check cache first
        if (_cache.TryGetValue(sessionId, out var cached))
        {
            return cached;
        }

        // Search across all projects
        var projects = await _projectRepository.GetAllAsync(ct);
        foreach (var project in projects)
        {
            var sessionPath = GetSessionFilePath(project.RootPath, sessionId);
            if (File.Exists(sessionPath))
            {
                var session = await LoadSessionFromFileAsync(sessionPath, ct);
                if (session != null)
                {
                    _cache[sessionId] = session;
                    return session;
                }
            }
        }

        // Search repo-only sessions (created with --repo, no project)
        foreach (var repoPath in _knownRepoPaths.Keys)
        {
            var sessionPath = GetSessionFilePath(repoPath, sessionId);
            if (File.Exists(sessionPath))
            {
                var session = await LoadSessionFromFileAsync(sessionPath, ct);
                if (session != null)
                {
                    _cache[sessionId] = session;
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
            var scannedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var project in projects)
            {
                allSessions.AddRange(await LoadSessionsFromProjectAsync(project, ct));
                scannedPaths.Add(project.RootPath);
            }

            // Also scan repo-only sessions (created with --repo, no project)
            foreach (var repoPath in _knownRepoPaths.Keys)
            {
                if (!scannedPaths.Contains(repoPath))
                {
                    allSessions.AddRange(await LoadSessionsFromPathAsync(repoPath, ct));
                }
            }
        }

        // Apply filters
        IEnumerable<ProjectSession> filtered = allSessions;

        if (status.HasValue)
        {
            // Map SessionStatus to ContainerSessionStatus for comparison
            filtered = filtered.Where(s => s.GetSessionStatus() == status.Value);
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

        string sessionsFolder;

        if (!string.IsNullOrEmpty(session.Config.ProjectId))
        {
            var project = await FindProjectByIdAsync(session.Config.ProjectId, ct);
            if (project != null)
            {
                sessionsFolder = GetSessionsFolderPath(project.RootPath);
            }
            else if (!string.IsNullOrEmpty(session.RepositoryPath))
            {
                sessionsFolder = GetSessionsFolderPath(session.RepositoryPath);
            }
            else
            {
                throw new InvalidOperationException($"Cannot save session: Project {session.Config.ProjectId} not found and no RepositoryPath");
            }
        }
        else if (!string.IsNullOrEmpty(session.RepositoryPath))
        {
            sessionsFolder = GetSessionsFolderPath(session.RepositoryPath);
        }
        else
        {
            throw new InvalidOperationException("Cannot save session: no ProjectId or RepositoryPath");
        }

        Directory.CreateDirectory(sessionsFolder);

        var sessionPath = Path.Combine(sessionsFolder, $"{session.Id}.json");
        var json = SerializeSession(session);
        await File.WriteAllTextAsync(sessionPath, json, ct);

        // Update cache
        _cache[session.Id] = session;

        // Track repo path for sessions without a project (so GetAllAsync can find them)
        if (string.IsNullOrEmpty(session.Config.ProjectId) && !string.IsNullOrEmpty(session.RepositoryPath))
        {
            _knownRepoPaths.TryAdd(session.RepositoryPath, 0);
        }

        _logger?.LogInformation("Saved session {SessionId}", session.Id);
    }

    public async Task DeleteAsync(SessionId id, CancellationToken ct = default)
    {
        var sessionId = id.Value;
        var session = await GetByIdAsync(id, ct);
        if (session == null) return;

        string? sessionsFolder = null;

        if (!string.IsNullOrEmpty(session.Config.ProjectId))
        {
            var project = await FindProjectByIdAsync(session.Config.ProjectId, ct);
            if (project != null)
            {
                sessionsFolder = GetSessionsFolderPath(project.RootPath);
            }
        }

        if (sessionsFolder == null && !string.IsNullOrEmpty(session.RepositoryPath))
        {
            sessionsFolder = GetSessionsFolderPath(session.RepositoryPath);
        }

        if (sessionsFolder != null)
        {
            var sessionPath = Path.Combine(sessionsFolder, $"{sessionId}.json");
            if (File.Exists(sessionPath))
            {
                File.Delete(sessionPath);
            }
        }

        _cache.TryRemove(sessionId, out _);
        _logger?.LogInformation("Deleted session {SessionId}", sessionId);
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
                    _cache[session.Id] = session;
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

    private async Task<IEnumerable<ProjectSession>> LoadSessionsFromPathAsync(string repoPath, CancellationToken ct)
    {
        var sessions = new List<ProjectSession>();
        var sessionsFolder = GetSessionsFolderPath(repoPath);

        if (!Directory.Exists(sessionsFolder))
            return sessions;

        var sessionFiles = Directory.GetFiles(sessionsFolder, "*.json");
        foreach (var file in sessionFiles)
        {
            try
            {
                var session = await LoadSessionFromFileAsync(file, ct);
                if (session != null)
                {
                    _cache[session.Id] = session;
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

    private static string GetSessionFilePath(string projectRootPath, string sessionId)
    {
        return Path.Combine(GetSessionsFolderPath(projectRootPath), $"{sessionId}.json");
    }

    private static string SerializeSession(ProjectSession session)
    {
        var dto = new SessionJsonDto
        {
            Id = session.Id,
            Name = session.Name,
            Status = session.GetSessionStatus().ToString().ToLowerInvariant(),
            TerminalReason = session.TerminalReason.ToString().ToLowerInvariant(),
            Authority = session.Authority.ToString(),
            WorkingDirectory = session.WorkingDirectory,
            RepositoryPath = session.RepositoryPath,
            ParentWorkspaceId = session.ParentWorkspaceId,
            ParentSessionId = session.ParentSessionId,
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
            UpdatedAt = session.UpdatedAt,
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
            } : null,
            Variables = session.Variables.Count > 0 ? SerializeVariables(session.Variables) : null,
            EntryPoints = session.EntryPoints.Count > 0 ? new Dictionary<string, string>(session.EntryPoints) : null,
            MonitorWidgets = session.MonitorWidgets.Count > 0 ? session.MonitorWidgets.Select(w => new MonitorWidgetJsonDto
            {
                Id = w.Id,
                Type = w.Type,
                Config = w.Config.Count > 0 ? new Dictionary<string, object>(w.Config) : null
            }).ToList() : null,
            // Session-level configuration (from ContainerSession)
            BlockSearchPaths = session.BlockSearchPaths?.Count > 0 ? session.BlockSearchPaths.ToList() : null,
            DefaultModel = session.DefaultModel,
            ModelOverrides = session.ModelOverrides?.Count > 0
                ? new Dictionary<string, string>(session.ModelOverrides)
                : null,
            FileAccessRulesConfig = session.FileAccessRules?.Count > 0 ? session.FileAccessRules.Select(r => new FileAccessRuleJsonDto
            {
                Path = r.Path,
                Type = r.Type.ToString().ToLowerInvariant(),
                Permission = r.Permission.ToString().ToLowerInvariant(),
                Reason = r.Reason
            }).ToList() : null,
            BlockPermissionsConfig = session.BlockPermissions?.Count > 0 ? session.BlockPermissions.Select(p => new BlockPermissionJsonDto
            {
                BlockPattern = p.BlockPattern,
                Permission = p.Permission.ToString().ToLowerInvariant(),
                Reason = p.Reason
            }).ToList() : null
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

        // Parse status
        var sessionStatus = Enum.Parse<SessionStatus>(dto.Status, ignoreCase: true);
        var containerStatus = MapSessionStatusToContainerStatus(sessionStatus);

        // Parse terminal reason
        var terminalReason = SessionTerminalReason.None;
        if (!string.IsNullOrEmpty(dto.TerminalReason))
        {
            Enum.TryParse<SessionTerminalReason>(dto.TerminalReason, ignoreCase: true, out terminalReason);
        }
        else if (containerStatus == ContainerSessionStatus.Ended)
        {
            // Infer terminal reason from old status for backwards compatibility
            terminalReason = sessionStatus switch
            {
                SessionStatus.Completed => SessionTerminalReason.Completed,
                SessionStatus.Failed => SessionTerminalReason.Failed,
                SessionStatus.Cancelled => SessionTerminalReason.Cancelled,
                SessionStatus.Stopped => SessionTerminalReason.Stopped,
                _ => SessionTerminalReason.Completed
            };
        }

        // Build container binding
        var accessLevel = MapAccessLevelToRepositoryAccessLevel(config.Access.Level);
        var binding = dto.RepositoryPath != null
            ? ContainerBinding.CreateRepositoryBound(dto.RepositoryPath, accessLevel)
            : ContainerBinding.CreateSandbox();

        // Restore modified files
        var modifiedFiles = dto.ModifiedFiles.Select(f => new FileChange
        {
            Path = f.Path,
            ChangeType = Enum.Parse<FileChangeType>(f.ChangeType, ignoreCase: true)
        }).ToList();

        // Restore test result
        TestResult? testResult = dto.TestResult != null ? new TestResult
        {
            Passed = dto.TestResult.Passed,
            TotalTests = dto.TestResult.TotalTests,
            PassedTests = dto.TestResult.PassedTests,
            FailedTests = dto.TestResult.FailedTests,
            Output = dto.TestResult.Output,
            DurationMs = dto.TestResult.DurationMs
        } : null;

        // Restore linter result
        LinterResult? linterResult = dto.LinterResult != null ? new LinterResult
        {
            Clean = dto.LinterResult.Clean,
            ErrorCount = dto.LinterResult.ErrorCount,
            WarningCount = dto.LinterResult.WarningCount,
            Output = dto.LinterResult.Output
        } : null;

        // Restore commit info
        CommitInfo? commitInfo = dto.CommitInfo != null ? new CommitInfo
        {
            CommitHash = dto.CommitInfo.CommitHash,
            Message = dto.CommitInfo.Message,
            Branch = dto.CommitInfo.Branch,
            Pushed = dto.CommitInfo.Pushed,
            CreatedAt = dto.CommitInfo.CreatedAt
        } : null;

        // Restore variables (convert JsonNode back to native CLR types)
        var variables = new Dictionary<string, object>();
        if (dto.Variables != null)
        {
            foreach (var kvp in dto.Variables)
            {
                if (kvp.Value != null)
                {
                    // JsonNode → JsonElement → native type via ConvertJsonElement
                    var element = kvp.Value.Deserialize<JsonElement>();
                    variables[kvp.Key] = ConvertJsonElement(element);
                }
                else
                {
                    variables[kvp.Key] = string.Empty;
                }
            }
        }

        // Restore entry points
        var entryPoints = dto.EntryPoints != null
            ? new Dictionary<string, string>(dto.EntryPoints)
            : new Dictionary<string, string>();

        // Restore monitor widgets
        var monitorWidgets = dto.MonitorWidgets != null
            ? dto.MonitorWidgets.Select(w => new MonitorWidgetConfig
            {
                Id = w.Id,
                Type = w.Type,
                Config = w.Config != null
                    ? w.Config.ToDictionary(kvp => kvp.Key, kvp => ConvertJsonElement(kvp.Value))
                    : new Dictionary<string, object>()
            }).ToList()
            : new List<MonitorWidgetConfig>();

        // Use Reconstitute to create the session with all state
        var session = ProjectSession.Reconstitute(
            id: dto.Id,
            name: dto.Name,
            authority: authority,
            config: config,
            status: containerStatus,
            terminalReason: terminalReason,
            repositoryPath: dto.RepositoryPath,
            parentWorkspaceId: dto.ParentWorkspaceId,
            parentSessionId: dto.ParentSessionId,
            workingDirectory: dto.WorkingDirectory ?? ".",
            permissions: ContextPermissions.Full, // TODO: Serialize permissions
            binding: binding,
            blockRegistry: SessionBlockRegistry.Empty(), // TODO: Serialize block registry
            modifiedFiles: modifiedFiles,
            testResult: testResult,
            linterResult: linterResult,
            commitInfo: commitInfo,
            errorMessage: dto.ErrorMessage,
            createdAt: dto.CreatedAt,
            startedAt: dto.StartedAt,
            completedAt: dto.CompletedAt,
            updatedAt: dto.UpdatedAt,
            createdBy: null,
            variables: variables,
            entryPoints: entryPoints,
            monitorWidgets: monitorWidgets
        );

        // Restore session-level configuration (from ContainerSession)
        if (dto.BlockSearchPaths != null && dto.BlockSearchPaths.Count > 0)
            session.SetBlockSearchPaths(dto.BlockSearchPaths.AsReadOnly());
        if (dto.DefaultModel != null)
            session.SetDefaultModel(dto.DefaultModel);
        if (dto.ModelOverrides != null && dto.ModelOverrides.Count > 0)
            session.SetModelOverrides(dto.ModelOverrides);
        if (dto.FileAccessRulesConfig != null && dto.FileAccessRulesConfig.Count > 0)
        {
            session.SetFileAccessRules(dto.FileAccessRulesConfig.Select(r => new FileAccessRule
            {
                Path = r.Path,
                Type = Enum.Parse<FileAccessType>(r.Type, ignoreCase: true),
                Permission = Enum.Parse<FileAccessPermission>(r.Permission, ignoreCase: true),
                Reason = r.Reason
            }).ToList().AsReadOnly());
        }
        if (dto.BlockPermissionsConfig != null && dto.BlockPermissionsConfig.Count > 0)
        {
            session.SetBlockPermissions(dto.BlockPermissionsConfig.Select(p => new BlockPermission
            {
                BlockPattern = p.BlockPattern,
                Permission = Enum.Parse<BlockPermissionLevel>(p.Permission, ignoreCase: true),
                Reason = p.Reason
            }).ToList().AsReadOnly());
        }

        return session;
    }

    /// <summary>
    /// Converts all variable values to JsonNode for reliable serialization.
    /// System.Text.Json cannot properly serialize Dictionary&lt;string, object&gt; when
    /// values are List&lt;object&gt; or Dictionary&lt;string, object&gt; at runtime.
    /// We manually build JsonNode trees which serialize correctly.
    /// </summary>
    private static Dictionary<string, System.Text.Json.Nodes.JsonNode?> SerializeVariables(Dictionary<string, object> variables)
    {
        var result = new Dictionary<string, System.Text.Json.Nodes.JsonNode?>(variables.Count);
        foreach (var kvp in variables)
        {
            result[kvp.Key] = ObjectToJsonNode(kvp.Value);
        }
        return result;
    }

    /// <summary>
    /// Recursively converts any object to a JsonNode, handling all runtime types.
    /// </summary>
    private static System.Text.Json.Nodes.JsonNode? ObjectToJsonNode(object? value)
    {
        if (value == null) return null;

        if (value is JsonElement element)
        {
            return System.Text.Json.Nodes.JsonNode.Parse(element.GetRawText());
        }

        // Newtonsoft.Json types (from .AddNewtonsoftJson() in Program.cs)
        if (value is Newtonsoft.Json.Linq.JToken jToken)
        {
            return System.Text.Json.Nodes.JsonNode.Parse(jToken.ToString(Newtonsoft.Json.Formatting.None));
        }

        if (value is string s) return System.Text.Json.Nodes.JsonValue.Create(s);
        if (value is bool b) return System.Text.Json.Nodes.JsonValue.Create(b);
        if (value is int i) return System.Text.Json.Nodes.JsonValue.Create(i);
        if (value is long l) return System.Text.Json.Nodes.JsonValue.Create(l);
        if (value is double d) return System.Text.Json.Nodes.JsonValue.Create(d);
        if (value is float f) return System.Text.Json.Nodes.JsonValue.Create(f);
        if (value is decimal dec) return System.Text.Json.Nodes.JsonValue.Create(dec);

        if (value is IDictionary<string, object> dict)
        {
            var obj = new System.Text.Json.Nodes.JsonObject();
            foreach (var kv in dict)
            {
                obj[kv.Key] = ObjectToJsonNode(kv.Value);
            }
            return obj;
        }

        if (value is IList<object> list)
        {
            var arr = new System.Text.Json.Nodes.JsonArray();
            foreach (var item in list)
            {
                arr.Add(ObjectToJsonNode(item));
            }
            return arr;
        }

        if (value is IEnumerable<object> enumerable)
        {
            var arr = new System.Text.Json.Nodes.JsonArray();
            foreach (var item in enumerable)
            {
                arr.Add(ObjectToJsonNode(item));
            }
            return arr;
        }

        // Fallback: convert ToString
        return System.Text.Json.Nodes.JsonValue.Create(value.ToString() ?? "");
    }

    /// <summary>
    /// Converts JsonElement to appropriate CLR types.
    /// </summary>
    private static object ConvertJsonElement(object value)
    {
        if (value is JsonElement element)
        {
            return element.ValueKind switch
            {
                JsonValueKind.String => element.GetString() ?? string.Empty,
                JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDouble(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Null => null!,
                JsonValueKind.Array => element.EnumerateArray().Select(e => ConvertJsonElement(e)).ToList(),
                JsonValueKind.Object => element.EnumerateObject().ToDictionary(p => p.Name, p => ConvertJsonElement(p.Value)),
                _ => element.ToString()
            };
        }
        return value;
    }

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

    private static Maestro.Domain.ValueObjects.RepositoryAccessLevel MapAccessLevelToRepositoryAccessLevel(AccessLevel level)
    {
        return level switch
        {
            AccessLevel.ReadOnly => Maestro.Domain.ValueObjects.RepositoryAccessLevel.ReadOnly,
            AccessLevel.Sandbox => Maestro.Domain.ValueObjects.RepositoryAccessLevel.Controlled,
            AccessLevel.Controlled => Maestro.Domain.ValueObjects.RepositoryAccessLevel.Controlled,
            AccessLevel.Full => Maestro.Domain.ValueObjects.RepositoryAccessLevel.Full,
            _ => Maestro.Domain.ValueObjects.RepositoryAccessLevel.Controlled
        };
    }

    // JSON DTOs for serialization
    private class SessionJsonDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Status { get; set; } = "created";
        public string? TerminalReason { get; set; }
        public string Authority { get; set; } = "human";
        public string? WorkingDirectory { get; set; } = ".";
        public string? RepositoryPath { get; set; }
        public string? ParentWorkspaceId { get; set; }
        public string? ParentSessionId { get; set; }
        public SessionConfigJsonDto Config { get; set; } = new();
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? StartedAt { get; set; }
        public DateTimeOffset? CompletedAt { get; set; }
        public DateTimeOffset? UpdatedAt { get; set; }
        public int CommandCount { get; set; }
        public List<FileChangeJsonDto> ModifiedFiles { get; set; } = new();
        public string? ErrorMessage { get; set; }
        public TestResultJsonDto? TestResult { get; set; }
        public LinterResultJsonDto? LinterResult { get; set; }
        public CommitInfoJsonDto? CommitInfo { get; set; }
        public Dictionary<string, System.Text.Json.Nodes.JsonNode?>? Variables { get; set; }
        public Dictionary<string, string>? EntryPoints { get; set; }
        public List<MonitorWidgetJsonDto>? MonitorWidgets { get; set; }
        // Session-level configuration (from ContainerSession)
        public List<string>? BlockSearchPaths { get; set; }
        public string? DefaultModel { get; set; }
        public Dictionary<string, string>? ModelOverrides { get; set; }
        public List<FileAccessRuleJsonDto>? FileAccessRulesConfig { get; set; }
        public List<BlockPermissionJsonDto>? BlockPermissionsConfig { get; set; }
    }

    private class MonitorWidgetJsonDto
    {
        public string Id { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public Dictionary<string, object>? Config { get; set; }
    }

    private class SessionConfigJsonDto
    {
        public string? ProjectId { get; set; }
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

    private class FileAccessRuleJsonDto
    {
        public string Path { get; set; } = string.Empty;
        public string Type { get; set; } = "file";
        public string Permission { get; set; } = "readWrite";
        public string? Reason { get; set; }
    }

    private class BlockPermissionJsonDto
    {
        public string BlockPattern { get; set; } = string.Empty;
        public string Permission { get; set; } = "allowed";
        public string? Reason { get; set; }
    }
}
