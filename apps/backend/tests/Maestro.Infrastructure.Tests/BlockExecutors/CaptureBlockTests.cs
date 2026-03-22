using System.Collections.Generic;
using System.IO;
using System.Linq;
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
        Assert.Contains("File written successfully: test/output.json", result.Outputs["result"]?.ToString());

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

    // ---- Phase 64-C: EvaluateCheck json-parseable with _capturedToolCalls ----

    [Fact]
    public void EvaluateCheck_JsonParseable_FindsInCapturedContent()
    {
        var captures = JsonSerializer.Serialize(new[]
        {
            new { toolId = "file-write", path = "test.block.json", content = "{\"id\": \"test\", \"blockType\": \"agent\"}" }
        });
        var checkJson = JsonSerializer.Serialize(new { type = "json-parseable" });
        using var doc = JsonDocument.Parse(checkJson);

        var blockOutputs = new Dictionary<string, object>
        {
            ["_capturedToolCalls"] = captures
        };

        var (passed, checkType, _) = ContractTestRunner.EvaluateCheck(
            doc.RootElement, "I created the block.json for you.", blockOutputs);

        Assert.True(passed);
        Assert.Equal("json-parseable", checkType);
    }

    [Fact]
    public void EvaluateCheck_JsonParseable_FailsWhenNoCapturedJson()
    {
        var checkJson = JsonSerializer.Serialize(new { type = "json-parseable" });
        using var doc = JsonDocument.Parse(checkJson);

        var blockOutputs = new Dictionary<string, object>();

        var (passed, _, failureReason) = ContractTestRunner.EvaluateCheck(
            doc.RootElement, "Done, the file has been created.", blockOutputs);

        Assert.False(passed);
        Assert.Contains("No valid JSON", failureReason);
    }

    // ---- Phase 64-C: EvaluateCheck contains-all with _capturedToolCalls ----

    [Fact]
    public void EvaluateCheck_ContainsAll_FindsInCapturedToolCalls()
    {
        var captures = JsonSerializer.Serialize(new[]
        {
            new { toolId = "file-write", path = "block.json",
                  content = "{\"capabilities\": [\"conversation\", \"tool-calling\"]}" }
        });
        var checkJson = JsonSerializer.Serialize(new
        {
            type = "contains-all",
            values = new[] { "capabilities", "conversation", "tool-calling" }
        });
        using var doc = JsonDocument.Parse(checkJson);

        var blockOutputs = new Dictionary<string, object>
        {
            ["_capturedToolCalls"] = captures
        };

        var (passed, checkType, _) = ContractTestRunner.EvaluateCheck(
            doc.RootElement, "Block created successfully.", blockOutputs);

        Assert.True(passed);
        Assert.Equal("contains-all", checkType);
    }

    [Fact]
    public void EvaluateCheck_ContainsAll_PartialMatch_Fails()
    {
        var captures = JsonSerializer.Serialize(new[]
        {
            new { toolId = "file-write", path = "block.json",
                  content = "{\"capabilities\": [\"conversation\"]}" }
        });
        var checkJson = JsonSerializer.Serialize(new
        {
            type = "contains-all",
            values = new[] { "capabilities", "conversation", "tool-calling" }
        });
        using var doc = JsonDocument.Parse(checkJson);

        var blockOutputs = new Dictionary<string, object>
        {
            ["_capturedToolCalls"] = captures
        };

        var (passed, _, failureReason) = ContractTestRunner.EvaluateCheck(
            doc.RootElement, "Block created.", blockOutputs);

        Assert.False(passed);
        Assert.Contains("tool-calling", failureReason);
    }

    // ---- Phase 64-C: EvaluateCheck contains with _capturedToolCalls ----

    [Fact]
    public void EvaluateCheck_Contains_FindsInCapturedToolCalls()
    {
        var captures = JsonSerializer.Serialize(new[]
        {
            new { toolId = "file-write", path = "prompt.md", content = "# Code Reviewer\nReview for bugs and style." }
        });
        var checkJson = JsonSerializer.Serialize(new { type = "contains", value = "bug" });
        using var doc = JsonDocument.Parse(checkJson);

        var blockOutputs = new Dictionary<string, object>
        {
            ["_capturedToolCalls"] = captures
        };

        var (passed, _, _) = ContractTestRunner.EvaluateCheck(
            doc.RootElement, "System prompt written.", blockOutputs);

        Assert.True(passed);
    }

    // ---- CaptureGenericBlockExecutor ----

    [Fact]
    public async Task CaptureGeneric_RecordsToolCallWithOriginalToolId()
    {
        var executor = new CaptureGenericBlockExecutor();
        var block = CreateBlock("capture-generic", "capture-generic");
        var context = CreateContext();
        // Simulate ToolDispatcherBlockExecutor setting the original tool ID
        context.Variables["_lastDispatchedToolId"] = "session-create";

        var inputs = new Dictionary<string, object>
        {
            ["name"] = "My Session",
            ["type"] = "project",
            ["repo"] = "/app"
        };

        var result = await executor.ExecuteAsync(block, context, inputs);

        Assert.True(result.Success);
        Assert.Contains("Tool executed successfully", result.Outputs["result"]?.ToString());

        // Verify captures are stored with the original tool name
        Assert.True(context.Variables.ContainsKey("_capturedToolCalls"));
        var captures = JsonSerializer.Deserialize<List<Dictionary<string, string>>>(
            context.Variables["_capturedToolCalls"]?.ToString() ?? "[]");
        Assert.NotNull(captures);
        Assert.Single(captures!);
        Assert.Equal("session-create", captures[0]["toolId"]);
        Assert.Contains("My Session", captures[0]["args"]);
    }

    [Fact]
    public async Task CaptureGeneric_NoOriginalToolId_UsesUnknown()
    {
        var executor = new CaptureGenericBlockExecutor();
        var block = CreateBlock("capture-generic", "capture-generic");
        var context = CreateContext();
        // Don't set _lastDispatchedToolId — should fall back to "unknown"

        var inputs = new Dictionary<string, object>
        {
            ["query"] = "list all blocks"
        };

        var result = await executor.ExecuteAsync(block, context, inputs);

        Assert.True(result.Success);

        var captures = JsonSerializer.Deserialize<List<Dictionary<string, string>>>(
            context.Variables["_capturedToolCalls"]?.ToString() ?? "[]");
        Assert.Single(captures!);
        Assert.Equal("unknown", captures[0]["toolId"]);
    }

    [Fact]
    public async Task CaptureGeneric_MultipleToolCalls_AppendsAll()
    {
        var executor = new CaptureGenericBlockExecutor();
        var block = CreateBlock("capture-generic", "capture-generic");
        var context = CreateContext();

        // First call: workspace-list
        context.Variables["_lastDispatchedToolId"] = "workspace-list";
        await executor.ExecuteAsync(block, context, new Dictionary<string, object>());

        // Second call: session-create
        context.Variables["_lastDispatchedToolId"] = "session-create";
        await executor.ExecuteAsync(block, context, new Dictionary<string, object>
        {
            ["name"] = "Test Session"
        });

        var captures = JsonSerializer.Deserialize<List<Dictionary<string, string>>>(
            context.Variables["_capturedToolCalls"]?.ToString() ?? "[]");
        Assert.Equal(2, captures!.Count);
        Assert.Equal("workspace-list", captures[0]["toolId"]);
        Assert.Equal("session-create", captures[1]["toolId"]);
    }

    // ---- SummaryValidatorBlockExecutor ----

    [Fact]
    public async Task SummaryValidator_RejectsJsonArray()
    {
        var executor = new SummaryValidatorBlockExecutor();
        var block = CreateBlock("summary-validator", "summary-validator");
        var context = CreateContext();
        var inputs = new Dictionary<string, object> { ["summary"] = "[\"hello\",\"hi\",\"query\"]" };

        var result = await executor.ExecuteAsync(block, context, inputs);
        Assert.Equal("false", result.Outputs["valid"]?.ToString());
    }

    [Fact]
    public async Task SummaryValidator_AcceptsTextSummary()
    {
        var executor = new SummaryValidatorBlockExecutor();
        var block = CreateBlock("summary-validator", "summary-validator");
        var context = CreateContext();
        var inputs = new Dictionary<string, object> { ["summary"] = "Generated 12 tests across 4 features for the maestro-assistant contract." };

        var result = await executor.ExecuteAsync(block, context, inputs);
        Assert.Equal("true", result.Outputs["valid"]?.ToString());
    }

    [Fact]
    public async Task SummaryValidator_AcceptsLongJsonArray()
    {
        var executor = new SummaryValidatorBlockExecutor();
        var block = CreateBlock("summary-validator", "summary-validator");
        var context = CreateContext();
        // A long JSON array (>300 chars) might be a legitimate structured response
        var longArray = "[" + string.Join(",", Enumerable.Range(0, 50).Select(i => $"\"item-{i}-with-long-description-text\"")) + "]";
        var inputs = new Dictionary<string, object> { ["summary"] = longArray };

        var result = await executor.ExecuteAsync(block, context, inputs);
        Assert.Equal("true", result.Outputs["valid"]?.ToString());
    }

    [Fact]
    public void EvaluateCheck_ToolCall_FindsGenericCapturedTool()
    {
        // Verify that the tool-call check type finds tools captured by capture-generic
        var captures = JsonSerializer.Serialize(new[]
        {
            new Dictionary<string, string>
            {
                ["toolId"] = "session-create",
                ["args"] = "{\"name\":\"Test\"}",
                ["timestamp"] = "2026-03-18T00:00:00Z"
            }
        });

        var checkJson = JsonSerializer.Serialize(new { type = "tool-call", toolName = "session-create" });
        using var doc = JsonDocument.Parse(checkJson);

        var blockOutputs = new Dictionary<string, object>
        {
            ["_capturedToolCalls"] = captures
        };

        var (passed, checkType, failureReason) = ContractTestRunner.EvaluateCheck(
            doc.RootElement, "response without tool name", blockOutputs);

        Assert.True(passed);
        Assert.Equal("tool-call", checkType);
        Assert.Null(failureReason);
    }

    // ---- ValidateContractBlockExecutor ----

    [Fact]
    public async Task ValidateContract_ValidContract_ReturnsTrue()
    {
        var executor = new ValidateContractBlockExecutor();
        var block = CreateBlock("validate-contract", "validate-contract");
        var context = CreateContext();
        var contract = JsonSerializer.Serialize(new
        {
            id = "test-contract",
            requiredCapabilities = new[] { "conversation" },
            minimumFitness = 0.5,
            features = new Dictionary<string, object>
            {
                ["greeting"] = new { weight = 0.6, minimumScore = 0.7, tests = new[] { new { id = "t1", prompt = "Hello", check = new { type = "non-empty" } } } },
                ["math"] = new { weight = 0.4, minimumScore = 0.5, tests = new[] { new { id = "t2", prompt = "2+2?", check = new { type = "contains", value = "4" } } } }
            }
        });
        var inputs = new Dictionary<string, object> { ["contractJson"] = contract };

        var result = await executor.ExecuteAsync(block, context, inputs);
        Assert.Equal("true", result.Outputs["valid"]?.ToString());
    }

    [Fact]
    public async Task ValidateContract_MissingFeatures_ReturnsFalse()
    {
        var executor = new ValidateContractBlockExecutor();
        var block = CreateBlock("validate-contract", "validate-contract");
        var context = CreateContext();
        var contract = JsonSerializer.Serialize(new { id = "bad" });
        var inputs = new Dictionary<string, object> { ["contractJson"] = contract };

        var result = await executor.ExecuteAsync(block, context, inputs);
        Assert.Equal("false", result.Outputs["valid"]?.ToString());
        Assert.Contains("features", result.Outputs["errors"]?.ToString());
    }

    [Fact]
    public async Task ValidateContract_WeightsDontSumToOne_Error()
    {
        var executor = new ValidateContractBlockExecutor();
        var block = CreateBlock("validate-contract", "validate-contract");
        var context = CreateContext();
        var contract = JsonSerializer.Serialize(new
        {
            id = "test",
            requiredCapabilities = new[] { "conversation" },
            minimumFitness = 0.5,
            features = new Dictionary<string, object>
            {
                ["a"] = new { weight = 0.3, tests = new[] { new { id = "t1", prompt = "Hi", check = new { type = "non-empty" } } } },
                ["b"] = new { weight = 0.3, tests = new[] { new { id = "t2", prompt = "Hey", check = new { type = "non-empty" } } } }
            }
        });
        var inputs = new Dictionary<string, object> { ["contractJson"] = contract };

        var result = await executor.ExecuteAsync(block, context, inputs);
        Assert.Equal("false", result.Outputs["valid"]?.ToString());
        Assert.Contains("weights sum", result.Outputs["errors"]?.ToString()?.ToLower());
    }

    // ---- ValidateTestSuiteBlockExecutor ----

    [Fact]
    public async Task ValidateTestSuite_ValidSuite_ReturnsTrue()
    {
        var executor = new ValidateTestSuiteBlockExecutor();
        var block = CreateBlock("validate-test-suite", "validate-test-suite");
        var context = CreateContext();
        var suite = JsonSerializer.Serialize(new
        {
            contractId = "test",
            totalTests = 4,
            features = new Dictionary<string, object>
            {
                ["greeting"] = new { tests = new object[] {
                    new { id = "t1", prompt = "Hi", check = new { type = "non-empty" } },
                    new { id = "t2", prompt = "Hey", check = new { type = "contains", value = "hello" } }
                }},
                ["math"] = new { tests = new object[] {
                    new { id = "t3", prompt = "2+2", check = new { type = "contains", value = "4" } },
                    new { id = "t4", prompt = "Format", check = new { type = "json-parseable" } }
                }}
            }
        });
        var inputs = new Dictionary<string, object> { ["testSuiteJson"] = suite };

        var result = await executor.ExecuteAsync(block, context, inputs);
        Assert.Equal("true", result.Outputs["valid"]?.ToString());
    }

    [Fact]
    public async Task ValidateTestSuite_MissingFeatureCoverage_Error()
    {
        var executor = new ValidateTestSuiteBlockExecutor();
        var block = CreateBlock("validate-test-suite", "validate-test-suite");
        var context = CreateContext();
        var suite = JsonSerializer.Serialize(new
        {
            contractId = "test",
            totalTests = 2,
            features = new Dictionary<string, object>
            {
                ["greeting"] = new { tests = new object[] {
                    new { id = "t1", prompt = "Hi", check = new { type = "non-empty" } },
                    new { id = "t2", prompt = "Hey", check = new { type = "contains", value = "hi" } }
                }}
            }
        });
        var contract = JsonSerializer.Serialize(new
        {
            features = new Dictionary<string, object>
            {
                ["greeting"] = new { },
                ["math"] = new { }
            }
        });
        var inputs = new Dictionary<string, object> { ["testSuiteJson"] = suite, ["contractJson"] = contract };

        var result = await executor.ExecuteAsync(block, context, inputs);
        Assert.Equal("false", result.Outputs["valid"]?.ToString());
        Assert.Contains("math", result.Outputs["errors"]?.ToString());
    }

    // ---- ResponseParserBlockExecutor: JSON array → retry ----

    [Fact]
    public async Task ResponseParser_ShortJsonArray_ClassifiedAsRetry()
    {
        var executor = new ResponseParserBlockExecutor();
        var block = CreateBlock("response-parser", "response-parser");
        var context = CreateContext();
        var inputs = new Dictionary<string, object>
        {
            ["rawResponse"] = "[\"query\"]"
        };

        var result = await executor.ExecuteAsync(block, context, inputs);

        Assert.Equal("retry", result.Outputs["type"]?.ToString());
    }

    [Fact]
    public async Task ResponseParser_ConversationalText_ClassifiedAsText()
    {
        var executor = new ResponseParserBlockExecutor();
        var block = CreateBlock("response-parser", "response-parser");
        var context = CreateContext();
        var inputs = new Dictionary<string, object>
        {
            ["rawResponse"] = "The best check type for tool verification is `tool-call`. Use it when you want to verify the agent calls a specific tool."
        };

        var result = await executor.ExecuteAsync(block, context, inputs);

        Assert.Equal("text", result.Outputs["type"]?.ToString());
    }
}
