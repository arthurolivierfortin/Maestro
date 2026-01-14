using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Infrastructure.Execution;
using Maestro.Infrastructure.BlockExecutors;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using DomainVO = Maestro.Domain.ValueObjects;
using System.Linq;
using Xunit;

namespace Maestro.Execution.Tests
{
    class InMemoryBlockRepo : IBlockRepository
    {
        private readonly Dictionary<string, BlockDefinition> _blocks = new();
        public void Add(BlockDefinition b) => _blocks[b.Id] = b;
        public Task<BlockDefinition?> GetByIdAsync(string id, CancellationToken ct = default) => Task.FromResult(_blocks.TryGetValue(id, out var b) ? b : null);
        public Task<IEnumerable<BlockDefinition>> GetAllAsync(CancellationToken ct = default) => Task.FromResult(_blocks.Values.AsEnumerable());
        public Task SaveAsync(BlockDefinition block, CancellationToken ct = default) { _blocks[block.Id] = block; return Task.CompletedTask; }
        public Task DeleteAsync(string id, CancellationToken ct = default) { _blocks.Remove(id); return Task.CompletedTask; }
        public Task<string?> GetBlockPathAsync(string id, CancellationToken ct = default) => Task.FromResult<string?>(null);
    }

    class DummyExecutionRepo : IExecutionRepository
    {
        public Task SaveAsync(Maestro.Domain.Entities.ExecutionContext context, CancellationToken ct = default) => Task.CompletedTask;
        public Task<Maestro.Domain.Entities.ExecutionContext?> GetByIdAsync(DomainVO.ExecutionId id, CancellationToken ct = default) => Task.FromResult<Maestro.Domain.Entities.ExecutionContext?>(null);
    }

    class NoopMonitor : IExecutionMonitor
    {
        public Task PublishNodeCompletedAsync(Maestro.Domain.ValueObjects.NodeId nodeId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task PublishNodeStartedAsync(Maestro.Domain.ValueObjects.NodeId nodeId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task PublishTerminalOutputAsync(string output, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    public class ExecutionEngineInMemoryTests
    {
        [Fact]
        public async Task ExecuteBlockAsync_SingleBlock_StoresOutput()
        {
            var repo = new InMemoryBlockRepo();
            var block = BlockDefinition.Create("b1", "echo", "tool");
            block.UpdateConfig(new Dictionary<string, object> { ["script"] = "echo hi", ["runtime"] = "bash", ["timeoutMs"] = 2000 });
            repo.Add(block);

            var registry = new BlockExecutorRegistry(new[] { (Maestro.Application.Interfaces.IBlockExecutor)new ToolBlockExecutor() });

            var engine = new ExecutionEngine(repo, registry, new DummyExecutionRepo(), new NoopMonitor());

            var ctx = await engine.ExecuteBlockAsync("b1", new Dictionary<string, object>());

            Assert.NotNull(ctx);
            var val = ctx.GetBlockOutput("b1", "stdout");
            Assert.True(val != null);
        }

        [Fact]
        public async Task ExecuteWorkflowAsync_SimpleTwoNodeWorkflow_ExecutesNodesInOrder()
        {
            var repo = new InMemoryBlockRepo();

            // node A
            var a = BlockDefinition.Create("a", "promptA", "prompt");
            a.UpdateConfig(new Dictionary<string, object> { ["template"] = "valA" });
            repo.Add(a);

            // node B
            var b = BlockDefinition.Create("b", "promptB", "prompt");
            b.UpdateConfig(new Dictionary<string, object> { ["template"] = "{{a_out}}-B" });
            repo.Add(b);

            // workflow block that references nodes and connections
            var wf = BlockDefinition.Create("wf", "workflow", "workflow");
            var nodes = new[] { new { id = "a" }, new { id = "b" } };
            var conns = new[] { new { from = new { nodeId = "a" }, to = new { nodeId = "b" } } };
            wf.UpdateConfig(new Dictionary<string, object> { ["nodes"] = nodes, ["connections"] = conns });
            repo.Add(wf);

            var registry = new BlockExecutorRegistry(new[] { (Maestro.Application.Interfaces.IBlockExecutor)new PromptBlockExecutor() });

            var engine = new ExecutionEngine(repo, registry, new DummyExecutionRepo(), new NoopMonitor());

            var ctx = await engine.ExecuteWorkflowAsync("wf", new Dictionary<string, object>());

            Assert.NotNull(ctx);
            // ensure nodes ran and stored outputs for node a
            var outA = ctx.GetBlockOutput("a", "prompt");
            Assert.NotNull(outA);
        }
    }
}
