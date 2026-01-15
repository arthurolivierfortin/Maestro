namespace Maestro.Application.DTOs;

/// <summary>
/// Response DTO for health check endpoint.
/// Provides system status and service information.
/// </summary>
public record HealthResponse
{
    /// <summary>
    /// Overall health status: "healthy", "degraded", or "unhealthy".
    /// </summary>
    public string Status { get; init; }
    
    /// <summary>
    /// API version from assembly.
    /// </summary>
    public string Version { get; init; }
    
    /// <summary>
    /// API uptime duration.
    /// </summary>
    public TimeSpan Uptime { get; init; }
    
    /// <summary>
    /// Total number of discovered blocks.
    /// </summary>
    public int BlockCount { get; init; }
    
    /// <summary>
    /// Status of individual services.
    /// </summary>
    public Dictionary<string, string> Services { get; init; } = new();
}
