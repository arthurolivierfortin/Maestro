namespace Maestro.Domain.Workflow;

public class WorkflowDefinition
{
    public string Id { get; set; } = string.Empty;
    public object? Nodes { get; set; }
    public object? Connections { get; set; }
}
