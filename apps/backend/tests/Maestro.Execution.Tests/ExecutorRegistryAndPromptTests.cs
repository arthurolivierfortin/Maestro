using System.Collections.Generic;
using Maestro.Infrastructure.BlockExecutors;
using Maestro.Domain.Entities;
using Xunit;

namespace Maestro.Execution.Tests
{
    public class ExecutorRegistryAndPromptTests
    {
        [Fact]
        public void PromptBlockExecutor_ResolvesTemplateFromConfig()
        {
            var exec = new PromptBlockExecutor();
            var block = BlockDefinition.Create("p1", "prompt", "prompt");
            block.UpdateConfig(new Dictionary<string, object?> { ["template"] = "Hi {{name}}" });
            var ctx = ExecutionContext.Create("wf");
            var res = exec.ExecuteAsync(block, ctx, new Dictionary<string, object> { ["name"] = "Dev" }).GetAwaiter().GetResult();
            Assert.True(res.Outputs.ContainsKey("prompt"));
            Assert.Contains("Dev", res.Outputs["prompt"].ToString());
        }

        [Fact]
        public void BlockExecutorRegistry_ResolvesRegisteredType()
        {
            var prompt = new PromptBlockExecutor();
            var registry = new Maestro.Infrastructure.BlockExecutors.BlockExecutorRegistry(new[] { (Maestro.Application.Interfaces.IBlockExecutor)prompt });

            var resolved = registry.Get("prompt");
            Assert.NotNull(resolved);
            Assert.Equal(prompt.SupportedType, resolved!.SupportedType);
        }
    }
}
