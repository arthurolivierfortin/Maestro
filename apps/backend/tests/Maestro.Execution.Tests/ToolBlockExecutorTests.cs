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

public class ToolBlockExecutorTests
{
    [Fact]
    public async Task ExecutesSimpleEchoScript_CapturesStdout()
    {
        var executor = new ToolBlockExecutor();

        var block = BlockDefinition.Create("b1", "echo", "tool");
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["script"] = RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "Write-Output \"hello\"" : "echo hello",
            ["runtime"] = RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "powershell" : "bash",
            ["timeoutMs"] = 5000
        });

        var ctx = ExecutionContext.Create("wf1");
        var result = await executor.ExecuteAsync(block, ctx, new Dictionary<string, object>());

        Assert.True(result.Success);
        Assert.Contains("hello", string.Join("\n", result.Logs), StringComparison.OrdinalIgnoreCase);
        Assert.True(result.Outputs.ContainsKey("stdout"));
    }

    [Fact]
    public async Task ScriptExceedsTimeout_IsKilled()
    {
        var executor = new ToolBlockExecutor();

        var block = BlockDefinition.Create("b2", "sleep", "tool");
        var script = RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "Start-Sleep -Seconds 5" : "sleep 5";
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["script"] = script,
            ["runtime"] = RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "powershell" : "bash",
            ["timeoutMs"] = 1000
        });

        var ctx = ExecutionContext.Create("wf2");
        var result = await executor.ExecuteAsync(block, ctx, new Dictionary<string, object>());

        // Expect the process to be killed or duration to be short due to timeout
        Assert.True(result.Logs.Any(l => l.Contains("killed", StringComparison.OrdinalIgnoreCase)) || result.DurationMs < 3000);
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
    public async Task AgentBlock_LoadsMockResponse()
    {
        var path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "maestro_agent_mock");
        System.IO.Directory.CreateDirectory(path);
        var mock = System.Text.Json.JsonSerializer.Serialize(new { outputs = new { message = "ok" } });
        await System.IO.File.WriteAllTextAsync(System.IO.Path.Combine(path, "mock-response.json"), mock);

        var executor = new Maestro.Infrastructure.BlockExecutors.AgentBlockExecutor(new Maestro.Infrastructure.LLMGateway.LLMGateway(), serviceProvider: null);
        var block = BlockDefinition.Create("a1", "agent", "agent");
        block.UpdateConfig(new Dictionary<string, object> { ["path"] = path });
        var ctx = ExecutionContext.Create("wf");
        var res = await executor.ExecuteAsync(block, ctx, new Dictionary<string, object>());
        Assert.True(res.Outputs.ContainsKey("message"));
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

    [Fact]
    public async Task ToolBlock_ExecutesScriptFile_ParsesJsonOutput()
    {
        var tempDir = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "maestro_tool_test");
        System.IO.Directory.CreateDirectory(tempDir);
        var scriptPath = System.IO.Path.Combine(tempDir, "out.sh");
        var content = "echo '{\"result\": \"ok\"}'";
        await System.IO.File.WriteAllTextAsync(scriptPath, content);

        var executor = new Maestro.Infrastructure.BlockExecutors.ToolBlockExecutor();
        var block = Maestro.Domain.Entities.BlockDefinition.Create("tfile", "toolfile", "tool");
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["scriptFile"] = "out.sh",
            ["runtime"] = System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.Windows) ? "powershell" : "bash",
            ["parseOutput"] = "json",
            ["timeoutMs"] = 5000,
            ["enableSandbox"] = true
        });
        block.UpdateMetadata(new Dictionary<string, object> { ["path"] = tempDir });

        var ctx = ExecutionContext.Create("wf");
        var res = await executor.ExecuteAsync(block, ctx, new Dictionary<string, object>());
        Assert.True(res.Outputs.TryGetValue("result", out var r) && r.ToString() == "ok");
    }
}
