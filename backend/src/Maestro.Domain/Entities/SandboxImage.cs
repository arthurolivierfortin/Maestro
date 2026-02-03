using Maestro.Domain.Enums;

namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a Docker image that can be used for sandbox sessions.
/// Users register external Docker images to use with Maestro sessions.
/// </summary>
public class SandboxImage
{
    /// <summary>
    /// Unique identifier for this sandbox image.
    /// </summary>
    public required string Id { get; init; }

    /// <summary>
    /// Display name for the image.
    /// </summary>
    public required string Name { get; set; }

    /// <summary>
    /// Description of what this image contains and its purpose.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// The full Docker image reference (e.g., "maestro/sandbox-git:latest").
    /// </summary>
    public required string DockerImage { get; set; }

    /// <summary>
    /// Source of the image (BuiltIn or UserDefined).
    /// </summary>
    public ImageSource Source { get; init; } = ImageSource.UserDefined;

    /// <summary>
    /// Tags for categorization and filtering.
    /// </summary>
    public IList<string> Tags { get; set; } = new List<string>();

    /// <summary>
    /// Tools/binaries available in this image.
    /// </summary>
    public IList<string> Tools { get; set; } = new List<string>();

    /// <summary>
    /// Default working directory inside the container.
    /// </summary>
    public string WorkingDirectory { get; set; } = "/workspace";

    /// <summary>
    /// Default shell to use for command execution.
    /// </summary>
    public string DefaultShell { get; set; } = "/bin/sh";

    /// <summary>
    /// Environment variables to set by default.
    /// </summary>
    public IDictionary<string, string> DefaultEnvironment { get; set; } = new Dictionary<string, string>();

    /// <summary>
    /// Whether this image has been verified (exists and is pullable).
    /// </summary>
    public bool Verified { get; set; } = false;

    /// <summary>
    /// When the image was last verified.
    /// </summary>
    public DateTime? LastVerifiedAt { get; set; }

    /// <summary>
    /// When this image was registered.
    /// </summary>
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    /// <summary>
    /// When this image was last updated.
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Creates a new user-defined sandbox image.
    /// </summary>
    public static SandboxImage Create(string id, string name, string dockerImage)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(id);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(dockerImage);

        return new SandboxImage
        {
            Id = id,
            Name = name,
            DockerImage = dockerImage,
            Source = ImageSource.UserDefined
        };
    }

    /// <summary>
    /// Creates a built-in sandbox image.
    /// </summary>
    public static SandboxImage CreateBuiltIn(
        string id,
        string name,
        string dockerImage,
        string description,
        IEnumerable<string> tools,
        IEnumerable<string>? tags = null)
    {
        return new SandboxImage
        {
            Id = id,
            Name = name,
            DockerImage = dockerImage,
            Description = description,
            Source = ImageSource.BuiltIn,
            Tools = tools.ToList(),
            Tags = tags?.ToList() ?? new List<string>(),
            Verified = true,
            LastVerifiedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Marks the image as verified.
    /// </summary>
    public void MarkVerified()
    {
        Verified = true;
        LastVerifiedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Marks the image as unverified (e.g., after an update).
    /// </summary>
    public void MarkUnverified()
    {
        Verified = false;
        UpdatedAt = DateTime.UtcNow;
    }
}
