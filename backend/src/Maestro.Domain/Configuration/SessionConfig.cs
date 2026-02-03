using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Configuration;

/// <summary>
/// Composable configuration for a unified session.
/// Combines environment mode, sandbox image, category, and optional repository binding.
/// </summary>
public class SessionConfig
{
    /// <summary>
    /// The environment mode for this session (Sandbox or Repo).
    /// </summary>
    public EnvironmentMode Mode { get; set; } = EnvironmentMode.Sandbox;

    /// <summary>
    /// The ID of the sandbox image to use for the container.
    /// References a registered SandboxImage.
    /// </summary>
    public required string SandboxImageId { get; set; }

    /// <summary>
    /// The ID of the category for this session.
    /// References a SessionCategory (built-in or user-defined).
    /// Null means uncategorized.
    /// </summary>
    public string? CategoryId { get; set; }

    /// <summary>
    /// Repository binding configuration.
    /// Required when Mode is Repo, must be null when Mode is Sandbox.
    /// </summary>
    public RepoBind? RepoBind { get; set; }

    /// <summary>
    /// The ID of the template used to create this session (if any).
    /// </summary>
    public string? TemplateId { get; set; }

    /// <summary>
    /// Resource limits for the container.
    /// </summary>
    public ResourceLimits Resources { get; set; } = ResourceLimits.Default;

    /// <summary>
    /// Access control configuration.
    /// </summary>
    public AccessConfig Access { get; set; } = AccessConfig.Default;

    /// <summary>
    /// Validation configuration.
    /// </summary>
    public ValidationConfig Validation { get; set; } = ValidationConfig.Default;

    /// <summary>
    /// Custom environment variables to set in the container.
    /// </summary>
    public IDictionary<string, string> EnvironmentVariables { get; set; } = new Dictionary<string, string>();

    /// <summary>
    /// Working directory inside the container.
    /// </summary>
    public string WorkingDirectory { get; set; } = "/workspace";

    /// <summary>
    /// Validates the configuration for consistency.
    /// </summary>
    /// <returns>A list of validation errors, empty if valid.</returns>
    public IList<string> Validate()
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(SandboxImageId))
        {
            errors.Add("SandboxImageId is required.");
        }

        if (Mode == EnvironmentMode.Sandbox && RepoBind != null)
        {
            errors.Add("Sandbox mode cannot have a RepoBind configuration.");
        }

        if (Mode == EnvironmentMode.Repo && RepoBind == null)
        {
            errors.Add("Repo mode requires a RepoBind configuration.");
        }

        if (RepoBind != null && string.IsNullOrWhiteSpace(RepoBind.HostPath))
        {
            errors.Add("RepoBind.HostPath is required when RepoBind is specified.");
        }

        return errors;
    }

    /// <summary>
    /// Creates a default sandbox session configuration.
    /// </summary>
    /// <param name="sandboxImageId">The sandbox image to use.</param>
    /// <param name="categoryId">Optional category ID.</param>
    /// <returns>A new SessionConfig for sandbox mode.</returns>
    public static SessionConfig CreateSandbox(string sandboxImageId, string? categoryId = null) => new()
    {
        Mode = EnvironmentMode.Sandbox,
        SandboxImageId = sandboxImageId,
        CategoryId = categoryId
    };

    /// <summary>
    /// Creates a repo session configuration.
    /// </summary>
    /// <param name="sandboxImageId">The sandbox image to use.</param>
    /// <param name="hostPath">The path to the repository on the host.</param>
    /// <param name="categoryId">Optional category ID (defaults to "projects").</param>
    /// <returns>A new SessionConfig for repo mode.</returns>
    public static SessionConfig CreateRepo(string sandboxImageId, string hostPath, string? categoryId = "projects") => new()
    {
        Mode = EnvironmentMode.Repo,
        SandboxImageId = sandboxImageId,
        CategoryId = categoryId,
        RepoBind = RepoBind.Create(hostPath)
    };

    /// <summary>
    /// Creates a foundry session configuration.
    /// </summary>
    /// <param name="sandboxImageId">The sandbox image to use.</param>
    /// <returns>A new SessionConfig for foundry use.</returns>
    public static SessionConfig CreateFoundry(string sandboxImageId) => new()
    {
        Mode = EnvironmentMode.Sandbox,
        SandboxImageId = sandboxImageId,
        CategoryId = "foundry"
    };

    /// <summary>
    /// Creates a training session configuration.
    /// </summary>
    /// <param name="sandboxImageId">The sandbox image to use.</param>
    /// <returns>A new SessionConfig for training.</returns>
    public static SessionConfig CreateTraining(string sandboxImageId) => new()
    {
        Mode = EnvironmentMode.Sandbox,
        SandboxImageId = sandboxImageId,
        CategoryId = "training"
    };
}
