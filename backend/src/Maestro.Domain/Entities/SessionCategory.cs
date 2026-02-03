using Maestro.Domain.Enums;

namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a user-defined or built-in session category.
/// Categories allow users to organize sessions by purpose (e.g., "Testing", "Development", "Training").
/// </summary>
public class SessionCategory
{
    /// <summary>
    /// Unique identifier for the category (slug format, e.g., "testing", "development").
    /// </summary>
    public required string Id { get; set; }

    /// <summary>
    /// Display name for the category.
    /// </summary>
    public required string Name { get; set; }

    /// <summary>
    /// Optional description of what this category is for.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Optional icon name for UI display (e.g., "folder", "code", "flask").
    /// </summary>
    public string? Icon { get; set; }

    /// <summary>
    /// Optional color for UI display (e.g., "#3B82F6", "blue").
    /// </summary>
    public string? Color { get; set; }

    /// <summary>
    /// Whether this is a built-in category or user-defined.
    /// </summary>
    public ImageSource Source { get; set; } = ImageSource.UserDefined;

    /// <summary>
    /// Whether this is the system category (non-deletable, used for system workflows).
    /// </summary>
    public bool IsSystem { get; set; }

    /// <summary>
    /// Display order for sorting categories in the UI.
    /// </summary>
    public int DisplayOrder { get; set; }

    /// <summary>
    /// When the category was created.
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// When the category was last updated.
    /// </summary>
    public DateTime? UpdatedAt { get; set; }

    /// <summary>
    /// Creates a new session category.
    /// </summary>
    public static SessionCategory Create(
        string id,
        string name,
        string? description = null,
        string? icon = null,
        string? color = null,
        int displayOrder = 0)
    {
        return new SessionCategory
        {
            Id = id.ToLowerInvariant().Replace(" ", "-"),
            Name = name,
            Description = description,
            Icon = icon,
            Color = color,
            Source = ImageSource.UserDefined,
            IsSystem = false,
            DisplayOrder = displayOrder,
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Creates a built-in category.
    /// </summary>
    public static SessionCategory CreateBuiltIn(
        string id,
        string name,
        string? description = null,
        string? icon = null,
        string? color = null,
        bool isSystem = false,
        int displayOrder = 0)
    {
        return new SessionCategory
        {
            Id = id,
            Name = name,
            Description = description,
            Icon = icon,
            Color = color,
            Source = ImageSource.BuiltIn,
            IsSystem = isSystem,
            DisplayOrder = displayOrder,
            CreatedAt = DateTime.UtcNow
        };
    }
}
