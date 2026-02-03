using Maestro.Domain.Entities;
using Maestro.Domain.Enums;

namespace Maestro.Application.DTOs;

/// <summary>
/// DTO for session category.
/// </summary>
public class SessionCategoryDto
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public string Source { get; set; } = "UserDefined";
    public bool IsSystem { get; set; }
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public static SessionCategoryDto FromDomain(SessionCategory category)
    {
        return new SessionCategoryDto
        {
            Id = category.Id,
            Name = category.Name,
            Description = category.Description,
            Icon = category.Icon,
            Color = category.Color,
            Source = category.Source.ToString(),
            IsSystem = category.IsSystem,
            DisplayOrder = category.DisplayOrder,
            CreatedAt = category.CreatedAt,
            UpdatedAt = category.UpdatedAt
        };
    }
}

/// <summary>
/// Request to create a new session category.
/// </summary>
public class CreateSessionCategoryRequest
{
    /// <summary>
    /// Unique identifier for the category (will be normalized to lowercase slug).
    /// </summary>
    public required string Id { get; set; }

    /// <summary>
    /// Display name for the category.
    /// </summary>
    public required string Name { get; set; }

    /// <summary>
    /// Optional description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Optional icon name.
    /// </summary>
    public string? Icon { get; set; }

    /// <summary>
    /// Optional color (hex or name).
    /// </summary>
    public string? Color { get; set; }

    /// <summary>
    /// Display order for sorting.
    /// </summary>
    public int DisplayOrder { get; set; } = 100;

    public SessionCategory ToDomain()
    {
        return SessionCategory.Create(
            id: Id,
            name: Name,
            description: Description,
            icon: Icon,
            color: Color,
            displayOrder: DisplayOrder
        );
    }
}

/// <summary>
/// Request to update a session category.
/// </summary>
public class UpdateSessionCategoryRequest
{
    /// <summary>
    /// Display name for the category.
    /// </summary>
    public string? Name { get; set; }

    /// <summary>
    /// Optional description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Optional icon name.
    /// </summary>
    public string? Icon { get; set; }

    /// <summary>
    /// Optional color (hex or name).
    /// </summary>
    public string? Color { get; set; }

    /// <summary>
    /// Display order for sorting.
    /// </summary>
    public int? DisplayOrder { get; set; }

    public void ApplyTo(SessionCategory category)
    {
        if (Name != null) category.Name = Name;
        if (Description != null) category.Description = Description;
        if (Icon != null) category.Icon = Icon;
        if (Color != null) category.Color = Color;
        if (DisplayOrder.HasValue) category.DisplayOrder = DisplayOrder.Value;
    }
}
