using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.Enums;

namespace Maestro.Application.DTOs;

/// <summary>
/// Data Transfer Object for ProjectSession.
/// </summary>
public record ProjectSessionDto
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Type { get; init; } = "project";
    public string Status { get; init; } = "created";
    public string Authority { get; init; } = "human";
    public ProjectSessionConfigDto Config { get; init; } = new();
    public DateTime CreatedAt { get; init; }
    public DateTime? StartedAt { get; init; }
    public DateTime? CompletedAt { get; init; }
    public long? DurationMs { get; init; }
    public int CommandCount { get; init; }
    public string WorkingDirectory { get; init; } = ".";
    public List<FileChangeDto> ModifiedFiles { get; init; } = new();
    public string? ErrorMessage { get; init; }
    public TestResultDto? TestResult { get; init; }
    public LinterResultDto? LinterResult { get; init; }
    public CommitInfoDto? CommitInfo { get; init; }
    public Dictionary<string, object> Variables { get; init; } = new();
    public Dictionary<string, string> EntryPoints { get; init; } = new();
    public List<MonitorWidgetConfigDto> MonitorWidgets { get; init; } = new();
    public string? RepositoryPath { get; init; }
    public bool IsBoundToRepository { get; init; }
    public string? ParentSessionId { get; init; }

    public static ProjectSessionDto FromDomain(ProjectSession session)
    {
        return new ProjectSessionDto
        {
            Id = session.Id,
            Name = session.Name,
            Type = session.SessionType.ToString().ToLowerInvariant(),
            Status = session.GetSessionStatus().ToString().ToLowerInvariant(),
            Authority = session.Authority.ToString(),
            Config = ProjectSessionConfigDto.FromDomain(session.Config),
            CreatedAt = session.CreatedAt.DateTime,
            StartedAt = session.StartedAt?.DateTime,
            CompletedAt = session.CompletedAt?.DateTime,
            DurationMs = session.DurationMs,
            CommandCount = session.CommandCount,
            WorkingDirectory = session.WorkingDirectory,
            ModifiedFiles = session.ModifiedFiles.Select(FileChangeDto.FromDomain).ToList(),
            ErrorMessage = session.ErrorMessage,
            TestResult = session.TestResult != null ? TestResultDto.FromDomain(session.TestResult) : null,
            LinterResult = session.LinterResult != null ? LinterResultDto.FromDomain(session.LinterResult) : null,
            CommitInfo = session.CommitInfo != null ? CommitInfoDto.FromDomain(session.CommitInfo) : null,
            Variables = new Dictionary<string, object>(session.Variables),
            EntryPoints = new Dictionary<string, string>(session.EntryPoints),
            MonitorWidgets = session.MonitorWidgets.Select(w => new MonitorWidgetConfigDto
            {
                Id = w.Id,
                Type = w.Type,
                Config = new Dictionary<string, object>(w.Config)
            }).ToList(),
            RepositoryPath = session.RepositoryPath,
            IsBoundToRepository = session.IsBoundToRepository,
            ParentSessionId = session.ParentSessionId
        };
    }
}

/// <summary>
/// DTO for monitor widget configuration.
/// </summary>
public record MonitorWidgetConfigDto
{
    public string Id { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public Dictionary<string, object> Config { get; init; } = new();
}

/// <summary>
/// DTO for project session configuration.
/// </summary>
public record ProjectSessionConfigDto
{
    public string ProjectId { get; init; } = string.Empty;
    public string? WorkflowId { get; init; }
    public string? Task { get; init; }
    public string? Context { get; init; }
    public AccessConfigDto Access { get; init; } = new();
    public ValidationConfigDto Validation { get; init; } = new();
    public Dictionary<string, object> Inputs { get; init; } = new();

    public static ProjectSessionConfigDto FromDomain(ProjectSessionConfig config)
    {
        return new ProjectSessionConfigDto
        {
            ProjectId = config.ProjectId,
            WorkflowId = config.WorkflowId,
            Task = config.Task,
            Context = config.Context,
            Access = AccessConfigDto.FromDomain(config.Access),
            Validation = ValidationConfigDto.FromDomain(config.Validation),
            Inputs = new Dictionary<string, object>(config.Inputs)
        };
    }

    public ProjectSessionConfig ToDomain()
    {
        return new ProjectSessionConfig
        {
            ProjectId = ProjectId,
            WorkflowId = WorkflowId,
            Task = Task,
            Context = Context,
            Access = Access.ToDomain(),
            Validation = Validation.ToDomain(),
            Inputs = new Dictionary<string, object>(Inputs)
        };
    }
}

/// <summary>
/// DTO for access configuration.
/// </summary>
public record AccessConfigDto
{
    public string Level { get; init; } = "controlled";
    public List<string> AllowedPaths { get; init; } = new();
    public List<string> DeniedPaths { get; init; } = new();
    public List<string> RequireApprovalPaths { get; init; } = new();

    public static AccessConfigDto FromDomain(AccessConfig config)
    {
        return new AccessConfigDto
        {
            Level = config.Level.ToString().ToLowerInvariant(),
            AllowedPaths = config.AllowedPaths.ToList(),
            DeniedPaths = config.DeniedPaths.ToList(),
            RequireApprovalPaths = config.RequireApprovalPaths.ToList()
        };
    }

    public AccessConfig ToDomain()
    {
        return new AccessConfig
        {
            Level = Enum.Parse<AccessLevel>(Level, ignoreCase: true),
            AllowedPaths = AllowedPaths,
            DeniedPaths = DeniedPaths,
            RequireApprovalPaths = RequireApprovalPaths
        };
    }
}

/// <summary>
/// DTO for validation configuration.
/// </summary>
public record ValidationConfigDto
{
    public bool RunTests { get; init; }
    public string? TestCommand { get; init; }
    public bool RunLinter { get; init; }
    public string? LinterCommand { get; init; }
    public bool RequireCleanDiff { get; init; }
    public int MaxSteps { get; init; } = 50;
    public int TimeoutMs { get; init; } = 600000;

    public static ValidationConfigDto FromDomain(ValidationConfig config)
    {
        return new ValidationConfigDto
        {
            RunTests = config.RunTests,
            TestCommand = config.TestCommand,
            RunLinter = config.RunLinter,
            LinterCommand = config.LinterCommand,
            RequireCleanDiff = config.RequireCleanDiff,
            MaxSteps = config.MaxSteps,
            TimeoutMs = config.TimeoutMs
        };
    }

    public ValidationConfig ToDomain()
    {
        return new ValidationConfig
        {
            RunTests = RunTests,
            TestCommand = TestCommand,
            RunLinter = RunLinter,
            LinterCommand = LinterCommand,
            RequireCleanDiff = RequireCleanDiff,
            MaxSteps = MaxSteps,
            TimeoutMs = TimeoutMs
        };
    }
}

/// <summary>
/// DTO for file change.
/// </summary>
public record FileChangeDto
{
    public string Path { get; init; } = string.Empty;
    public string ChangeType { get; init; } = "modified";

    public static FileChangeDto FromDomain(FileChange change)
    {
        return new FileChangeDto
        {
            Path = change.Path,
            ChangeType = change.ChangeType.ToString().ToLowerInvariant()
        };
    }
}

/// <summary>
/// DTO for test results.
/// </summary>
public record TestResultDto
{
    public bool Passed { get; init; }
    public int TotalTests { get; init; }
    public int PassedTests { get; init; }
    public int FailedTests { get; init; }
    public string? Output { get; init; }
    public long DurationMs { get; init; }

    public static TestResultDto FromDomain(TestResult result)
    {
        return new TestResultDto
        {
            Passed = result.Passed,
            TotalTests = result.TotalTests,
            PassedTests = result.PassedTests,
            FailedTests = result.FailedTests,
            Output = result.Output,
            DurationMs = result.DurationMs
        };
    }
}

/// <summary>
/// DTO for linter results.
/// </summary>
public record LinterResultDto
{
    public bool Clean { get; init; }
    public int ErrorCount { get; init; }
    public int WarningCount { get; init; }
    public string? Output { get; init; }

    public static LinterResultDto FromDomain(LinterResult result)
    {
        return new LinterResultDto
        {
            Clean = result.Clean,
            ErrorCount = result.ErrorCount,
            WarningCount = result.WarningCount,
            Output = result.Output
        };
    }
}

/// <summary>
/// DTO for commit information.
/// </summary>
public record CommitInfoDto
{
    public string CommitHash { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string Branch { get; init; } = string.Empty;
    public bool Pushed { get; init; }
    public DateTime CreatedAt { get; init; }

    public static CommitInfoDto FromDomain(CommitInfo info)
    {
        return new CommitInfoDto
        {
            CommitHash = info.CommitHash,
            Message = info.Message,
            Branch = info.Branch,
            Pushed = info.Pushed,
            CreatedAt = info.CreatedAt
        };
    }
}

/// <summary>
/// Request to create a project session.
/// </summary>
public record CreateProjectSessionRequest
{
    public string? Name { get; init; }
    public required string ProjectId { get; init; }
    public string? WorkflowId { get; init; }
    public string? Task { get; init; }
    public string? Context { get; init; }
    public string Authority { get; init; } = "human";
    public string Access { get; init; } = "controlled";
    public List<string>? AllowedPaths { get; init; }
    public List<string>? DeniedPaths { get; init; }
    public bool RunTests { get; init; }
    public string? TestCommand { get; init; }
    public bool RunLinter { get; init; }
    public string? LinterCommand { get; init; }
    public int MaxSteps { get; init; } = 50;
    public int TimeoutMs { get; init; } = 600000;
    public Dictionary<string, object>? Inputs { get; init; }
}

/// <summary>
/// Request to commit session changes.
/// </summary>
public record CommitSessionRequest
{
    public required string Message { get; init; }
    public string? Branch { get; init; }
    public bool Push { get; init; }
    public string? Type { get; init; }
    public string? Scope { get; init; }
}

/// <summary>
/// DTO for session diff response.
/// </summary>
public record SessionDiffDto
{
    public List<FileDiffDto> Files { get; init; } = new();
    public int TotalFiles { get; init; }
    public int LinesAdded { get; init; }
    public int LinesRemoved { get; init; }
}

/// <summary>
/// DTO for file diff.
/// </summary>
public record FileDiffDto
{
    public string Path { get; init; } = string.Empty;
    public string ChangeType { get; init; } = string.Empty;
    public string? Diff { get; init; }
    public int LinesAdded { get; init; }
    public int LinesRemoved { get; init; }
}
