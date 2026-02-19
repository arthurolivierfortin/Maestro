using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Moq;
using Xunit;
using Maestro.Infrastructure.Execution;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Application.DTOs;
using Maestro.Domain.ValueObjects;

namespace Maestro.Infrastructure.Tests
{
    public class ExecutionEngineTests
    {
        [Fact]
        public async Task ExecuteBlockAsync_InvokesExecutorAndPersistsContext()
        {
            var block = BlockDefinition.Create("b1", "Block 1", "prompt");

            var blockRepo = new Mock<IBlockRepository>();
            blockRepo.Setup(r => r.GetByIdAsync("b1", It.IsAny<CancellationToken>())).ReturnsAsync(block);

            var executorMock = new Mock<IBlockExecutor>();
            executorMock.SetupGet(e => e.SupportedType).Returns("prompt");
            executorMock.Setup(e => e.ExecuteAsync(block, It.IsAny<ExecutionContext>(), It.IsAny<Dictionary<string, object>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new BlockExecutionResult { Outputs = { ["out"] = "ok" }, Success = true });

            var registry = new BlockExecutorRegistry(new[] { executorMock.Object });

            var execRepo = new Mock<IExecutionRepository>();
            execRepo.Setup(r => r.SaveAsync(It.IsAny<ExecutionContext>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var monitor = new Mock<IExecutionMonitor>();
            monitor.Setup(m => m.PublishNodeStartedAsync(It.IsAny<NodeId>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            monitor.Setup(m => m.PublishNodeCompletedAsync(It.IsAny<NodeId>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var engine = new ExecutionEngine(blockRepo.Object, registry, execRepo.Object, monitor.Object);

            var ctx = await engine.ExecuteBlockAsync("b1", new Dictionary<string, object>());

            Assert.Equal("b1", ctx.WorkflowId);
            Assert.Equal("Completed", ctx.Status);
            Assert.Equal("ok", ctx.GetBlockOutput("b1", "out"));
            execRepo.Verify(r => r.SaveAsync(It.IsAny<ExecutionContext>(), It.IsAny<CancellationToken>()), Times.Once);
            monitor.Verify(m => m.PublishNodeStartedAsync(It.IsAny<NodeId>(), It.IsAny<CancellationToken>()), Times.Once);
            monitor.Verify(m => m.PublishNodeCompletedAsync(It.IsAny<NodeId>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ExecuteWorkflowAsync_ExecutesTwoNodeWorkflowInOrder()
        {
            // workflow block with nodes and connections
            var workflow = BlockDefinition.Create("wf1", "Workflow 1", "workflow");
            var nodes = new[] { new { id = "n1" }, new { id = "n2" } };
            var conns = new[] { new { from = new { nodeId = "n1" }, to = new { nodeId = "n2" } } };
            var cfg = new Dictionary<string, object> { ["nodes"] = nodes, ["connections"] = conns };
            workflow.UpdateConfig(cfg);

            var n1 = BlockDefinition.Create("n1", "Node 1", "prompt");
            var n2 = BlockDefinition.Create("n2", "Node 2", "prompt");

            var blockRepo = new Mock<IBlockRepository>();
            blockRepo.Setup(r => r.GetByIdAsync("wf1", It.IsAny<CancellationToken>())).ReturnsAsync(workflow);
            blockRepo.Setup(r => r.GetByIdAsync("n1", It.IsAny<CancellationToken>())).ReturnsAsync(n1);
            blockRepo.Setup(r => r.GetByIdAsync("n2", It.IsAny<CancellationToken>())).ReturnsAsync(n2);

            var executorMock = new Mock<IBlockExecutor>();
            executorMock.SetupGet(e => e.SupportedType).Returns("prompt");
            executorMock.Setup(e => e.ExecuteAsync(It.IsAny<BlockDefinition>(), It.IsAny<ExecutionContext>(), It.IsAny<Dictionary<string, object>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new BlockExecutionResult { Outputs = { ["out"] = "ok" }, Success = true });

            var registry = new BlockExecutorRegistry(new[] { executorMock.Object });

            var execRepo = new Mock<IExecutionRepository>();
            execRepo.Setup(r => r.SaveAsync(It.IsAny<ExecutionContext>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var monitor = new Mock<IExecutionMonitor>();
            monitor.Setup(m => m.PublishNodeStartedAsync(It.IsAny<NodeId>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
            monitor.Setup(m => m.PublishNodeCompletedAsync(It.IsAny<NodeId>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            var engine = new ExecutionEngine(blockRepo.Object, registry, execRepo.Object, monitor.Object);

            var ctx = await engine.ExecuteWorkflowAsync("wf1", new Dictionary<string, object>());

            Assert.Equal("wf1", ctx.WorkflowId);
            Assert.Equal("Completed", ctx.Status);
            // outputs for node n2 should be present
            Assert.Equal("ok", ctx.GetBlockOutput("n2", "out"));
            monitor.Verify(m => m.PublishNodeStartedAsync(It.IsAny<NodeId>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
            monitor.Verify(m => m.PublishNodeCompletedAsync(It.IsAny<NodeId>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
        }
    }
}
