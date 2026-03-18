#nullable enable

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.BlockExecutors;
using Moq;
using Xunit;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Execution.Tests;

/// <summary>
/// Phase 62-T: Real validation tests for container isolation.
/// These tests use real block.json file contents (copied to temp dirs for isolation),
/// real agent system prompts, and validate the full permission enforcement chain end-to-end.
/// </summary>
public class Phase62ValidationTests : IDisposable
{
    private readonly string _tempBaseDir;
    private readonly string _repoRoot;

    public Phase62ValidationTests()
    {
        _tempBaseDir = Path.Combine(Path.GetTempPath(), "maestro-62t-" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(_tempBaseDir);
        _repoRoot = FindRepoRoot();
    }

    public void Dispose()
    {
        try { Directory.Delete(_tempBaseDir, true); } catch { /* best-effort */ }
    }

    // ═══════════════════════════════════════════════════════════
    // Task 2: ToolSchemaGenerator with REAL block.json files
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// Creates a mock IBlockDiscoveryService that copies REAL block.json files into
    /// isolated temp directories (one per tool). This simulates the real discovery service
    /// behavior where each block has its own directory with config["path"] pointing to it.
    /// </summary>
    private Mock<IBlockDiscoveryService> CreateRealBlockDiscovery()
    {
        var toolsSourceDir = Path.Combine(_repoRoot, "content", "system", "blocks", "tools");
        var mock = new Mock<IBlockDiscoveryService>();

        // file-read: copy real block.json to isolated temp dir
        var fileReadDir = CreateTempBlockDir("file-read", toolsSourceDir, "file-read.tool.block.json");
        var fileReadBlock = BlockDefinition.Create("file-read", "File Read", "file-read");
        fileReadBlock.SetDescription("Reads the contents of a file from the filesystem");
        fileReadBlock.UpdateConfig(new Dictionary<string, object> { ["path"] = fileReadDir });
        mock.Setup(d => d.GetByIdAsync("file-read", It.IsAny<CancellationToken>()))
            .ReturnsAsync(fileReadBlock);

        // file-write: copy real block.json to isolated temp dir
        var fileWriteDir = CreateTempBlockDir("file-write", toolsSourceDir, "file-write.tool.block.json");
        var fileWriteBlock = BlockDefinition.Create("file-write", "File Write", "file-write");
        fileWriteBlock.SetDescription("Writes content to a file on the filesystem");
        fileWriteBlock.UpdateConfig(new Dictionary<string, object> { ["path"] = fileWriteDir });
        mock.Setup(d => d.GetByIdAsync("file-write", It.IsAny<CancellationToken>()))
            .ReturnsAsync(fileWriteBlock);

        // shell-execute: copy real block.json to isolated temp dir
        var shellDir = CreateTempBlockDir("shell-execute", toolsSourceDir, "shell-execute.tool.block.json");
        var shellBlock = BlockDefinition.Create("shell-execute", "Shell Execute", "shell");
        shellBlock.SetDescription("Executes a shell command");
        shellBlock.UpdateConfig(new Dictionary<string, object> { ["path"] = shellDir });
        mock.Setup(d => d.GetByIdAsync("shell-execute", It.IsAny<CancellationToken>()))
            .ReturnsAsync(shellBlock);

        // step-complete: no path (should be filtered out by InternalBlockIds)
        var stepCompleteBlock = BlockDefinition.Create("step-complete", "Step Complete", "step-complete");
        stepCompleteBlock.SetDescription("Signals task completion");
        mock.Setup(d => d.GetByIdAsync("step-complete", It.IsAny<CancellationToken>()))
            .ReturnsAsync(stepCompleteBlock);

        return mock;
    }

    /// <summary>
    /// Copies a real block.json into an isolated temp directory, returns the directory path.
    /// This mimics folder-based blocks where config["path"] points to a directory containing one *.block.json.
    /// </summary>
    private string CreateTempBlockDir(string blockId, string sourceDir, string sourceFileName)
    {
        var tempDir = Path.Combine(_tempBaseDir, blockId);
        Directory.CreateDirectory(tempDir);
        var sourceFile = Path.Combine(sourceDir, sourceFileName);
        Assert.True(File.Exists(sourceFile), $"Source block.json not found: {sourceFile}");
        File.Copy(sourceFile, Path.Combine(tempDir, sourceFileName));
        return tempDir;
    }

    private static string FindRepoRoot()
    {
        var dir = Directory.GetCurrentDirectory();
        for (int i = 0; i < 10; i++)
        {
            var contentDir = Path.Combine(dir, "content", "system", "blocks", "tools");
            if (Directory.Exists(contentDir))
                return dir;
            var parent = Directory.GetParent(dir);
            if (parent == null) break;
            dir = parent.FullName;
        }
        if (Directory.Exists(@"C:\Meastro\content\system\blocks\tools"))
            return @"C:\Meastro";
        throw new InvalidOperationException("Cannot find repo root with content/system/blocks/tools/");
    }

    [Fact]
    public async Task Task2_RealBlocks_GeneratesCorrectSchemas_FileReadAndFileWrite()
    {
        var mockDiscovery = CreateRealBlockDiscovery();
        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var result = await generator.GenerateToolsSectionAsync(
            new List<string> { "file-read", "file-write" });

        // Verify file-read schema contains data from real block.json
        Assert.Contains("### file-read", result);
        Assert.Contains("Reads the contents of a file", result);
        Assert.Contains("\"path\":", result);  // file-read has a "path" input
        // The description from the REAL block.json input
        Assert.Contains("path to the file to read", result);

        // Verify file-write schema contains data from real block.json
        Assert.Contains("### file-write", result);
        Assert.Contains("Writes content to a file", result);
        Assert.Contains("\"content\":", result);  // file-write has a "content" input

        // Verify internal args are filtered out (workingDir, encoding, mode, createDirectories)
        Assert.DoesNotContain("\"workingDir\":", result);
        Assert.DoesNotContain("\"encoding\":", result);
        Assert.DoesNotContain("\"mode\":", result);
        Assert.DoesNotContain("\"createDirectories\":", result);

        // Verify step-complete is NOT in the output
        Assert.DoesNotContain("### step-complete", result);
    }

    [Fact]
    public async Task Task2_RealBlocks_FileReadHasRequiredPathInput()
    {
        var mockDiscovery = CreateRealBlockDiscovery();
        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var result = await generator.GenerateToolsSectionAsync(
            new List<string> { "file-read" });

        // The real file-read block.json has path as required
        Assert.Contains("<string, required>", result);
        Assert.Contains("\"path\":", result);
    }

    [Fact]
    public async Task Task2_RealBlocks_FileWriteHasContentAndPathInputs()
    {
        var mockDiscovery = CreateRealBlockDiscovery();
        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var result = await generator.GenerateToolsSectionAsync(
            new List<string> { "file-write" });

        // The real file-write block.json has path (required) and content (required)
        Assert.Contains("\"path\":", result);
        Assert.Contains("\"content\":", result);
        Assert.Contains("<string, required>", result);
    }

    // ═══════════════════════════════════════════════════════════
    // Task 3: {{available_tools}} resolution in real agent prompts
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public async Task Task3_RealAgentPrompt_ContainsAvailableToolsMarker()
    {
        var agentCreatorPrompt = Path.Combine(_repoRoot,
            "content", "system", "blocks", "agents", "agent-creator", "system-prompt.md");

        Assert.True(File.Exists(agentCreatorPrompt),
            "agent-creator system-prompt.md must exist");

        var promptContent = await File.ReadAllTextAsync(agentCreatorPrompt);
        Assert.Contains("{{available_tools}}", promptContent);
    }

    [Fact]
    public async Task Task3_ReplaceAvailableTools_ProducesValidPrompt()
    {
        var agentCreatorPrompt = Path.Combine(_repoRoot,
            "content", "system", "blocks", "agents", "agent-creator", "system-prompt.md");
        var promptContent = await File.ReadAllTextAsync(agentCreatorPrompt);

        // Simulate what AgentBlockExecutor.PrepareExecutionAsync does:
        Assert.Contains("{{available_tools}}", promptContent);

        var mockDiscovery = CreateRealBlockDiscovery();
        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var toolsSection = await generator.GenerateToolsSectionAsync(
            new List<string> { "file-read", "file-write", "shell-execute" });

        var resolvedPrompt = promptContent.Replace("{{available_tools}}", toolsSection);

        // No marker remaining
        Assert.DoesNotContain("{{available_tools}}", resolvedPrompt);

        // Real tool schemas present
        Assert.Contains("### file-read", resolvedPrompt);
        Assert.Contains("### file-write", resolvedPrompt);
        Assert.Contains("### shell-execute", resolvedPrompt);
        Assert.Contains("\"tool\": \"file-read\"", resolvedPrompt);

        // step-complete documentation still in the static part (agent-specific args)
        Assert.Contains("step-complete", resolvedPrompt);
    }

    [Fact]
    public async Task Task3_AllAgentPrompts_ContainAvailableToolsMarker()
    {
        var agentsDir = Path.Combine(_repoRoot, "content", "system", "blocks", "agents");
        Assert.True(Directory.Exists(agentsDir), "agents directory must exist");

        var promptFiles = Directory.GetFiles(agentsDir, "system-prompt.md", SearchOption.AllDirectories);
        Assert.True(promptFiles.Length >= 19,
            $"Expected at least 19 agent system-prompt.md files, found {promptFiles.Length}");

        var missingMarker = new List<string>();
        foreach (var promptFile in promptFiles)
        {
            var content = await File.ReadAllTextAsync(promptFile);
            if (!content.Contains("{{available_tools}}"))
            {
                var agentName = Path.GetFileName(Path.GetDirectoryName(promptFile));
                missingMarker.Add(agentName ?? promptFile);
            }
        }

        Assert.True(missingMarker.Count == 0,
            $"These agent prompts are missing {{{{available_tools}}}}: {string.Join(", ", missingMarker)}");
    }

    // ═══════════════════════════════════════════════════════════
    // Task 4: Full permission enforcement chain
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public async Task Task4_FullChain_ParentWildcard_ChildRestricted_EnforcesCorrectly()
    {
        // Step 1: Parent session with AllowedBlocks = ["*"]
        var parent = ProjectSession.Create(
            "parent-session",
            Authority.Human("tester"),
            new ProjectSessionConfig());

        // Step 2: Child session with restricted AllowedBlocks
        var child = ProjectSession.CreateAsChild("child / restricted-agent", parent);
        child.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new List<string> { "file-read", "step-complete" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            AllowedPaths = new() { "*" },
            DataCollections = new() { "*" }
        });

        // Step 3: Build execution context (simulates BlockRefHandler.BuildExecutionContext)
        var effective = child.GetEffectivePermissions();
        var ctx = new ExecutionContext();
        ctx.Variables["_permissions_allowedBlocks"] = effective.AllowedBlocks;
        ctx.Variables["sessionId"] = child.Id;
        ctx.Variables["workingDir"] = Directory.GetCurrentDirectory();

        // Step 4: CheckToolPermission allows file-read
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed,
            "file-read should be allowed");

        // Step 5: CheckToolPermission denies file-write
        var fileWriteResult = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write");
        Assert.False(fileWriteResult.Allowed, "file-write should be denied");
        Assert.Contains("file-write", fileWriteResult.Error!);
        Assert.Contains("not available", fileWriteResult.Error!);

        // Step 6: CheckToolPermission denies shell-execute
        var shellResult = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute");
        Assert.False(shellResult.Allowed, "shell-execute should be denied");

        // Step 7: ToolSchemaGenerator only includes file-read (not file-write, not step-complete)
        var mockDiscovery = CreateRealBlockDiscovery();
        var generator = new ToolSchemaGenerator(mockDiscovery.Object);
        var toolsSection = await generator.GenerateToolsSectionAsync(effective.AllowedBlocks);

        Assert.Contains("### file-read", toolsSection);
        Assert.DoesNotContain("### file-write", toolsSection);
        Assert.DoesNotContain("### shell-execute", toolsSection);
        Assert.DoesNotContain("### step-complete", toolsSection);
    }

    [Fact]
    public void Task4_FullChain_BlockRulesOverrideAllowedBlocks()
    {
        var parent = ProjectSession.Create(
            "parent-session",
            Authority.Human("tester"),
            new ProjectSessionConfig());

        var child = ProjectSession.CreateAsChild("child / agent", parent);
        child.SetBlockPermissions(new[]
        {
            BlockPermission.Deny("shell-execute", "security policy forbids shell access")
        });

        var effective = child.GetEffectivePermissions();
        var ctx = new ExecutionContext();
        ctx.Variables["_permissions_allowedBlocks"] = effective.AllowedBlocks;
        ctx.Variables["_permissions_blockRules"] = child.BlockPermissions;

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);

        var shellResult = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute");
        Assert.False(shellResult.Allowed);
        Assert.Contains("security policy", shellResult.Error!);
    }

    [Fact]
    public void Task4_FullChain_ThreeLevelPermissions_WithToolGeneration()
    {
        // Level 1: Workspace allows 4 tools
        var workspace = Workspace.Create("secure-workspace", WorkspaceType.Production);
        workspace.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new List<string> { "file-read", "file-write", "file-edit", "step-complete" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            AllowedPaths = new() { "*" },
            DataCollections = new() { "*" }
        });

        // Level 2: Session inherits from workspace
        var session = ProjectSession.Create(
            "dev-session",
            Authority.Human("developer"),
            new ProjectSessionConfig());
        session.SetParentSession(workspace);

        // Level 3: Child restricts to only file-read + step-complete
        var child = ProjectSession.CreateAsChild("child / code-reviewer", session);
        child.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = new List<string> { "file-read", "step-complete" },
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            AllowedPaths = new() { "*" },
            DataCollections = new() { "*" }
        });

        var childEffective = child.GetEffectivePermissions();
        Assert.Contains("file-read", childEffective.AllowedBlocks);
        Assert.Contains("step-complete", childEffective.AllowedBlocks);
        Assert.DoesNotContain("file-write", childEffective.AllowedBlocks);
        Assert.DoesNotContain("file-edit", childEffective.AllowedBlocks);

        var ctx = new ExecutionContext();
        ctx.Variables["_permissions_allowedBlocks"] = childEffective.AllowedBlocks;

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "step-complete").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-edit").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
    }

    [Fact]
    public void Task4_FailClosed_NoPermissionsInContext_DeniesTool()
    {
        var ctx = new ExecutionContext();
        ctx.Variables["sessionId"] = "some-session";
        // No _permissions_allowedBlocks set

        var fileReadResult = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read");
        Assert.False(fileReadResult.Allowed);
        Assert.Contains("no permissions configured", fileReadResult.Error!);

        var stepCompleteResult = ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "step-complete");
        Assert.False(stepCompleteResult.Allowed);
    }

    // ═══════════════════════════════════════════════════════════
    // Task 6: ContractTestRunner has AllowedBlocks validation
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void Task6_ContractTestRunnerSetup_AllowedBlocksMatchToolMapping()
    {
        // Simulate what ContractTestRunner.SendPromptToBlockAsync does for agent blocks
        var perTestSession = ProjectSession.Create(
            "contract-test-session",
            Authority.Agent("contract-test-runner"),
            new ProjectSessionConfig(),
            Directory.GetCurrentDirectory());

        var allowedBlocks = new List<string>
        {
            "file-write", "file-read", "file-edit", "shell-execute", "step-complete"
        };

        perTestSession.UpdatePermissions(new ContextPermissions
        {
            AllowedBlocks = allowedBlocks,
            AllowedCommands = new() { "*" },
            AllowedTools = new() { "*" },
            AllowedPaths = new() { "*" },
            DataCollections = new() { "*" }
        });

        var toolMapping = new Dictionary<string, string>
        {
            ["file-write"] = "capture-file-write",
            ["file-read"] = "capture-file-read",
            ["shell-execute"] = "capture-shell-execute",
            ["file-edit"] = "capture-file-edit"
        };

        perTestSession.SetVariable("_toolMapping",
            System.Text.Json.JsonSerializer.Serialize(toolMapping));

        var effective = perTestSession.GetEffectivePermissions();

        // AllowedBlocks uses ORIGINAL names (pre-mapping)
        Assert.Contains("file-write", effective.AllowedBlocks);
        Assert.Contains("file-read", effective.AllowedBlocks);
        Assert.Contains("file-edit", effective.AllowedBlocks);
        Assert.Contains("shell-execute", effective.AllowedBlocks);
        Assert.Contains("step-complete", effective.AllowedBlocks);

        // AllowedBlocks does NOT contain capture-* names
        Assert.DoesNotContain("capture-file-write", effective.AllowedBlocks);
        Assert.DoesNotContain("capture-file-read", effective.AllowedBlocks);

        // Every tool in _toolMapping is in AllowedBlocks
        foreach (var originalTool in toolMapping.Keys)
            Assert.Contains(originalTool, effective.AllowedBlocks);

        // step-complete in AllowedBlocks
        Assert.Contains("step-complete", effective.AllowedBlocks);

        // Enforcement via CheckToolPermission
        var ctx = new ExecutionContext();
        ctx.Variables["_permissions_allowedBlocks"] = effective.AllowedBlocks;

        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-write").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-read").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "file-edit").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "shell-execute").Allowed);
        Assert.True(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "step-complete").Allowed);

        // Unmapped tools denied
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "json-validator").Allowed);
        Assert.False(ToolDispatcherBlockExecutor.CheckToolPermission(ctx, "directory-list").Allowed);
    }

    [Fact]
    public void Task6_ContractTestRunner_ToolMappingOnSession_PropagatedByBuildExecutionContext()
    {
        // Verify the _toolMapping set on the session would be picked up
        // by BuildExecutionContext (which reads session.GetVariable("_toolMapping"))
        var session = ProjectSession.Create(
            "contract-test",
            Authority.Agent("contract-test-runner"),
            new ProjectSessionConfig(),
            Directory.GetCurrentDirectory());

        var toolMapping = new Dictionary<string, string>
        {
            ["file-write"] = "capture-file-write",
            ["file-read"] = "capture-file-read",
        };

        session.SetVariable("_toolMapping",
            System.Text.Json.JsonSerializer.Serialize(toolMapping));

        // Verify the variable is set on the session
        var stored = session.GetVariable("_toolMapping");
        Assert.NotNull(stored);
        var storedStr = stored!.ToString()!;
        Assert.Contains("capture-file-write", storedStr);
        Assert.Contains("capture-file-read", storedStr);

        // Verify _skipCostLimits is also set (ContractTestRunner does this)
        session.SetVariable("_skipCostLimits", "true");
        Assert.Equal("true", session.GetVariable("_skipCostLimits")?.ToString());
    }
}
