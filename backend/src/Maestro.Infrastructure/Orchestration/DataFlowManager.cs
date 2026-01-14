using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using Maestro.Application.Interfaces;

namespace Maestro.Infrastructure.Orchestration
{
    public class DataFlowManager : IDataFlowManager
    {
        private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, object>> _outputs = new();

        public void SetOutput(string blockId, string portId, object value)
        {
            var ports = _outputs.GetOrAdd(blockId, _ => new ConcurrentDictionary<string, object>());
            ports[portId ?? "default"] = value;
        }

        public object? GetInput(string blockId, string portId, IExecutionGraph graph)
        {
            // find incoming edges to this block and return first matching value
            var edge = graph.Edges.FirstOrDefault(e => e.ToNodeId == blockId && (portId == null || e.ToPort == portId));
            if (edge == null) return null;
            if (_outputs.TryGetValue(edge.FromNodeId, out var ports) && ports.TryGetValue(edge.FromPort ?? "default", out var val))
                return val;
            return null;
        }

        public Dictionary<string, object> CollectInputs(string blockId, IExecutionGraph graph)
        {
            var inputs = new Dictionary<string, object>();
            var incoming = graph.Edges.Where(e => e.ToNodeId == blockId);
            foreach (var e in incoming)
            {
                if (_outputs.TryGetValue(e.FromNodeId, out var ports) && ports.TryGetValue(e.FromPort ?? "default", out var val))
                    inputs[e.ToPort ?? "default"] = val;
            }
            return inputs;
        }

        public bool AreInputsSatisfied(string blockId, IExecutionGraph graph)
        {
            var incoming = graph.Edges.Where(e => e.ToNodeId == blockId).ToList();
            if (!incoming.Any()) return true;
            foreach (var e in incoming)
            {
                if (!_outputs.TryGetValue(e.FromNodeId, out var ports)) return false;
                if (!ports.ContainsKey(e.FromPort ?? "default")) return false;
            }
            return true;
        }
    }
}
