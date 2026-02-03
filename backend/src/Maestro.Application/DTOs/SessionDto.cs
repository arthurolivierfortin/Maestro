using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.Enums;

namespace Maestro.Application.DTOs;

/// <summary>
/// Data Transfer Object for the unified Session entity.
/// </summary>
public record SessionDto
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Status { get; init; } = "created";
    public string Authority { get; init; } = "human";
    public SessionConfigDto Config { get; init; } = new();
    public string? ContainerId { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? StartedAt { get; init; }
    public DateTime? CompletedAt { get; init; }
    public long? DurationMs { get; init; }
    public int CommandCount { get; init; }
    public string WorkingDirectory { get; init; } = "/workspace";
    public List<FileChangeDto> ModifiedFiles { get; init; } = new();
    public string? ErrorMessage { get; init; }
    public TestResultDto? TestResult { get; init; }
    public LinterResultDto? LinterResult { get; init; }
    public CommitInfoDto? CommitInfo { get; init; }

    public static SessionDto FromDomain(Session session)
    {
        return new SessionDto
        {
            Id = session.Id.ToString(),
            Name = session.Name,
            Status = session.Status.ToString().ToLowerInvariant(),
            Authority = session.Authority.ToString(),
            Config = SessionConfigDto.FromDomain(session.Config),
            ContainerId = session.ContainerId,
            CreatedAt = session.CreatedAt,
            StartedAt = session.StartedAt,
            CompletedAt = session.CompletedAt,
            DurationMs = session.DurationMs,
            CommandCount = session.CommandCount,
            WorkingDirectory = session.WorkingDirectory,
            ModifiedFiles = session.ModifiedFiles.Select(FileChangeDto.FromDomain).ToList(),
            ErrorMessage = session.ErrorMessage,
            TestResult = session.TestResult != null ? TestResultDto.FromDomain(session.TestResult) : null,
            LinterResult = session.LinterResult != null ? LinterResultDto.FromDomain(session.LinterResult) : null,
            CommitInfo = session.CommitInfo != null ? CommitInfoDto.FromDomain(session.CommitInfo) : null
        };
    }
}

/// <summary>
/// DTO for composable session configuration.
/// </summary>
public record SessionConfigDto
{
    public string Mode { get; init; } = "sandbox";
    public string SandboxImageId { get; init; } = string.Empty;
    public string? CategoryId { get; init; }
    public RepoBindDto? RepoBind { get; init; }
    public string? TemplateId { get; init; }
    public ResourceLimitsDto Resources { get; init; } = new();
    public AccessConfigDto Access { get; init; } = new();
    public ValidationConfigDto Validation { get; init; } = new();
    public Dictionary<string, string> EnvironmentVariables { get; init; } = new();
    public string WorkingDirectory { get; init; } = "/workspace";

    public static SessionConfigDto FromDomain(SessionConfig config)
    {
        return new SessionConfigDto
        {
            Mode = config.Mode.ToString().ToLowerInvariant(),
            SandboxImageId = config.SandboxImageId,
            CategoryId = config.CategoryId,
            RepoBind = config.RepoBind != null ? RepoBindDto.FromDomain(config.RepoBind) : null,
            TemplateId = config.TemplateId,
            Resources = ResourceLimitsDto.FromDomain(config.Resources),
            Access = AccessConfigDto.FromDomain(config.Access),
            Validation = ValidationConfigDto.FromDomain(config.Validation),
            EnvironmentVariables = new Dictionary<string, string>(config.EnvironmentVariables),
            WorkingDirectory = config.WorkingDirectory
        };
    }

    public SessionConfig ToDomain()
    {
        return new SessionConfig
        {
            Mode = Enum.Parse<EnvironmentMode>(Mode, ignoreCase: true),
            SandboxImageId = SandboxImageId,
            CategoryId = CategoryId,
            RepoBind = RepoBind?.ToDomain(),
            TemplateId = TemplateId,
            Resources = Resources.ToDomain(),
            Access = Access.ToDomain(),
            Validation = Validation.ToDomain(),
            EnvironmentVariables = new Dictionary<string, string>(EnvironmentVariables),
            WorkingDirectory = WorkingDirectory
        };
    }
}

/// <summary>
/// DTO for repository binding configuration.
/// </summary>
public record RepoBindDto
{
    public string HostPath { get; init; } = string.Empty;
    public string ContainerPath { get; init; } = "/workspace";
    public bool ReadOnly { get; init; }

    public static RepoBindDto FromDomain(RepoBind repoBind)
    {
        return new RepoBindDto
        {
            HostPath = repoBind.HostPath,
            ContainerPath = repoBind.ContainerPath,
            ReadOnly = repoBind.ReadOnly
        };
    }

    public RepoBind ToDomain()
    {
        return new RepoBind
        {
            HostPath = HostPath,
            ContainerPath = ContainerPath,
            ReadOnly = ReadOnly
        };
    }
}

/// <summary>
/// Request to create a new session.
/// </summary>
public record CreateSessionRequest
{
    public required string Name { get; init; }
    public string Authority { get; init; } = "human";
    public string Mode { get; init; } = "sandbox";
    public required string SandboxImageId { get; init; }
    public string? CategoryId { get; init; }
    public RepoBindDto? RepoBind { get; init; }
    public ResourceLimitsDto? Resources { get; init; }
    public AccessConfigDto? Access { get; init; }
    public ValidationConfigDto? Validation { get; init; }
    public Dictionary<string, string>? EnvironmentVariables { get; init; }
    public string? WorkingDirectory { get; init; }
}

/// <summary>
/// Request to create a session from a template.
/// </summary>
public record CreateSessionFromTemplateRequest
{
    public required string Name { get; init; }
    public string Authority { get; init; } = "human";
    public RepoBindDto? RepoBind { get; init; }
    public Dictionary<string, string>? EnvironmentVariables { get; init; }
}

/// <summary>
/// Summary DTO for session lists.
/// </summary>
public record SessionSummaryDto
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Status { get; init; } = "created";
    public string Mode { get; init; } = "sandbox";
    public string? CategoryId { get; init; }
    public string SandboxImageId { get; init; } = string.Empty;
    public string? TemplateId { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? StartedAt { get; init; }
    public DateTime? CompletedAt { get; init; }
    public long? DurationMs { get; init; }

    public static SessionSummaryDto FromDomain(Session session)
    {
        return new SessionSummaryDto
        {
            Id = session.Id.ToString(),
            Name = session.Name,
            Status = session.Status.ToString().ToLowerInvariant(),
            Mode = session.Config.Mode.ToString().ToLowerInvariant(),
            CategoryId = session.Config.CategoryId,
            SandboxImageId = session.Config.SandboxImageId,
            TemplateId = session.Config.TemplateId,
            CreatedAt = session.CreatedAt,
            StartedAt = session.StartedAt,
            CompletedAt = session.CompletedAt,
            DurationMs = session.DurationMs
        };
    }
}
