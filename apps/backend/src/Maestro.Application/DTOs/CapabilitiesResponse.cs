namespace Maestro.Application.DTOs;

/// <summary>
/// Response DTO for capabilities endpoint.
/// Describes available block types, executors, and features.
/// </summary>
public record CapabilitiesResponse
{
    /// <summary>
    /// Available block types with metadata.
    /// </summary>
    public List<BlockTypeInfo> BlockTypes { get; init; } = new();
    
    /// <summary>
    /// Available executor types.
    /// </summary>
    public List<string> Executors { get; init; } = new();
    
    /// <summary>
    /// Available LLM providers.
    /// </summary>
    public List<string> LLMProviders { get; init; } = new();
    
    /// <summary>
    /// Supported features.
    /// </summary>
    public List<string> Features { get; init; } = new();
}
