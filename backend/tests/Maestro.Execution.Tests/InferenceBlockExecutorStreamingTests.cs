using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Infrastructure.BlockExecutors;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Moq;
using Xunit;

namespace Maestro.Execution.Tests
{
    public class InferenceBlockExecutorStreamingTests
    {
        [Fact]
        public async Task ExecuteAsync_WhenGatewayStreams_PublishesChunksToMonitorAndReturnsCombinedContent()
        {
            // Arrange
            var llmMock = new Mock<ILLMGateway>();
            async IAsyncEnumerable<string> StreamChunks()
            {
                yield return "Hello ";
                await Task.Delay(1);
                yield return "world";
            }

            llmMock.Setup(m => m.StreamAsync(It.IsAny<LLMRequest>(), It.IsAny<CancellationToken>()))
                .Returns(StreamChunks());

            var monitorMock = new Mock<Maestro.Application.Interfaces.IExecutionMonitor>();

            var exec = new InferenceBlockExecutor(llmMock.Object, monitorMock.Object);

            var block = BlockDefinition.Create("b-stream", "inf-stream", "inference");
            block.UpdateConfig(new Dictionary<string, object> { ["template"] = "ignored", ["stream"] = true });

            var ctx = Maestro.Domain.Entities.ExecutionContext.Create("wf");

            // Act
            var res = await exec.ExecuteAsync(block, ctx, new Dictionary<string, object>());

            // Assert
            Assert.True(res.Outputs.ContainsKey("content"));
            Assert.Equal("Hello world", res.Outputs["content"].ToString());
            monitorMock.Verify(m => m.PublishTerminalOutputAsync(It.Is<string>(s => s.Contains("Hello ")), It.IsAny<CancellationToken>()), Times.AtLeastOnce);
            monitorMock.Verify(m => m.PublishTerminalOutputAsync(It.Is<string>(s => s.Contains("world")), It.IsAny<CancellationToken>()), Times.AtLeastOnce);
        }
    }
}
