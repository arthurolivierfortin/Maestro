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
    public class InferenceBlockExecutorTests
    {
        [Fact]
        public async Task ExecuteAsync_UsesMockResponse_WhenMockFilePresent()
        {
            // Arrange
            var repoPath = System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), "test_resources", "inference_mock");
            System.IO.Directory.CreateDirectory(repoPath);
            var mockFile = System.IO.Path.Combine(repoPath, "mock-response.json");
            System.IO.File.WriteAllText(mockFile, "{ \"outputs\": { \"message\": \"hello mock\" } }");

            var block = BlockDefinition.Create("b1", "inf1", "inference");
            block.UpdateConfig(new Dictionary<string, object> { ["path"] = repoPath });

            var llmMock = new Mock<ILLMGateway>();
            var exec = new InferenceBlockExecutor(llmMock.Object);

            var ctx = Maestro.Domain.Entities.ExecutionContext.Create("wf");

            // Act
            var res = await exec.ExecuteAsync(block, ctx, new Dictionary<string, object>());

            // Assert
            Assert.True(res.Outputs.ContainsKey("message"));
            Assert.Equal("hello mock", res.Outputs["message"].ToString());

            // cleanup
            System.IO.File.Delete(mockFile);
            System.IO.Directory.Delete(repoPath);
        }

        [Fact]
        public async Task ExecuteAsync_RetriesOnTransientFailure()
        {
            var block = BlockDefinition.Create("b2", "inf2", "inference");
            block.UpdateConfig(new Dictionary<string, object> { ["template"] = "hi" });

            var attempts = 0;
            var llmMock = new Mock<ILLMGateway>();
            llmMock.Setup(m => m.SendAsync(It.IsAny<Maestro.Application.Interfaces.LLMRequest>(), It.IsAny<CancellationToken>()))
                .Returns(() =>
                {
                    attempts++;
                    if (attempts < 2) throw new System.Exception("transient");
                    return Task.FromResult(new Maestro.Application.Interfaces.LLMResponse { Content = "ok" });
                });

            var exec = new InferenceBlockExecutor(llmMock.Object);
            var ctx = Maestro.Domain.Entities.ExecutionContext.Create("wf");

            var res = await exec.ExecuteAsync(block, ctx, new Dictionary<string, object>());

            Assert.True(res.Outputs.ContainsKey("content"));
            Assert.Equal("ok", res.Outputs["content"].ToString());
            Assert.True(attempts >= 2);
        }
    }
}
