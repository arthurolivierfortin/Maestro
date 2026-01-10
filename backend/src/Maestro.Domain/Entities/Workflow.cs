using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a workflow - a directed acyclic graph (DAG) of nodes.
/// Pure domain entity with no external dependencies.
/// </summary>
public class Workflow
{
    private readonly List<Node> _nodes = new();

    public required WorkflowId Id { get; init; }
    public required string Name { get; init; }
    public string? Description { get; init; }
    public IReadOnlyCollection<Node> Nodes => _nodes.AsReadOnly();

    private Workflow() { }

    public static Workflow Create(WorkflowId id, string name, string? description = null)
    {
        ArgumentNullException.ThrowIfNull(id);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        return new Workflow
        {
            Id = id,
            Name = name,
            Description = description
        };
    }

    public void AddNode(Node node)
    {
        ArgumentNullException.ThrowIfNull(node);
        _nodes.Add(node);
    }
}
