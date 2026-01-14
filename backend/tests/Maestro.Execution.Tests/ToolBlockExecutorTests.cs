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
