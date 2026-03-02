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
/// Security tests for ToolBlockExecutor — path traversal and working directory validation.
/// Phase 45-PREP-A.
/// </summary>
public class ToolBlockSecurityTests
{
    private static ToolBlockExecutor CreateExecutor() => new ToolBlockExecutor();

    private static BlockDefinition CreateFilesystemBlock(string operation, string? workingDir = null)
    {
        var block = BlockDefinition.Create("sec-test", "sec-test", "tool");
        var config = new Dictionary<string, object>
        {
            ["toolType"] = "filesystem",
            ["operation"] = operation,
        };
        if (workingDir != null)
            config["workingDir"] = workingDir;
        block.UpdateConfig(config);
        return block;
    }

    private static BlockDefinition CreateShellBlock(string? configWorkingDir = null)
    {
        var block = BlockDefinition.Create("sec-shell", "sec-shell", "tool");
        var config = new Dictionary<string, object>
        {
            ["toolType"] = "shell",
            ["timeoutMs"] = 5000,
        };
        if (configWorkingDir != null)
            config["workingDir"] = configWorkingDir;
        block.UpdateConfig(config);
        return block;
    }

    // ── Path Traversal Tests (filesystem) ──

    [Fact]
    public async Task FileRead_PathTraversal_IsBlocked()
    {
        var executor = CreateExecutor();
        var tempDir = Path.Combine(Path.GetTempPath(), "maestro_sec_test_" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(tempDir);

        try
        {
            var block = CreateFilesystemBlock("read", tempDir);
            var ctx = ExecutionContext.Create("wf");
            var inputs = new Dictionary<string, object>
            {
                ["path"] = "../../etc/passwd"
            };

            var result = await executor.ExecuteAsync(block, ctx, inputs);

            Assert.False(result.Success);
            Assert.True(result.Outputs.ContainsKey("error"));
            Assert.Contains("escapes", result.Outputs["error"]?.ToString(), StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            Directory.Delete(tempDir, true);
        }
    }

    [Fact]
    public async Task FileRead_ValidPathInScope_Succeeds()
    {
        var executor = CreateExecutor();
        var tempDir = Path.Combine(Path.GetTempPath(), "maestro_sec_test_" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(tempDir);
        var testFile = Path.Combine(tempDir, "test.txt");
        await File.WriteAllTextAsync(testFile, "hello");

        try
        {
            var block = CreateFilesystemBlock("read", tempDir);
            var ctx = ExecutionContext.Create("wf");
            var inputs = new Dictionary<string, object>
            {
                ["path"] = testFile
            };

            var result = await executor.ExecuteAsync(block, ctx, inputs);

            Assert.True(result.Success);
            Assert.True(result.Outputs.ContainsKey("content"));
            Assert.Equal("hello", result.Outputs["content"]?.ToString());
        }
        finally
        {
            Directory.Delete(tempDir, true);
        }
    }

    [Fact]
    public async Task FileWrite_PathTraversal_IsBlocked()
    {
        var executor = CreateExecutor();
        var tempDir = Path.Combine(Path.GetTempPath(), "maestro_sec_test_" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(tempDir);

        try
        {
            var block = CreateFilesystemBlock("write", tempDir);
            var ctx = ExecutionContext.Create("wf");
            var inputs = new Dictionary<string, object>
            {
                ["path"] = Path.Combine(tempDir, "..", "..", "evil.txt"),
                ["content"] = "malicious"
            };

            var result = await executor.ExecuteAsync(block, ctx, inputs);

            Assert.False(result.Success);
            Assert.True(result.Outputs.ContainsKey("error"));
        }
        finally
        {
            Directory.Delete(tempDir, true);
        }
    }

    [Fact]
    public async Task DirectoryList_PathTraversal_IsBlocked()
    {
        var executor = CreateExecutor();
        var tempDir = Path.Combine(Path.GetTempPath(), "maestro_sec_test_" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(tempDir);

        try
        {
            var block = CreateFilesystemBlock("list", tempDir);
            var ctx = ExecutionContext.Create("wf");
            var inputs = new Dictionary<string, object>
            {
                ["path"] = "../../"
            };

            var result = await executor.ExecuteAsync(block, ctx, inputs);

            Assert.False(result.Success);
            Assert.True(result.Outputs.ContainsKey("error"));
        }
        finally
        {
            Directory.Delete(tempDir, true);
        }
    }

    // ── Working Directory Override Tests (filesystem) ──

    [Fact]
    public async Task Filesystem_WorkingDirOverride_NonexistentDir_IsBlocked()
    {
        var executor = CreateExecutor();
        var block = CreateFilesystemBlock("read");
        var ctx = ExecutionContext.Create("wf");
        var inputs = new Dictionary<string, object>
        {
            ["path"] = "test.txt",
            ["workingDir"] = Path.Combine(Path.GetTempPath(), "nonexistent_dir_" + Guid.NewGuid().ToString("N"))
        };

        var result = await executor.ExecuteAsync(block, ctx, inputs);

        Assert.False(result.Success);
        Assert.Contains("does not exist", result.Outputs["error"]?.ToString(), StringComparison.OrdinalIgnoreCase);
    }

    // ── Working Directory Override Tests (shell) ──

    [Fact]
    public async Task Shell_WorkingDirOverride_NonexistentDir_IsBlocked()
    {
        var executor = CreateExecutor();
        var block = CreateShellBlock();
        var ctx = ExecutionContext.Create("wf");
        var inputs = new Dictionary<string, object>
        {
            ["command"] = "echo hello",
            ["workingDir"] = Path.Combine(Path.GetTempPath(), "nonexistent_shell_dir_" + Guid.NewGuid().ToString("N"))
        };

        var result = await executor.ExecuteAsync(block, ctx, inputs);

        Assert.False(result.Success);
        Assert.Contains("does not exist", result.Outputs["error"]?.ToString(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Shell_WorkingDirOverride_ValidDir_Succeeds()
    {
        var executor = CreateExecutor();
        var tempDir = Path.Combine(Path.GetTempPath(), "maestro_sec_test_" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(tempDir);

        try
        {
            var block = CreateShellBlock();
            var ctx = ExecutionContext.Create("wf");
            var echoCmd = System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(
                System.Runtime.InteropServices.OSPlatform.Windows) ? "echo ok" : "echo ok";
            var inputs = new Dictionary<string, object>
            {
                ["command"] = echoCmd,
                ["workingDir"] = tempDir
            };

            var result = await executor.ExecuteAsync(block, ctx, inputs);

            Assert.True(result.Success);
        }
        finally
        {
            Directory.Delete(tempDir, true);
        }
    }

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

    // ── AllowedPaths Tests (Phase 45-PREP-F Bug 4 Fix) ──

    [Fact]
    public async Task FileRead_OutsideWorkingDir_AllowedByWildcardPaths()
    {
        var executor = CreateExecutor();
        var workDir = Path.Combine(Path.GetTempPath(), "maestro_sec_wk_" + Guid.NewGuid().ToString("N")[..8]);
        var otherDir = Path.Combine(Path.GetTempPath(), "maestro_sec_other_" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(workDir);
        Directory.CreateDirectory(otherDir);
        var testFile = Path.Combine(otherDir, "readable.txt");
        await File.WriteAllTextAsync(testFile, "can-read-this");

        try
        {
            var block = CreateFilesystemBlock("read", workDir);
            var ctx = ExecutionContext.Create("wf");
            // Simulate session permissions with AllowedPaths=["*"]
            ctx.Variables["_permissions_allowedPaths"] = new List<string> { "*" };
            var inputs = new Dictionary<string, object> { ["path"] = testFile };

            var result = await executor.ExecuteAsync(block, ctx, inputs);

            Assert.True(result.Success, "Read outside workingDir should succeed with AllowedPaths=[*]");
            Assert.Equal("can-read-this", result.Outputs["content"]?.ToString());
        }
        finally
        {
            Directory.Delete(workDir, true);
            Directory.Delete(otherDir, true);
        }
    }

    [Fact]
    public async Task FileWrite_OutsideWorkingDir_BlockedEvenWithWildcardPaths()
    {
        var executor = CreateExecutor();
        var workDir = Path.Combine(Path.GetTempPath(), "maestro_sec_wk_" + Guid.NewGuid().ToString("N")[..8]);
        var otherDir = Path.Combine(Path.GetTempPath(), "maestro_sec_other_" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(workDir);
        Directory.CreateDirectory(otherDir);
        var targetFile = Path.Combine(otherDir, "should-not-write.txt");

        try
        {
            var block = CreateFilesystemBlock("write", workDir);
            var ctx = ExecutionContext.Create("wf");
            // Even with wildcard AllowedPaths, writes outside workingDir are blocked
            ctx.Variables["_permissions_allowedPaths"] = new List<string> { "*" };
            var inputs = new Dictionary<string, object>
            {
                ["path"] = targetFile,
                ["content"] = "malicious"
            };

            var result = await executor.ExecuteAsync(block, ctx, inputs);

            Assert.False(result.Success, "Write outside workingDir should be blocked even with AllowedPaths=[*]");
            Assert.True(result.Outputs.ContainsKey("error"));
        }
        finally
        {
            Directory.Delete(workDir, true);
            Directory.Delete(otherDir, true);
        }
    }

    [Fact]
    public async Task FileRead_OutsideWorkingDir_BlockedWithEmptyAllowedPaths()
    {
        var executor = CreateExecutor();
        var workDir = Path.Combine(Path.GetTempPath(), "maestro_sec_wk_" + Guid.NewGuid().ToString("N")[..8]);
        var otherDir = Path.Combine(Path.GetTempPath(), "maestro_sec_other_" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(workDir);
        Directory.CreateDirectory(otherDir);
        var testFile = Path.Combine(otherDir, "secret.txt");
        await File.WriteAllTextAsync(testFile, "secret-data");

        try
        {
            var block = CreateFilesystemBlock("read", workDir);
            var ctx = ExecutionContext.Create("wf");
            // Empty AllowedPaths — no reads outside workingDir allowed
            ctx.Variables["_permissions_allowedPaths"] = new List<string>();
            var inputs = new Dictionary<string, object> { ["path"] = testFile };

            var result = await executor.ExecuteAsync(block, ctx, inputs);

            Assert.False(result.Success, "Read outside workingDir should be blocked with empty AllowedPaths");
        }
        finally
        {
            Directory.Delete(workDir, true);
            Directory.Delete(otherDir, true);
        }
    }

    [Fact]
    public async Task FileRead_OutsideWorkingDir_AllowedBySpecificPath()
    {
        var executor = CreateExecutor();
        var workDir = Path.Combine(Path.GetTempPath(), "maestro_sec_wk_" + Guid.NewGuid().ToString("N")[..8]);
        var allowedDir = Path.Combine(Path.GetTempPath(), "maestro_sec_allowed_" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(workDir);
        Directory.CreateDirectory(allowedDir);
        var testFile = Path.Combine(allowedDir, "allowed-file.txt");
        await File.WriteAllTextAsync(testFile, "allowed-content");

        try
        {
            var block = CreateFilesystemBlock("read", workDir);
            var ctx = ExecutionContext.Create("wf");
            // AllowedPaths includes the specific directory
            ctx.Variables["_permissions_allowedPaths"] = new List<string> { allowedDir };
            var inputs = new Dictionary<string, object> { ["path"] = testFile };

            var result = await executor.ExecuteAsync(block, ctx, inputs);

            Assert.True(result.Success, "Read from specifically allowed path should succeed");
            Assert.Equal("allowed-content", result.Outputs["content"]?.ToString());
        }
        finally
        {
            Directory.Delete(workDir, true);
            Directory.Delete(allowedDir, true);
        }
    }
}
