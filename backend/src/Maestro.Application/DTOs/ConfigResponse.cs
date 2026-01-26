namespace Maestro.Application.DTOs;

/// <summary>
/// Response DTO for configuration endpoint.
/// Provides system configuration information.
/// </summary>
public record ConfigResponse
{
    /// <summary>
    /// Block search paths in order of precedence.
    /// </summary>
    public List<string> BlockSearchPaths { get; init; } = new();
    
    /// <summary>
    /// Default LLM provider name.
    /// </summary>
    public required string DefaultLLMProvider { get; init; }
    
    /// <summary>
    /// Execution timeout duration.
    /// </summary>
    public TimeSpan ExecutionTimeout { get; init; }
    
    /// <summary>
    /// Maximum concurrent workflow executions.
    /// </summary>
    public int MaxConcurrentExecutions { get; init; }
    
    /// <summary>
    /// Whether SignalR real-time updates are enabled.
    /// </summary>
    public bool SignalREnabled { get; init; }
}
