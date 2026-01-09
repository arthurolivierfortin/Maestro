namespace Maestro.Application.DTOs;

/// <summary>
/// Data Transfer Object for Workflow.
/// </summary>
public class WorkflowDto
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public string? Description { get; init; }
}
