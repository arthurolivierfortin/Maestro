using System.Collections.Generic;
using Maestro.Infrastructure.Orchestration;
using Xunit;

namespace Maestro.Infrastructure.Tests
{
    public class DataFlowManagerTests
    {
        [Fact]
        public void SetAndGetOutputs_WorkflowFlow()
        {
            var df = new DataFlowManager();
            df.SetOutput("A","out","hello");
            var blocks = new List<Maestro.Domain.Entities.BlockDefinition>
            {
                Maestro.Domain.Entities.BlockDefinition.Create("A","A","t"),
                Maestro.Domain.Entities.BlockDefinition.Create("B","B","t")
            };
            var conns = new List<Maestro.Domain.Entities.ConnectionDefinition>
            {
                new() { FromBlockId = "A", FromPort = "out", ToBlockId = "B", ToPort = "in" }
            };
            var g = new ExecutionGraph(blocks, conns);
            var input = df.GetInput("B","in", g);
            Assert.Equal("hello", input);
        }
    }
}
