using System.Collections.Generic;
using Maestro.Application.Interfaces;
using Maestro.Infrastructure.Orchestration;
using Xunit;

namespace Maestro.Infrastructure.Tests
{
    public class ExecutionGraphTests
    {
        [Fact]
        public void Layers_TopologicalOrder_SimpleChain()
        {
            var blocks = new List<Maestro.Domain.Entities.BlockDefinition>
            {
                Maestro.Domain.Entities.BlockDefinition.Create("A","A","type"),
                Maestro.Domain.Entities.BlockDefinition.Create("B","B","type"),
                Maestro.Domain.Entities.BlockDefinition.Create("C","C","type")
            };
            var conns = new List<Maestro.Domain.Entities.ConnectionDefinition>
            {
                new() { FromBlockId = "A", FromPort = "out", ToBlockId = "B", ToPort = "in" },
                new() { FromBlockId = "B", FromPort = "out", ToBlockId = "C", ToPort = "in" }
            };
            var g = new ExecutionGraph(blocks, conns);
            var layers = g.GetExecutionLayers();
            Assert.Equal(3, layers.Count());
            Assert.Contains(layers.First(), l => l.Any(n => n.Id == "A"));
        }
    }
}
