using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.BlockExecutors;
using Maestro.Infrastructure.Testing;

namespace Maestro.Infrastructure.Tests.BlockExecutors;

/// <summary>
/// Phase 62-A: Tests for capture block executors and _toolMapping in ToolDispatcherBlockExecutor.
/// </summary>
public class CaptureBlockTests
{
    private static BlockDefinition CreateBlock(string id, string blockType) =>
        BlockDefinition.Create(id, id, blockType);

    private static ExecutionContext CreateContext()
    {
        var ctx = new ExecutionContext();
        ctx.Variables["workingDir"] = Directory.GetCurrentDirectory();
        return ctx;
    }

    // ---- CaptureFileWriteBlockExecutor ----

    [Fact]
    public async Task CaptureFileWrite_CapturesContentInCapturedToolCalls()
    {
        var executor = new CaptureFileWriteBlockExecutor();
        var block = CreateBlock("capture-file-write", "capture-file-write");
        var context = CreateContext();
        var inputs = new Dictionary<string, object>
        {
            ["path"] = "test/output.json",
            ["content"] = "{\"id\": \"test-block\"}"
        };

        var result = await executor.ExecuteAsync(block, context, inputs);

        Assert.True(result.Success);
        Assert.Contains("File written: test/output.json", result.Outputs["result"]?.ToString());

        // Verify captures are stored
        Assert.True(context.Variables.ContainsKey("_capturedToolCalls"));
        var captures = JsonSerializer.Deserialize<List<Dictionary<string, string>>>(
            context.Variables["_capturedToolCalls"]?.ToString() ?? "[]");
        Assert.NotNull(captures);
        Assert.Single(captures!);
        Assert.Equal("file-write", captures[0]["toolId"]);
        Assert.Equal("test/output.json", captures[0]["path"]);
        Assert.Equal("{\"id\": \"test-block\"}", captures[0]["content"]);
    }

    [Fact]
    public async Task CaptureFileWrite_MultipleWrites_AppendsToCaptures()
    {
        var executor = new CaptureFileWriteBlockExecutor();
        var block = CreateBlock("capture-file-write", "capture-file-write");
        var context = CreateContext();

        await executor.ExecuteAsync(block, context, new Dictionary<string, object>
        {
            ["path"] = "file1.json",
            ["content"] = "content1"
        });

        await executor.ExecuteAsync(block, context, new Dictionary<string, object>
        {
            ["path"] = "file2.json",
            ["content"] = "content2"
        });

        var captures = JsonSerializer.Deserialize<List<Dictionary<string, string>>>(
            context.Variables["_capturedToolCalls"]?.ToString() ?? "[]");
        Assert.Equal(2, captures!.Count);
        Assert.Equal("file1.json", captures[0]["path"]);
        Assert.Equal("file2.json", captures[1]["path"]);
    }

    // ---- CaptureFileReadBlockExecutor ----

    [Fact]
    public async Task CaptureFileRead_ReturnsCapturedContentFromPreviousWrite()
    {
        var writeExecutor = new CaptureFileWriteBlockExecutor();
        var readExecutor = new CaptureFileReadBlockExecutor();
        var block = CreateBlock("test", "capture-file-write");
        var readBlock = CreateBlock("test", "capture-file-read");
        var context = CreateContext();

        // First: write a file
        await writeExecutor.ExecuteAsync(block, context, new Dictionary<string, object>
        {
            ["path"] = "my-file.json",
            ["content"] = "{\"hello\": \"world\"}"
        });

        // Then: read the same file — should return captured content
        var result = await readExecutor.ExecuteAsync(readBlock, context, new Dictionary<string, object>
        {
            ["path"] = "my-file.json"
        });

        Assert.True(result.Success);
        Assert.Equal("{\"hello\": \"world\"}", result.Outputs["content"]?.ToString());
    }

    [Fact]
    public async Task CaptureFileRead_NoCapture_DelegatesToDiskRead()
    {
        var readExecutor = new CaptureFileReadBlockExecutor();
        var block = CreateBlock("test", "capture-file-read");
        var context = CreateContext();

        // Try to read a file that doesn't exist in captures and doesn't exist on disk
        var result = await readExecutor.ExecuteAsync(block, context, new Dictionary<string, object>
        {
            ["path"] = "nonexistent-file-62a-test.json"
        });

        // Should fall back to disk read and report not found
        Assert.True(result.Success); // file-read returns success even for not-found
        Assert.Contains("file not found", result.Outputs["content"]?.ToString() ?? "");
    }

    // ---- CaptureFileEditBlockExecutor ----

    [Fact]
    public async Task CaptureFileEdit_AppliesReplacementOnCapturedContent()
    {
        var writeExecutor = new CaptureFileWriteBlockExecutor();
        var editExecutor = new CaptureFileEditBlockExecutor();
        var readExecutor = new CaptureFileReadBlockExecutor();
        var writeBlock = CreateBlock("test", "capture-file-write");
        var editBlock = CreateBlock("test", "capture-file-edit");
        var readBlock = CreateBlock("test", "capture-file-read");
        var context = CreateContext();

        // Write initial content
        await writeExecutor.ExecuteAsync(writeBlock, context, new Dictionary<string, object>
        {
            ["path"] = "config.json",
            ["content"] = "{\"version\": \"1.0.0\", \"name\": \"test\"}"
        });

        // Edit the captured content
        var editResult = await editExecutor.ExecuteAsync(editBlock, context, new Dictionary<string, object>
        {
            ["path"] = "config.json",
            ["old_string"] = "\"1.0.0\"",
            ["new_string"] = "\"2.0.0\""
        });

        Assert.True(editResult.Success);
        Assert.Contains("replacement applied", editResult.Outputs["result"]?.ToString() ?? "");

        // Read back — should have the edited content
        var readResult = await readExecutor.ExecuteAsync(readBlock, context, new Dictionary<string, object>
        {
            ["path"] = "config.json"
        });

        Assert.Equal("{\"version\": \"2.0.0\", \"name\": \"test\"}", readResult.Outputs["content"]?.ToString());
    }

    [Fact]
    public async Task CaptureFileEdit_NoPreviousWrite_RecordsEditOnly()
    {
        var editExecutor = new CaptureFileEditBlockExecutor();
        var block = CreateBlock("test", "capture-file-edit");
        var context = CreateContext();

        var result = await editExecutor.ExecuteAsync(block, context, new Dictionary<string, object>
        {
            ["path"] = "new-file.json",
            ["old_string"] = "old",
            ["new_string"] = "new"
        });

        Assert.True(result.Success);
        Assert.Contains("File edited: new-file.json", result.Outputs["result"]?.ToString() ?? "");
        Assert.DoesNotContain("replacement applied", result.Outputs["result"]?.ToString() ?? "");

        // The edit should still be in captures
        var captures = JsonSerializer.Deserialize<List<Dictionary<string, string>>>(
            context.Variables["_capturedToolCalls"]?.ToString() ?? "[]");
        Assert.Single(captures!);
        Assert.Equal("file-edit", captures[0]["toolId"]);
    }

    // ---- CaptureShellExecuteBlockExecutor ----

    [Fact]
    public async Task CaptureShellExecute_CapturesCommand()
    {
        var executor = new CaptureShellExecuteBlockExecutor();
        var block = CreateBlock("test", "capture-shell-execute");
        var context = CreateContext();

        var result = await executor.ExecuteAsync(block, context, new Dictionary<string, object>
        {
            ["command"] = "npm test",
            ["workingDir"] = "/app"
        });

        Assert.True(result.Success);
        Assert.Equal("$ npm test\n(captured — not executed)", result.Outputs["result"]?.ToString());

        var captures = JsonSerializer.Deserialize<List<Dictionary<string, string>>>(
            context.Variables["_capturedToolCalls"]?.ToString() ?? "[]");
        Assert.Single(captures!);
        Assert.Equal("shell-execute", captures[0]["toolId"]);
        Assert.Equal("npm test", captures[0]["command"]);
    }

    // ---- ToolDispatcherBlockExecutor._toolMapping ----

    [Fact]
    public void ResolveMappedToolId_WithDictionaryStringObject_ReturnsMapping()
    {
        var mapping = new Dictionary<string, object>
        {
            ["file-write"] = "capture-file-write",
            ["file-read"] = "capture-file-read"
        };

        var result = ToolDispatcherBlockExecutor.ResolveMappedToolId(mapping, "file-write");
        Assert.Equal("capture-file-write", result);
    }

    [Fact]
    public void ResolveMappedToolId_WithDictionaryStringString_ReturnsMapping()
    {
        var mapping = new Dictionary<string, string>
        {
            ["file-write"] = "capture-file-write"
        };

        var result = ToolDispatcherBlockExecutor.ResolveMappedToolId(mapping, "file-write");
        Assert.Equal("capture-file-write", result);
    }

    [Fact]
    public void ResolveMappedToolId_WithJsonString_ReturnsMapping()
    {
        var json = JsonSerializer.Serialize(new Dictionary<string, string>
        {
            ["file-write"] = "capture-file-write",
            ["shell-execute"] = "capture-shell-execute"
        });

        var result = ToolDispatcherBlockExecutor.ResolveMappedToolId(json, "shell-execute");
        Assert.Equal("capture-shell-execute", result);
    }

    [Fact]
    public void ResolveMappedToolId_NoMappingForTool_ReturnsNull()
    {
        var mapping = new Dictionary<string, object>
        {
            ["file-write"] = "capture-file-write"
        };

        var result = ToolDispatcherBlockExecutor.ResolveMappedToolId(mapping, "directory-list");
        Assert.Null(result);
    }

    [Fact]
    public void ResolveMappedToolId_EmptyString_ReturnsNull()
    {
        var result = ToolDispatcherBlockExecutor.ResolveMappedToolId("", "file-write");
        Assert.Null(result);
    }

    [Fact]
    public void ResolveMappedToolId_InvalidJson_ReturnsNull()
    {
        var result = ToolDispatcherBlockExecutor.ResolveMappedToolId("not-json", "file-write");
        Assert.Null(result);
    }

    // ---- ContractTestRunner.EvaluateCheck tool-call with _capturedToolCalls ----

    [Fact]
    public void EvaluateCheck_ToolCall_FindsInCapturedToolCalls()
    {
        var captures = JsonSerializer.Serialize(new[]
        {
            new Dictionary<string, string>
            {
                ["toolId"] = "file-write",
                ["path"] = "block.json",
                ["content"] = "{}"
            }
        });

        var checkJson = JsonSerializer.Serialize(new { type = "tool-call", toolName = "file-write" });
        using var doc = JsonDocument.Parse(checkJson);

        var blockOutputs = new Dictionary<string, object>
        {
            ["_capturedToolCalls"] = captures
        };

        var (passed, checkType, failureReason) = ContractTestRunner.EvaluateCheck(
            doc.RootElement, "some response without tool name", blockOutputs);

        Assert.True(passed);
        Assert.Equal("tool-call", checkType);
        Assert.Null(failureReason);
    }

    [Fact]
    public void EvaluateCheck_ToolCall_NotFoundAnywhere_Fails()
    {
        var checkJson = JsonSerializer.Serialize(new { type = "tool-call", toolName = "file-write" });
        using var doc = JsonDocument.Parse(checkJson);

        var blockOutputs = new Dictionary<string, object>();

        var (passed, checkType, failureReason) = ContractTestRunner.EvaluateCheck(
            doc.RootElement, "nothing here", blockOutputs);

        Assert.False(passed);
        Assert.Contains("file-write", failureReason);
    }
}
