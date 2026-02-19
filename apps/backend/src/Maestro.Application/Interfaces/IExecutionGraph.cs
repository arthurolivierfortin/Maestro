using System.Collections.Generic;

namespace Maestro.Application.Interfaces
{
    public interface IExecutionGraph
    {
        IReadOnlyList<ExecutionNode> Nodes { get; }
        IReadOnlyList<ExecutionEdge> Edges { get; }
        IReadOnlyList<ExecutionNode> GetRoots();
        IReadOnlyList<ExecutionNode> GetDependents(string nodeId);
        bool HasCycle();
        IEnumerable<IReadOnlyList<ExecutionNode>> GetExecutionLayers();
    }

    public record ExecutionNode(string Id, string BlockId);
    public record ExecutionEdge(string FromNodeId, string ToNodeId, string FromPort = null, string ToPort = null);
}
