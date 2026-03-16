namespace Maestro.Application.DTOs;

/// <summary>
/// Request DTO for POST /api/playground — send a prompt to a model.
/// </summary>
public class PlaygroundRequestDto
{
    public string ModelId { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public string? SystemPrompt { get; set; }
    public int? MaxTokens { get; set; }
    public float? Temperature { get; set; }
}

/// <summary>
/// Response DTO for POST /api/playground — model response + metrics.
/// </summary>
public class PlaygroundResponseDto
{
    public string Content { get; set; } = string.Empty;
    public string ModelId { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public int TotalTokens { get; set; }
    public decimal CostUsd { get; set; }
    public long LatencyMs { get; set; }
}

/// <summary>
/// Definition of a capability test returned by GET /api/playground/tests.
/// </summary>
public class CapabilityTestDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
}

/// <summary>
/// Result of running a capability test via POST /api/playground/test.
/// </summary>
public class CapabilityTestResultDto
{
    public string TestId { get; set; } = string.Empty;
    public string TestName { get; set; } = string.Empty;
    public bool Passed { get; set; }
    public string Content { get; set; } = string.Empty;
    public string ValidationDetails { get; set; } = string.Empty;
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public decimal CostUsd { get; set; }
    public long LatencyMs { get; set; }
}

/// <summary>
/// Request DTO for POST /api/playground/test — run a capability test.
/// </summary>
public class CapabilityTestRequestDto
{
    public string ModelId { get; set; } = string.Empty;
    public string TestId { get; set; } = string.Empty;
}
