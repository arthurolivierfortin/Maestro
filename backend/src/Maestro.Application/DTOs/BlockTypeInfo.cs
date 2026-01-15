namespace Maestro.Application.DTOs;

/// <summary>
/// Metadata for a block type.
/// Used in capabilities and block type discovery endpoints.
/// </summary>
public record BlockTypeInfo
{
    /// <summary>
    /// Block type identifier.
    /// </summary>
    public string Type { get; init; }
    
    /// <summary>
    /// Human-readable display name.
    /// </summary>
    public string DisplayName { get; init; }
    
    /// <summary>
    /// Description of the block type.
    /// </summary>
    public string Description { get; init; }
    
    /// <summary>
    /// Icon emoji or icon identifier.
    /// </summary>
    public string Icon { get; init; }
    
    /// <summary>
    /// Color hex code or color name.
    /// </summary>
    public string Color { get; init; }
    
    /// <summary>
    /// Category for UI grouping.
    /// </summary>
    public string Category { get; init; }
    
    /// <summary>
    /// Block types this type can contain.
    /// </summary>
    public List<string> CanContain { get; init; } = new();
    
    /// <summary>
    /// Fields required for this block type.
    /// </summary>
    public List<string> RequiredFields { get; init; } = new();
    
    /// <summary>
    /// Default configuration as JSON.
    /// </summary>
    public object DefaultConfig { get; init; }
}
