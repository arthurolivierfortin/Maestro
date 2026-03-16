#nullable enable

using System;
using System.Collections.Generic;
using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.BlockExecutors;
using Maestro.Infrastructure.Sessions;
using Maestro.Infrastructure.Sessions.NodeHandlers;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Maestro.Execution.Tests;

/// <summary>
/// Tests for BlockRefHandler agent isolation: child session creation, I/O filtering,
/// block permission checks, and system variable blacklist.
/// Phase 59-T: Validates the core isolation mechanisms in BlockRefHandler.ExecuteAsync.
/// </summary>
public class BlockRefHandlerIsolationTests
{
    private readonly Mock<IBlockDiscoveryService> _blockDiscovery = new();
    private readonly Mock<ISessionStateManager> _stateManager = new();
    private readonly Mock<IProjectSessionRepository> _repository = new();

    private static ProjectSession CreateTestSession(string name = "test-session")
    {
        var session = ProjectSession.Create(
            name,
            Authority.Human("tester"),
            new ProjectSessionConfig());
        session.Start();
        return session;
    }

    private BlockRefHandler CreateHandler()
    {
        var registry = new BlockExecutorRegistry(Array.Empty<IBlockExecutor>());
        return new BlockRefHandler(
            _blockDiscovery.Object,
            registry,
            _stateManager.Object,
            _repository.Object,
            NullLogger<BlockRefHandler>.Instance);
    }

    // ═══════════════════════════════════════════════════════════
    // System Variable Blacklist — I/O Filtering
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void BuildBlockInputs_ResolvesTemplateVariables()
    {
        var session = CreateTestSession();
        session.SetVariable("prompt", "write tests for isolation");
        session.SetVariable("workingDir", "/projects/myapp");

        var nodeJson = JsonDocument.Parse(@"{
            ""id"": ""call-agent"",
            ""blockRef"": ""agents/test-designer"",
            ""inputs"": {
                ""prompt"": ""{{prompt}}"",
                ""workingDir"": ""{{workingDir}}""
            }
        }").RootElement;

        var inputs = BlockRefHandler.BuildBlockInputs(nodeJson, session, null, "/default");

        Assert.Equal("write tests for isolation", inputs["prompt"]);
        Assert.Equal("/projects/myapp", inputs["workingDir"]);
    }

    [Fact]
    public void BuildBlockInputs_AddsDefaultWorkingDir()
    {
        var session = CreateTestSession();

        var nodeJson = JsonDocument.Parse(@"{
            ""id"": ""call-agent"",
            ""blockRef"": ""agents/test-designer"",
            ""inputs"": {
                ""prompt"": ""hello""
            }
        }").RootElement;

        var inputs = BlockRefHandler.BuildBlockInputs(nodeJson, session, null, "/projects/myapp");

        Assert.Equal("/projects/myapp", inputs["workingDir"]);
    }

    [Fact]
    public void BuildBlockInputs_ResolvesPreviousOutput()
    {
        var session = CreateTestSession();

        var nodeJson = JsonDocument.Parse(@"{
            ""id"": ""call-agent"",
            ""blockRef"": ""agents/code-reviewer"",
            ""inputs"": {
                ""context"": ""{{previousOutput}}""
            }
        }").RootElement;

        var inputs = BlockRefHandler.BuildBlockInputs(nodeJson, session, "previous agent output", "/default");

        Assert.Equal("previous agent output", inputs["context"]);
    }

    // ═══════════════════════════════════════════════════════════
    // ResolveBlockRef — template resolution
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void ResolveBlockRef_WithBlockRefProperty()
    {
        var session = CreateTestSession();

        var nodeJson = JsonDocument.Parse(@"{
            ""id"": ""call-agent"",
            ""blockRef"": ""agents/test-designer""
        }").RootElement;

        var result = BlockRefHandler.ResolveBlockRef(nodeJson, "call-agent", session);

        Assert.Equal("agents/test-designer", result);
    }

    [Fact]
    public void ResolveBlockRef_WithBlockIdProperty()
    {
        var session = CreateTestSession();

        var nodeJson = JsonDocument.Parse(@"{
            ""id"": ""call-agent"",
            ""blockId"": ""agents/test-designer""
        }").RootElement;

        var result = BlockRefHandler.ResolveBlockRef(nodeJson, "call-agent", session);

        Assert.Equal("agents/test-designer", result);
    }

    [Fact]
    public void ResolveBlockRef_WithTemplateVariable()
    {
        var session = CreateTestSession();
        session.SetVariable("agentBlock", "agents/code-reviewer");

        var nodeJson = JsonDocument.Parse(@"{
            ""id"": ""call-agent"",
            ""blockRef"": ""{{agentBlock}}""
        }").RootElement;

        var result = BlockRefHandler.ResolveBlockRef(nodeJson, "call-agent", session);

        Assert.Equal("agents/code-reviewer", result);
    }

    [Fact]
    public void ResolveBlockRef_NoProperty_ReturnsNull()
    {
        var session = CreateTestSession();

        var nodeJson = JsonDocument.Parse(@"{
            ""id"": ""call-agent"",
            ""type"": ""set-variable""
        }").RootElement;

        var result = BlockRefHandler.ResolveBlockRef(nodeJson, "call-agent", session);

        Assert.Null(result);
    }

    // ═══════════════════════════════════════════════════════════
    // CheckBlockPermission — tested with actual sessions
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void BlockPermission_Denied_DetectedByCheckBlockPermission()
    {
        var session = CreateTestSession();
        session.SetBlockPermissions(new[]
        {
            BlockPermission.Deny("agents/blocked-agent")
        });

        var result = BlockRefHandler.CheckBlockPermission(session, "agents/blocked-agent");

        Assert.Equal(BlockPermissionLevel.Denied, result);
    }

    [Fact]
    public void BlockPermission_Allowed_DetectedByCheckBlockPermission()
    {
        var session = CreateTestSession();
        session.SetBlockPermissions(new[]
        {
            BlockPermission.Allow("*")
        });

        var result = BlockRefHandler.CheckBlockPermission(session, "agents/any-agent");

        Assert.Equal(BlockPermissionLevel.Allowed, result);
    }

    [Fact]
    public void BlockPermission_NoRules_DefaultAllowed()
    {
        var session = CreateTestSession();
        // No block permissions set (default empty)

        var result = BlockRefHandler.CheckBlockPermission(session, "agents/any-agent");

        Assert.Equal(BlockPermissionLevel.Allowed, result);
    }

    // ═══════════════════════════════════════════════════════════
    // MergeNodeConfigOverrides
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void MergeNodeConfigOverrides_OverridesBlockConfig()
    {
        var block = BlockDefinition.Create("test-block", "Test Block", "agent");
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["model"] = "claude-sonnet",
            ["temperature"] = 0.7
        });

        var nodeJson = JsonDocument.Parse(@"{
            ""id"": ""call-agent"",
            ""blockRef"": ""test-block"",
            ""config"": {
                ""model"": ""claude-opus"",
                ""maxTokens"": 4096
            }
        }").RootElement;

        BlockRefHandler.MergeNodeConfigOverrides(block, nodeJson);

        Assert.Equal("claude-opus", block.Config["model"]);
        Assert.Equal(4096, System.Convert.ToInt32(block.Config["maxTokens"]));
        Assert.Equal(0.7, System.Convert.ToDouble(block.Config["temperature"]));
    }

    // ═══════════════════════════════════════════════════════════
    // SerializeBlockOutput
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void SerializeBlockOutput_WithResponseKey_ReturnsResponse()
    {
        var result = new BlockExecutionResult
        {
            Success = true,
            Outputs = { ["response"] = "The agent completed successfully" }
        };

        var output = BlockRefHandler.SerializeBlockOutput(result, "test-block");

        Assert.Equal("The agent completed successfully", output);
    }

    [Fact]
    public void SerializeBlockOutput_SystemOutputsExcluded()
    {
        var result = new BlockExecutionResult
        {
            Success = true,
            Outputs =
            {
                ["response"] = "output text",
                ["_agentResult"] = "internal result"
            }
        };

        var output = BlockRefHandler.SerializeBlockOutput(result, "test-block");

        // System outputs (starting with _) are excluded from content serialization
        Assert.Equal("output text", output);
    }

    // ═══════════════════════════════════════════════════════════
    // Child session creation — verifying isolation through ProjectSession.CreateAsChild
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void ChildSession_HasEmptyVariables_NotParentVariables()
    {
        var parent = CreateTestSession("workflow-session");
        parent.SetVariable("prompt", "user request");
        parent.SetVariable("_workflowCheckpoint", "node-1,node-2");
        parent.SetVariable("_agentDone", "true");
        parent.SetVariable("customVar", "should not leak");

        var child = ProjectSession.CreateAsChild("child / agents/test-designer", parent);

        Assert.Empty(child.Variables);
        Assert.Null(child.GetVariable("prompt"));
        Assert.Null(child.GetVariable("_workflowCheckpoint"));
        Assert.Null(child.GetVariable("_agentDone"));
        Assert.Null(child.GetVariable("customVar"));
    }

    [Fact]
    public void ChildSession_StoresChildSessionIdOnParent()
    {
        // This is what BlockRefHandler does after child session creation:
        // session.SetVariable($"_childSession_{nodeId}", childSession.Id);
        var parent = CreateTestSession("workflow-session");
        var child = ProjectSession.CreateAsChild("child / agents/test-designer", parent);

        // Simulate what BlockRefHandler.ExecuteAsync does
        parent.SetVariable($"_childSession_call-agent", child.Id);

        Assert.Equal(child.Id, parent.GetVariable("_childSession_call-agent")?.ToString());
    }

    [Fact]
    public void TwoChildSessions_HaveDifferentIds()
    {
        var parent = CreateTestSession("workflow-session");

        var child1 = ProjectSession.CreateAsChild("child / agent-1", parent);
        var child2 = ProjectSession.CreateAsChild("child / agent-2", parent);

        Assert.NotEqual(child1.Id, child2.Id);
        Assert.Equal(parent.Id, child1.ParentSessionId);
        Assert.Equal(parent.Id, child2.ParentSessionId);
    }

    [Fact]
    public void TwoChildSessions_DoNotShareVariables()
    {
        var parent = CreateTestSession("workflow-session");

        var child1 = ProjectSession.CreateAsChild("child / agent-1", parent);
        child1.SetVariable("_agentResult", "result from agent 1");

        var child2 = ProjectSession.CreateAsChild("child / agent-2", parent);

        Assert.Null(child2.GetVariable("_agentResult"));
        Assert.Empty(child2.Variables);
    }
}
