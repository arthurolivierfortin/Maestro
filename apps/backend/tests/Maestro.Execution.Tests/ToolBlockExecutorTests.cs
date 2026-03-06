using System.Runtime.InteropServices;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using Maestro.Infrastructure.BlockExecutors;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;
using Xunit;

namespace Maestro.Execution.Tests;

/// <summary>
/// Tests for ToolBlockExecutor (Phase 53-E: config.nodes path only).
/// Legacy tests removed — shell execution, filesystem ops, etc. are now handled
/// by atomic executors (ShellBlockExecutor, FileReadBlockExecutor, etc.)
/// dispatched via config.nodes.
/// </summary>
public class ToolBlockExecutorTests
{
    [Fact]
    public async Task ToolBlock_WithoutConfigNodes_ThrowsInvalidOperation()
    {
        var executor = new ToolBlockExecutor();

        var block = BlockDefinition.Create("b1", "echo", "tool");
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["script"] = "echo hello",
        });

        var ctx = ExecutionContext.Create("wf1");
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => executor.ExecuteAsync(block, ctx, new Dictionary<string, object>()));
    }
}

public class OtherExecutorsTests
{
    [Fact]
    public async Task PromptBlock_ResolvesTemplate()
    {
        var executor = new Maestro.Infrastructure.BlockExecutors.PromptBlockExecutor();
        var block = BlockDefinition.Create("p1", "prompt", "prompt");
        block.UpdateConfig(new Dictionary<string, object> { ["template"] = "Hello {{name}}" });
        var ctx = ExecutionContext.Create("wf");
        var res = await executor.ExecuteAsync(block, ctx, new Dictionary<string, object> { ["name"] = "Alice" });
        Assert.True(res.Outputs.TryGetValue("prompt", out var p) && p.ToString().Contains("Alice"));
    }

    [Fact]
    public async Task DecisionBlock_EvaluatesCondition()
    {
        var executor = new Maestro.Infrastructure.BlockExecutors.DecisionBlockExecutor();
        var block = BlockDefinition.Create("d1", "decision", "decision");
        block.UpdateConfig(new Dictionary<string, object> { ["condition"] = "{{flag}} == true" });
        var ctx = ExecutionContext.Create("wf");
        var res = await executor.ExecuteAsync(block, ctx, new Dictionary<string, object> { ["flag"] = "true" });
        Assert.True(res.Outputs.TryGetValue("result", out var r) && r is bool bv && bv);
    }

    [Fact]
    public async Task ValidatorBlock_ChecksRequiredAndPattern()
    {
        var executor = new Maestro.Infrastructure.BlockExecutors.ValidatorBlockExecutor();
        var rules = new Dictionary<string, object>
        {
            ["required"] = new[] { "email" },
            ["patterns"] = new Dictionary<string, string> { ["email"] = ".+@.+\\..+" }
        };
        var block = BlockDefinition.Create("v1", "validator", "validator");
        block.UpdateConfig(new Dictionary<string, object> { ["rules"] = rules });
        var ctx = ExecutionContext.Create("wf");
        var res = await executor.ExecuteAsync(block, ctx, new Dictionary<string, object> { ["email"] = "me@example.com" });
        Assert.True(res.Outputs.TryGetValue("isValid", out var v) && (bool)v);
    }

    [Fact]
    public async Task TriggerBlock_ForwardsPayload()
    {
        var executor = new Maestro.Infrastructure.BlockExecutors.TriggerBlockExecutor();
        var block = BlockDefinition.Create("t1", "trigger", "trigger");
        var ctx = ExecutionContext.Create("wf");
        var payload = new Dictionary<string, object> { ["x"] = 1 };
        var res = await executor.ExecuteAsync(block, ctx, new Dictionary<string, object> { ["payload"] = payload });
        Assert.True(res.Outputs.TryGetValue("payload", out var p) && p is Dictionary<string, object>);
    }

    [Fact]
    public async Task InferenceBlock_UsesMockGateway()
    {
        var mock = new Moq.Mock<Maestro.Application.Interfaces.ILLMGateway>();
        mock.Setup(m => m.SendAsync(Moq.It.IsAny<Maestro.Application.Interfaces.LLMRequest>(), Moq.It.IsAny<System.Threading.CancellationToken>()))
            .Returns(System.Threading.Tasks.Task.FromResult(new Maestro.Application.Interfaces.LLMResponse { Content = "mocked content" }));

        var executor = new Maestro.Infrastructure.BlockExecutors.InferenceBlockExecutor(mock.Object);
        var block = Maestro.Domain.Entities.BlockDefinition.Create("i1", "inference", "inference");
        block.UpdateConfig(new Dictionary<string, object> { ["template"] = "Say hi" });
        var ctx = ExecutionContext.Create("wf");
        var res = await executor.ExecuteAsync(block, ctx, new Dictionary<string, object>());
        Assert.True(res.Outputs.TryGetValue("content", out var c) && c.ToString().Contains("mocked"));
    }
}
