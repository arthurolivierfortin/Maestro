using Maestro.Domain.Entities;
using Maestro.Domain.Enums;

namespace Maestro.Application.DTOs;

/// <summary>
/// Data Transfer Object for SandboxImage.
/// </summary>
public record SandboxImageDto
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string DockerImage { get; init; } = string.Empty;
    public string Source { get; init; } = "user-defined";
    public List<string> Tags { get; init; } = new();
    public List<string> Tools { get; init; } = new();
    public string WorkingDirectory { get; init; } = "/workspace";
    public string DefaultShell { get; init; } = "/bin/sh";
    public Dictionary<string, string> DefaultEnvironment { get; init; } = new();
    public bool Verified { get; init; }
    public DateTime? LastVerifiedAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }

    public static SandboxImageDto FromDomain(SandboxImage image)
    {
        return new SandboxImageDto
        {
            Id = image.Id,
            Name = image.Name,
            Description = image.Description,
            DockerImage = image.DockerImage,
            Source = image.Source.ToString().ToLowerInvariant().Replace("userdefined", "user-defined").Replace("builtin", "built-in"),
            Tags = image.Tags.ToList(),
            Tools = image.Tools.ToList(),
            WorkingDirectory = image.WorkingDirectory,
            DefaultShell = image.DefaultShell,
            DefaultEnvironment = new Dictionary<string, string>(image.DefaultEnvironment),
            Verified = image.Verified,
            LastVerifiedAt = image.LastVerifiedAt,
            CreatedAt = image.CreatedAt,
            UpdatedAt = image.UpdatedAt
        };
    }
}

/// <summary>
/// Request to register a new sandbox image.
/// </summary>
public record RegisterSandboxImageRequest
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string DockerImage { get; init; }
    public string? Description { get; init; }
    public List<string>? Tags { get; init; }
    public List<string>? Tools { get; init; }
    public string? WorkingDirectory { get; init; }
    public string? DefaultShell { get; init; }
    public Dictionary<string, string>? DefaultEnvironment { get; init; }

    public SandboxImage ToDomain()
    {
        var image = SandboxImage.Create(Id, Name, DockerImage);
        if (Description != null) image.Description = Description;
        if (Tags != null) image.Tags = Tags;
        if (Tools != null) image.Tools = Tools;
        if (WorkingDirectory != null) image.WorkingDirectory = WorkingDirectory;
        if (DefaultShell != null) image.DefaultShell = DefaultShell;
        if (DefaultEnvironment != null) image.DefaultEnvironment = DefaultEnvironment;
        return image;
    }
}

/// <summary>
/// Request to update a sandbox image.
/// </summary>
public record UpdateSandboxImageRequest
{
    public string? Name { get; init; }
    public string? Description { get; init; }
    public string? DockerImage { get; init; }
    public List<string>? Tags { get; init; }
    public List<string>? Tools { get; init; }
    public string? WorkingDirectory { get; init; }
    public string? DefaultShell { get; init; }
    public Dictionary<string, string>? DefaultEnvironment { get; init; }
}

/// <summary>
/// Response for sandbox image verification.
/// </summary>
public record SandboxImageVerificationResult
{
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
    public string? ImageId { get; init; }
    public string? ImageDigest { get; init; }
    public DateTime VerifiedAt { get; init; }
}
