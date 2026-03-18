#nullable enable

using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.BlockExecutors;
using Moq;
using Xunit;

namespace Maestro.Execution.Tests;

/// <summary>
/// Phase 62-C: Tests for ToolSchemaGenerator — generates {{available_tools}} for agent system prompts.
/// Validates: wildcard discovery, restricted lists, non-existent tools, missing inputs,
/// output format, step-complete exclusion, and internal block filtering.
/// </summary>
public class ToolSchemaGeneratorTests
{
    private static BlockDefinition CreateToolBlock(string id, string blockType = "tool", string description = "")
    {
        var block = BlockDefinition.Create(id, id, blockType);
        block.SetDescription(string.IsNullOrEmpty(description) ? $"Tool: {id}" : description);
        return block;
    }

    private static BlockDefinition CreateToolBlockWithPath(string id, string path, string blockType = "tool", string description = "")
    {
        var block = BlockDefinition.Create(id, id, blockType);
        block.SetDescription(string.IsNullOrEmpty(description) ? $"Tool: {id}" : description);
        block.UpdateConfig(new Dictionary<string, object> { ["path"] = path });
        return block;
    }

    // ═══════════════════════════════════════════════════════════
    // Test 1: Wildcard generates all agent-facing tools
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public async Task GenerateToolsSection_Wildcard_IncludesAgentFacingTools()
    {
        var mockDiscovery = new Mock<IBlockDiscoveryService>();
        mockDiscovery.Setup(d => d.DiscoverAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<BlockDefinition>
            {
                CreateToolBlock("file-read", "file-read", "Reads a file"),
                CreateToolBlock("file-write", "file-write", "Writes a file"),
                CreateToolBlock("shell-execute", "shell", "Executes a shell command"),
                CreateToolBlock("directory-list", "tool", "Lists directory contents"),
            });

        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var result = await generator.GenerateToolsSectionAsync(new List<string> { "*" });

        Assert.Contains("file-read", result);
        Assert.Contains("file-write", result);
        Assert.Contains("shell-execute", result);
        Assert.Contains("directory-list", result);
    }

    // ═══════════════════════════════════════════════════════════
    // Test 2: Restricted list generates only listed tools
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public async Task GenerateToolsSection_RestrictedList_OnlyIncludesListedTools()
    {
        var mockDiscovery = new Mock<IBlockDiscoveryService>();
        mockDiscovery.Setup(d => d.GetByIdAsync("file-read", It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateToolBlock("file-read", "file-read", "Reads a file"));
        mockDiscovery.Setup(d => d.GetByIdAsync("shell-execute", It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateToolBlock("shell-execute", "shell", "Executes a command"));

        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var result = await generator.GenerateToolsSectionAsync(
            new List<string> { "file-read", "shell-execute" });

        Assert.Contains("file-read", result);
        Assert.Contains("shell-execute", result);
        Assert.DoesNotContain("file-write", result);
        Assert.DoesNotContain("directory-list", result);
    }

    // ═══════════════════════════════════════════════════════════
    // Test 3: Non-existent tool is ignored without crash
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public async Task GenerateToolsSection_NonExistentTool_IgnoredWithoutCrash()
    {
        var mockDiscovery = new Mock<IBlockDiscoveryService>();
        mockDiscovery.Setup(d => d.GetByIdAsync("file-read", It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateToolBlock("file-read", "file-read", "Reads a file"));
        mockDiscovery.Setup(d => d.GetByIdAsync("nonexistent-tool", It.IsAny<CancellationToken>()))
            .ReturnsAsync((BlockDefinition?)null);

        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var result = await generator.GenerateToolsSectionAsync(
            new List<string> { "file-read", "nonexistent-tool" });

        Assert.Contains("file-read", result);
        Assert.DoesNotContain("nonexistent-tool", result);
    }

    // ═══════════════════════════════════════════════════════════
    // Test 4: Block without inputs generates minimal entry
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public async Task GenerateToolsSection_BlockWithoutInputs_GeneratesMinimalEntry()
    {
        var mockDiscovery = new Mock<IBlockDiscoveryService>();
        // Block with no path (so no block.json to read) — should still generate a minimal entry
        mockDiscovery.Setup(d => d.GetByIdAsync("simple-tool", It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateToolBlock("simple-tool", "tool", "A simple tool with no inputs"));

        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var result = await generator.GenerateToolsSectionAsync(
            new List<string> { "simple-tool" });

        Assert.Contains("### simple-tool", result);
        Assert.Contains("A simple tool with no inputs", result);
        Assert.Contains("\"args\": {}", result);
    }

    // ═══════════════════════════════════════════════════════════
    // Test 5: Format contains name, description, JSON schema
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public async Task GenerateToolsSection_Format_ContainsNameDescriptionSchema()
    {
        var mockDiscovery = new Mock<IBlockDiscoveryService>();
        mockDiscovery.Setup(d => d.GetByIdAsync("file-read", It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateToolBlock("file-read", "file-read", "Reads the contents of a file"));

        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var result = await generator.GenerateToolsSectionAsync(
            new List<string> { "file-read" });

        // Header
        Assert.Contains("You have access to these tools", result);
        // Tool name as header
        Assert.Contains("### file-read", result);
        // Description
        Assert.Contains("Reads the contents of a file", result);
        // JSON schema block
        Assert.Contains("```json", result);
        Assert.Contains("\"tool\": \"file-read\"", result);
    }

    // ═══════════════════════════════════════════════════════════
    // Test 6: step-complete is excluded from generated output
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public async Task GenerateToolsSection_StepCompleteExcluded()
    {
        var mockDiscovery = new Mock<IBlockDiscoveryService>();
        mockDiscovery.Setup(d => d.DiscoverAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<BlockDefinition>
            {
                CreateToolBlock("file-read", "file-read", "Reads a file"),
                CreateToolBlock("step-complete", "step-complete", "Signals completion"),
            });

        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var result = await generator.GenerateToolsSectionAsync(new List<string> { "*" });

        Assert.Contains("file-read", result);
        Assert.DoesNotContain("### step-complete", result);
    }

    // ═══════════════════════════════════════════════════════════
    // Test 7: Internal infrastructure blocks are excluded
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public async Task GenerateToolsSection_Wildcard_ExcludesInternalBlocks()
    {
        var mockDiscovery = new Mock<IBlockDiscoveryService>();
        mockDiscovery.Setup(d => d.DiscoverAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<BlockDefinition>
            {
                CreateToolBlock("file-read", "file-read", "Reads a file"),
                CreateToolBlock("conversation-read", "conversation-read", "Internal"),
                CreateToolBlock("conversation-append", "conversation-append", "Internal"),
                CreateToolBlock("tool-dispatcher", "tool-dispatcher", "Internal"),
                CreateToolBlock("response-parser", "response-parser", "Internal"),
                CreateToolBlock("inference", "inference", "Internal"),
                CreateToolBlock("message-builder", "message-builder", "Internal"),
            });

        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var result = await generator.GenerateToolsSectionAsync(new List<string> { "*" });

        Assert.Contains("file-read", result);
        Assert.DoesNotContain("### conversation-read", result);
        Assert.DoesNotContain("### conversation-append", result);
        Assert.DoesNotContain("### tool-dispatcher", result);
        Assert.DoesNotContain("### response-parser", result);
        Assert.DoesNotContain("### inference", result);
        Assert.DoesNotContain("### message-builder", result);
    }

    // ═══════════════════════════════════════════════════════════
    // Test 8: Capture blocks are excluded
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public async Task GenerateToolsSection_Wildcard_ExcludesCaptureBlocks()
    {
        var mockDiscovery = new Mock<IBlockDiscoveryService>();
        mockDiscovery.Setup(d => d.DiscoverAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<BlockDefinition>
            {
                CreateToolBlock("file-write", "file-write", "Writes a file"),
                CreateToolBlock("capture-file-write", "capture-file-write", "Mock capture"),
                CreateToolBlock("capture-file-read", "capture-file-read", "Mock capture"),
                CreateToolBlock("capture-shell-execute", "capture-shell-execute", "Mock capture"),
            });

        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var result = await generator.GenerateToolsSectionAsync(new List<string> { "*" });

        Assert.Contains("file-write", result);
        Assert.DoesNotContain("### capture-file-write", result);
        Assert.DoesNotContain("### capture-file-read", result);
        Assert.DoesNotContain("### capture-shell-execute", result);
    }

    // ═══════════════════════════════════════════════════════════
    // Test 9: Agents and workflows are excluded from tool list
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public async Task GenerateToolsSection_Wildcard_ExcludesAgentsAndWorkflows()
    {
        var mockDiscovery = new Mock<IBlockDiscoveryService>();
        mockDiscovery.Setup(d => d.DiscoverAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<BlockDefinition>
            {
                CreateToolBlock("file-read", "file-read", "Reads a file"),
                CreateToolBlock("agent-creator", "agent", "An agent block"),
                CreateToolBlock("dev-workflow", "workflow", "A workflow block"),
            });

        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var result = await generator.GenerateToolsSectionAsync(new List<string> { "*" });

        Assert.Contains("file-read", result);
        Assert.DoesNotContain("### agent-creator", result);
        Assert.DoesNotContain("### dev-workflow", result);
    }

    // ═══════════════════════════════════════════════════════════
    // Test 10: step-complete excluded even when explicitly in allowed list
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public async Task GenerateToolsSection_StepCompleteInAllowedList_StillExcluded()
    {
        var mockDiscovery = new Mock<IBlockDiscoveryService>();
        mockDiscovery.Setup(d => d.GetByIdAsync("file-read", It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateToolBlock("file-read", "file-read", "Reads a file"));
        // step-complete should never even be fetched due to InternalBlockIds filter
        mockDiscovery.Setup(d => d.GetByIdAsync("step-complete", It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateToolBlock("step-complete", "step-complete", "Signals completion"));

        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var result = await generator.GenerateToolsSectionAsync(
            new List<string> { "file-read", "step-complete" });

        Assert.Contains("file-read", result);
        Assert.DoesNotContain("### step-complete", result);
    }

    // ═══════════════════════════════════════════════════════════
    // Test 11: Empty allowed blocks produces "No tools available"
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public async Task GenerateToolsSection_EmptyAllowedBlocks_ReturnsNoTools()
    {
        var mockDiscovery = new Mock<IBlockDiscoveryService>();
        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var result = await generator.GenerateToolsSectionAsync(new List<string>());

        Assert.Contains("No tools available", result);
    }

    // ═══════════════════════════════════════════════════════════
    // Test 12: Tool with inputs from block.json on disk
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public async Task GenerateToolsSection_WithBlockJsonOnDisk_ReadsInputSchema()
    {
        // Create a temp directory with a block.json
        var tempDir = Path.Combine(Path.GetTempPath(), "maestro-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        try
        {
            var blockJson = @"{
                ""id"": ""test-tool"",
                ""name"": ""Test Tool"",
                ""blockType"": ""tool"",
                ""description"": ""A test tool"",
                ""inputs"": [
                    {""id"": ""path"", ""type"": ""string"", ""required"": true, ""description"": ""File path""},
                    {""id"": ""content"", ""type"": ""string"", ""required"": false, ""description"": ""Content""}
                ]
            }";
            File.WriteAllText(Path.Combine(tempDir, "test-tool.tool.block.json"), blockJson);

            var mockDiscovery = new Mock<IBlockDiscoveryService>();
            mockDiscovery.Setup(d => d.GetByIdAsync("test-tool", It.IsAny<CancellationToken>()))
                .ReturnsAsync(CreateToolBlockWithPath("test-tool", tempDir, "tool", "A test tool"));

            var generator = new ToolSchemaGenerator(mockDiscovery.Object);
            var result = await generator.GenerateToolsSectionAsync(
                new List<string> { "test-tool" });

            Assert.Contains("### test-tool", result);
            Assert.Contains("\"path\":", result);
            Assert.Contains("<string, required>", result);
            Assert.Contains("File path", result);
        }
        finally
        {
            Directory.Delete(tempDir, true);
        }
    }
}
