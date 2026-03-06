using System;
using System.IO;
using System.Threading.Tasks;
using System.Collections.Generic;
using Maestro.Infrastructure.BlockExecutors;
using Maestro.Infrastructure.Containers;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;
using Xunit;

namespace Maestro.Execution.Tests;

/// <summary>
/// Security tests — PathValidator is a standalone utility used by multiple executors.
/// ToolBlockExecutor-specific security tests removed in Phase 53-E (legacy code removed).
/// Filesystem security is now handled by FileReadBlockExecutor, ShellBlockExecutor, etc.
/// </summary>
public class ToolBlockSecurityTests
{
    // ── PathValidator Unit Tests (defense in depth) ──

    [Theory]
    [InlineData("../../etc/passwd")]
    [InlineData("..\\..\\Windows\\system32")]
    [InlineData("foo/../../../bar")]
    public void PathValidator_RejectsTraversal(string relativePath)
    {
        var root = Path.Combine(Path.GetTempPath(), "sandbox");
        var candidate = Path.Combine(root, relativePath);

        Assert.False(PathValidator.IsPathUnderRoot(candidate, root));
    }

    [Fact]
    public void PathValidator_AcceptsValidSubpath()
    {
        var root = Path.GetTempPath();
        var candidate = Path.Combine(root, "subdir", "file.txt");

        Assert.True(PathValidator.IsPathUnderRoot(candidate, root));
    }

    [Fact]
    public async Task ToolBlock_WithoutConfigNodes_ThrowsInvalidOperation()
    {
        var executor = new ToolBlockExecutor();
        var block = BlockDefinition.Create("sec-test", "sec-test", "tool");
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["toolType"] = "filesystem",
            ["operation"] = "read",
        });

        var ctx = ExecutionContext.Create("wf");
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => executor.ExecuteAsync(block, ctx, new Dictionary<string, object> { ["path"] = "test.txt" }));
    }
}
