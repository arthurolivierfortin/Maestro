using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a project - an isolated execution unit containing blocks, workflows, and configurations.
/// Pure domain entity with no external dependencies.
/// </summary>
public class Project
{
    public required ProjectId Id { get; init; }

    /// <summary>
    /// The display name of the project.
    /// </summary>
    public required string Name { get; set; }

    /// <summary>
    /// Optional description of the project.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// The absolute path to the project root directory.
    /// </summary>
    public required string RootPath { get; init; }

    /// <summary>
    /// Container runtime configuration for this project.
    /// </summary>
    public RuntimeConfiguration Runtime { get; set; } = RuntimeConfiguration.Default;

    /// <summary>
    /// Additional search paths for blocks relative to project root.
    /// </summary>
    public IReadOnlyList<string> BlockSearchPaths { get; set; } = Array.Empty<string>();

    /// <summary>
    /// Default model to use for LLM operations.
    /// </summary>
    public string? DefaultModel { get; set; }

    /// <summary>
    /// Model overrides per block type or ID.
    /// </summary>
    public IReadOnlyDictionary<string, string> ModelOverrides { get; set; } =
        new Dictionary<string, string>();

    /// <summary>
    /// File access rules controlling visibility and permissions.
    /// </summary>
    public IReadOnlyList<FileAccessRule> FileAccessRules { get; set; } = Array.Empty<FileAccessRule>();

    /// <summary>
    /// Block permission rules controlling which blocks are available.
    /// </summary>
    public IReadOnlyList<BlockPermission> BlockPermissions { get; set; } = Array.Empty<BlockPermission>();

    /// <summary>
    /// The version of the project configuration.
    /// </summary>
    public string Version { get; set; } = "1.0.0";

    /// <summary>
    /// When the project was created.
    /// </summary>
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    /// <summary>
    /// When the project was last updated.
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    private Project() { }

    /// <summary>
    /// Creates a new project with the specified parameters.
    /// </summary>
    public static Project Create(ProjectId id, string name, string rootPath, string? description = null)
    {
        ArgumentNullException.ThrowIfNull(id);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(rootPath);

        return new Project
        {
            Id = id,
            Name = name,
            RootPath = rootPath,
            Description = description
        };
    }

    /// <summary>
    /// Gets the path to the .maestro folder for this project.
    /// </summary>
    public string GetMaestroFolderPath() => Path.Combine(RootPath, ".maestro");

    /// <summary>
    /// Gets the path to the project.json configuration file.
    /// </summary>
    public string GetConfigFilePath() => Path.Combine(GetMaestroFolderPath(), "project.json");

    /// <summary>
    /// Gets the path to the project's blocks folder.
    /// </summary>
    public string GetBlocksFolderPath() => Path.Combine(GetMaestroFolderPath(), "blocks");

    /// <summary>
    /// Updates the project timestamp.
    /// </summary>
    public void MarkUpdated()
    {
        UpdatedAt = DateTime.UtcNow;
    }
}
