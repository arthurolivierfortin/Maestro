using Maestro.Domain.Configuration;
using Maestro.Domain.Enums;

namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a reusable template for creating sessions.
/// Templates provide presets for common session patterns.
/// </summary>
public class SessionTemplate
{
    /// <summary>
    /// Unique identifier for this template.
    /// </summary>
    public required string Id { get; init; }

    /// <summary>
    /// Display name for the template.
    /// </summary>
    public required string Name { get; set; }

    /// <summary>
    /// Description of the template's purpose and use case.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Source of the template (BuiltIn or UserDefined).
    /// </summary>
    public TemplateSource Source { get; init; } = TemplateSource.UserDefined;

    /// <summary>
    /// The environment mode for sessions created from this template.
    /// </summary>
    public EnvironmentMode Mode { get; set; } = EnvironmentMode.Sandbox;

    /// <summary>
    /// The default sandbox image to use.
    /// </summary>
    public required string SandboxImageId { get; set; }

    /// <summary>
    /// The category ID for sessions created from this template.
    /// References a SessionCategory (built-in or user-defined).
    /// </summary>
    public string? CategoryId { get; set; }

    /// <summary>
    /// Tags for categorization and filtering.
    /// </summary>
    public IList<string> Tags { get; set; } = new List<string>();

    /// <summary>
    /// Default resource limits for sessions.
    /// </summary>
    public ResourceLimitsConfig? ResourceLimits { get; set; }

    /// <summary>
    /// Default access configuration for sessions.
    /// </summary>
    public AccessConfigOverride? AccessConfig { get; set; }

    /// <summary>
    /// Default environment variables for sessions.
    /// </summary>
    public IDictionary<string, string> DefaultEnvironment { get; set; } = new Dictionary<string, string>();

    /// <summary>
    /// Working directory inside the container.
    /// </summary>
    public string WorkingDirectory { get; set; } = "/workspace";

    /// <summary>
    /// Icon or emoji for UI display.
    /// </summary>
    public string? Icon { get; set; }

    /// <summary>
    /// Sort order for display in UI.
    /// </summary>
    public int SortOrder { get; set; } = 100;

    /// <summary>
    /// When this template was created.
    /// </summary>
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    /// <summary>
    /// When this template was last updated.
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Creates a new user-defined session template.
    /// </summary>
    public static SessionTemplate Create(
        string id,
        string name,
        string sandboxImageId,
        EnvironmentMode mode = EnvironmentMode.Sandbox,
        string? categoryId = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(id);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(sandboxImageId);

        return new SessionTemplate
        {
            Id = id,
            Name = name,
            SandboxImageId = sandboxImageId,
            Mode = mode,
            CategoryId = categoryId,
            Source = TemplateSource.UserDefined
        };
    }

    /// <summary>
    /// Creates a built-in session template.
    /// </summary>
    public static SessionTemplate CreateBuiltIn(
        string id,
        string name,
        string sandboxImageId,
        string description,
        EnvironmentMode mode,
        string? categoryId = null,
        string? icon = null,
        int sortOrder = 100,
        IEnumerable<string>? tags = null)
    {
        return new SessionTemplate
        {
            Id = id,
            Name = name,
            SandboxImageId = sandboxImageId,
            Description = description,
            Mode = mode,
            CategoryId = categoryId,
            Source = TemplateSource.BuiltIn,
            Icon = icon,
            SortOrder = sortOrder,
            Tags = tags?.ToList() ?? new List<string>()
        };
    }

    /// <summary>
    /// Creates a SessionConfig from this template.
    /// </summary>
    public SessionConfig ToSessionConfig(RepoBind? repoBind = null)
    {
        // Validate mode/repoBind consistency
        if (Mode == EnvironmentMode.Repo && repoBind == null)
        {
            throw new InvalidOperationException("Repo mode templates require a RepoBind configuration.");
        }

        if (Mode == EnvironmentMode.Sandbox && repoBind != null)
        {
            throw new InvalidOperationException("Sandbox mode templates cannot have a RepoBind configuration.");
        }

        return new SessionConfig
        {
            Mode = Mode,
            SandboxImageId = SandboxImageId,
            CategoryId = CategoryId,
            RepoBind = repoBind,
            TemplateId = Id,
            WorkingDirectory = WorkingDirectory,
            EnvironmentVariables = new Dictionary<string, string>(DefaultEnvironment)
        };
    }
}

/// <summary>
/// Optional resource limits configuration for templates.
/// </summary>
public class ResourceLimitsConfig
{
    public string? CpuLimit { get; set; }
    public string? MemoryLimit { get; set; }
    public int? TimeoutSeconds { get; set; }
}

/// <summary>
/// Optional access configuration override for templates.
/// </summary>
public class AccessConfigOverride
{
    public AccessLevel? Level { get; set; }
    public IList<string>? DeniedPaths { get; set; }
    public IList<string>? DeniedCommands { get; set; }
}
