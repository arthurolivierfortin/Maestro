using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a single unit of execution within a workflow.
/// </summary>
public class Node
{
    public required NodeId Id { get; init; }
    public required string Name { get; init; }
    public required NodeType Type { get; init; }

    private Node() { }

    public static Node Create(NodeId id, string name, NodeType type)
    {
        ArgumentNullException.ThrowIfNull(id);
        ArgumentException.ThrowIfNullOrWhiteSpace(name);

        return new Node
        {
            Id = id,
            Name = name,
            Type = type
        };
    }
}

/// <summary>
/// Node type enumeration.
/// </summary>
public enum NodeType
{
    Agent,
    Tool,
    Decision,
    Validator,
    Trigger
}
