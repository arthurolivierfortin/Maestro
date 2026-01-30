using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Configuration;

/// <summary>
/// Configuration for a project session execution.
/// </summary>
public class ProjectSessionConfig
{
    /// <summary>
    /// The project ID where the session runs.
    /// </summary>
    public required string ProjectId { get; set; }

    /// <summary>
    /// The workflow ID to execute (optional for interactive sessions).
    /// Can include version: "workflow-id@1.0.0"
    /// </summary>
    public string? WorkflowId { get; set; }

    /// <summary>
    /// The task description (optional for interactive sessions).
    /// </summary>
    public string? Task { get; set; }

    /// <summary>
    /// Additional context for the task.
    /// </summary>
    public string? Context { get; set; }

    /// <summary>
    /// Access control configuration.
    /// </summary>
    public AccessConfig Access { get; set; } = AccessConfig.Default;

    /// <summary>
    /// Validation configuration.
    /// </summary>
    public ValidationConfig Validation { get; set; } = ValidationConfig.Default;

    /// <summary>
    /// Additional inputs to pass to the workflow.
    /// </summary>
    public IDictionary<string, object> Inputs { get; set; } = new Dictionary<string, object>();
}
