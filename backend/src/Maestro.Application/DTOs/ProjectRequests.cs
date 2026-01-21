using System.ComponentModel.DataAnnotations;

namespace Maestro.Application.DTOs;

/// <summary>
/// Request to create a new project.
/// </summary>
public record CreateProjectRequest
{
    /// <summary>
    /// The display name of the project.
    /// </summary>
    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string Name { get; init; } = string.Empty;

    /// <summary>
    /// The root path where the project will be created.
    /// </summary>
    [Required]
    public string RootPath { get; init; } = string.Empty;

    /// <summary>
    /// Optional description of the project.
    /// </summary>
    [StringLength(500)]
    public string? Description { get; init; }

    /// <summary>
    /// Runtime configuration for the project.
    /// </summary>
    public RuntimeConfigDto? Runtime { get; init; }
}

/// <summary>
/// Request to update an existing project.
/// </summary>
public record UpdateProjectRequest
{
    /// <summary>
    /// The display name of the project.
    /// </summary>
    [StringLength(100, MinimumLength = 1)]
    public string? Name { get; init; }

    /// <summary>
    /// Optional description of the project.
    /// </summary>
    [StringLength(500)]
    public string? Description { get; init; }

    /// <summary>
    /// Runtime configuration for the project.
    /// </summary>
    public RuntimeConfigDto? Runtime { get; init; }

    /// <summary>
    /// Default model for LLM operations.
    /// </summary>
    public string? DefaultModel { get; init; }
}

/// <summary>
/// Request to open an existing project by path.
/// </summary>
public record OpenProjectRequest
{
    /// <summary>
    /// The root path of the existing project to open.
    /// </summary>
    [Required]
    public string RootPath { get; init; } = string.Empty;
}
