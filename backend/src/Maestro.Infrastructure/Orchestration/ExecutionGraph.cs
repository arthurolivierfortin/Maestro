using System.Collections.Generic;
using System.Linq;
using Maestro.Application.Interfaces;

namespace Maestro.Infrastructure.Orchestration
{
    public class ExecutionGraph : IExecutionGraph
    {
        public IReadOnlyList<ExecutionNode> Nodes { get; }
        public IReadOnlyList<ExecutionEdge> Edges { get; }

        public ExecutionGraph(IEnumerable<Maestro.Domain.Entities.BlockDefinition> blocks, IEnumerable<Maestro.Domain.Entities.ConnectionDefinition> connections)
        {
            Nodes = blocks.Select(b => new ExecutionNode(b.Id, b.Id)).ToList();
            Edges = connections.Select(c => new ExecutionEdge(c.FromBlockId, c.ToBlockId, c.FromPort, c.ToPort)).ToList();
        }

        public IReadOnlyList<ExecutionNode> GetRoots()
            => Nodes.Where(n => !Edges.Any(e => e.ToNodeId == n.Id)).ToList();

        public IReadOnlyList<ExecutionNode> GetDependents(string nodeId)
            => Nodes.Where(n => Edges.Any(e => e.FromNodeId == nodeId && e.ToNodeId == n.Id)).ToList();

        public bool HasCycle()
        {
            var visited = new HashSet<string>();
            var recStack = new HashSet<string>();

            bool Dfs(string id)
            {
                if (recStack.Contains(id)) return true;
                if (visited.Contains(id)) return false;
                visited.Add(id);
                recStack.Add(id);
                foreach (var e in Edges.Where(e => e.FromNodeId == id))
                {
                    if (Dfs(e.ToNodeId)) return true;
                }
                recStack.Remove(id);
                return false;
            }

            foreach (var n in Nodes) if (Dfs(n.Id)) return true;
            return false;
        }

        public IEnumerable<IReadOnlyList<ExecutionNode>> GetExecutionLayers()
        {
            var inDegree = Nodes.ToDictionary(n => n.Id, n => 0);
            foreach (var e in Edges) inDegree[e.ToNodeId]++;

            var layers = new List<List<ExecutionNode>>();
            var queue = new Queue<ExecutionNode>(Nodes.Where(n => inDegree[n.Id] == 0));

            while (queue.Any())
            {
                var layer = new List<ExecutionNode>();
                int count = queue.Count;
                for (int i = 0; i < count; i++)
                {
                    var n = queue.Dequeue();
                    layer.Add(n);
                    foreach (var e in Edges.Where(e => e.FromNodeId == n.Id))
                    {
                        inDegree[e.ToNodeId]--;
                        if (inDegree[e.ToNodeId] == 0)
                            queue.Enqueue(Nodes.First(x => x.Id == e.ToNodeId));
                    }
                }
                layers.Add(layer);
            }

            return layers;
        }
    }
}
