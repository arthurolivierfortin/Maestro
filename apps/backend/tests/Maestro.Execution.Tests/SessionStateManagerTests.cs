using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.Sessions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace Maestro.Execution.Tests;

public class SessionStateManagerTests
{
    private readonly SessionStateManager _sut;
    private readonly Mock<ILogger<SessionStateManager>> _logger = new();

    public SessionStateManagerTests()
    {
        _sut = new SessionStateManager(_logger.Object);
    }

    private static ProjectSession CreateTestSession()
    {
        return ProjectSession.Create(
            "test-session",
            Authority.Human("tester"),
            new ProjectSessionConfig());
    }

    // ===== Static Helpers =====

    [Fact]
    public void CreateNode_ReturnsCorrectStructure()
    {
        var node = SessionStateManager.CreateNode("my-node", "My Node", "pending");

        Assert.Equal("my-node", node["id"]);
        Assert.Equal("My Node", node["name"]);
        Assert.Equal("pending", node["status"]);
        Assert.IsType<List<object>>(node["children"]);
        Assert.False(node.ContainsKey("output"));
    }

    [Fact]
    public void CreateNode_WithOutput_IncludesOutput()
    {
        var node = SessionStateManager.CreateNode("n1", "Node 1", "done", "some output");

        Assert.Equal("some output", node["output"]);
    }

    [Theory]
    [InlineData("evaluate-current", "Evaluate Current")]
    [InlineData("load-context", "Load Context")]
    [InlineData("single", "Single")]
    [InlineData("multi-word-node-id", "Multi Word Node Id")]
    public void NodeIdToDisplayName_ConvertsCorrectly(string input, string expected)
    {
        Assert.Equal(expected, SessionStateManager.NodeIdToDisplayName(input));
    }

    [Theory]
    [InlineData("evaluate-fitness", "script")]
    [InlineData("load-context", "script")]
    [InlineData("apply-changes", "script")]
    [InlineData("generate-code", "inference")]
    [InlineData("improvement-step", "inference")]
    [InlineData("check-results", "validator")]
    [InlineData("fitness-eval", "validator")]
    [InlineData("validate-output", "validator")]
    [InlineData("metrics-collect", "validator")]
    [InlineData("unknown-thing", "task")]
    public void InferBlockType_ReturnsCorrectType(string nodeId, string expectedType)
    {
        Assert.Equal(expectedType, SessionStateManager.InferBlockType(nodeId));
    }

    // ===== ReadDoubleVariable =====

    [Fact]
    public void ReadDoubleVariable_ReturnsDefault_WhenMissing()
    {
        var session = CreateTestSession();
        Assert.Equal(0.85, SessionStateManager.ReadDoubleVariable(session, "missing", 0.85));
    }

    [Fact]
    public void ReadDoubleVariable_HandlesDouble()
    {
        var session = CreateTestSession();
        session.SetVariable("val", 3.14);
        Assert.Equal(3.14, SessionStateManager.ReadDoubleVariable(session, "val", 0));
    }

    [Fact]
    public void ReadDoubleVariable_HandlesInt()
    {
        var session = CreateTestSession();
        session.SetVariable("val", 42);
        Assert.Equal(42.0, SessionStateManager.ReadDoubleVariable(session, "val", 0));
    }

    [Fact]
    public void ReadDoubleVariable_HandlesString()
    {
        var session = CreateTestSession();
        session.SetVariable("val", "1.5");
        Assert.Equal(1.5, SessionStateManager.ReadDoubleVariable(session, "val", 0));
    }

    // ===== ReadIntVariable =====

    [Fact]
    public void ReadIntVariable_ReturnsDefault_WhenMissing()
    {
        var session = CreateTestSession();
        Assert.Equal(10, SessionStateManager.ReadIntVariable(session, "missing", 10));
    }

    [Fact]
    public void ReadIntVariable_HandlesInt()
    {
        var session = CreateTestSession();
        session.SetVariable("val", 7);
        Assert.Equal(7, SessionStateManager.ReadIntVariable(session, "val", 0));
    }

    [Fact]
    public void ReadIntVariable_HandlesString()
    {
        var session = CreateTestSession();
        session.SetVariable("val", "99");
        Assert.Equal(99, SessionStateManager.ReadIntVariable(session, "val", 0));
    }

    // ===== InitializeRuntime =====

    [Fact]
    public void InitializeRuntime_CreatesRuntimeVariables()
    {
        var session = CreateTestSession();

        _sut.InitializeRuntime(session);

        Assert.IsType<List<object>>(session.GetVariable("_executionLog"));
        Assert.IsType<List<object>>(session.GetVariable("_artifacts"));
        Assert.IsType<Dictionary<string, object>>(session.GetVariable("_blockOutputs"));
        Assert.IsType<List<object>>(session.GetVariable("_llmActivity"));
        Assert.IsType<Dictionary<string, object>>(session.GetVariable("_phaseMetrics"));
    }

    [Fact]
    public void InitializeRuntime_DoesNotOverwriteExisting()
    {
        var session = CreateTestSession();
        var existingLog = new List<object> { new Dictionary<string, object> { ["msg"] = "existing" } };
        session.SetVariable("_executionLog", existingLog);

        _sut.InitializeRuntime(session);

        var log = session.GetVariable("_executionLog") as List<object>;
        Assert.NotNull(log);
        Assert.Single(log!);
    }

    // ===== BuildExecutionTree =====

    [Fact]
    public void BuildExecutionTree_NullBlock_ReturnsFallback()
    {
        var tree = _sut.BuildExecutionTree(null);

        Assert.Single(tree);
        var node = tree[0] as Dictionary<string, object>;
        Assert.NotNull(node);
        Assert.Equal("execute", node!["id"]);
        Assert.Equal("pending", node["status"]);
    }

    [Fact]
    public void BuildExecutionTree_BlockWithoutNodes_ReturnsFallback()
    {
        var block = BlockDefinition.Create("wf1", "workflow", "workflow");
        block.UpdateConfig(new Dictionary<string, object> { ["description"] = "no nodes" });

        var tree = _sut.BuildExecutionTree(block);

        Assert.Single(tree);
    }

    [Fact]
    public void BuildExecutionTree_BlockWithNodes_BuildsTree()
    {
        var block = BlockDefinition.Create("wf1", "workflow", "workflow");
        var nodesJson = JsonSerializer.SerializeToElement(new[]
        {
            new { id = "step-one" },
            new { id = "step-two" }
        });
        block.UpdateConfig(new Dictionary<string, object> { ["nodes"] = nodesJson });

        var tree = _sut.BuildExecutionTree(block);

        Assert.Equal(2, tree.Count);
        var first = tree[0] as Dictionary<string, object>;
        Assert.Equal("step-one", first!["id"]);
        Assert.Equal("Step One", first["name"]);
        Assert.Equal("pending", first["status"]);
    }

    // ===== Active Block =====

    [Fact]
    public void SetActiveBlock_StoresCorrectData()
    {
        var session = CreateTestSession();

        _sut.SetActiveBlock(session, "b1", "Block 1", "tool", "running", "initial output");

        var block = session.GetVariable("_activeBlock") as Dictionary<string, object>;
        Assert.NotNull(block);
        Assert.Equal("b1", block!["id"]);
        Assert.Equal("Block 1", block["name"]);
        Assert.Equal("tool", block["type"]);
        Assert.Equal("running", block["status"]);
        Assert.Equal("initial output", block["output"]);
        Assert.True(block.ContainsKey("startedAt"));
    }

    [Fact]
    public void UpdateActiveBlockOutput_UpdatesOutput()
    {
        var session = CreateTestSession();
        _sut.SetActiveBlock(session, "b1", "Block 1", "tool", "running");

        _sut.UpdateActiveBlockOutput(session, "new output");

        var block = session.GetVariable("_activeBlock") as Dictionary<string, object>;
        Assert.Equal("new output", block!["output"]);
    }

    [Fact]
    public void UpdateActiveBlockStatus_UpdatesStatus()
    {
        var session = CreateTestSession();
        _sut.SetActiveBlock(session, "b1", "Block 1", "tool", "running");

        _sut.UpdateActiveBlockStatus(session, "done");

        var block = session.GetVariable("_activeBlock") as Dictionary<string, object>;
        Assert.Equal("done", block!["status"]);
    }

    [Fact]
    public void ClearActiveBlock_RemovesBlock()
    {
        var session = CreateTestSession();
        _sut.SetActiveBlock(session, "b1", "Block 1", "tool", "running");

        _sut.ClearActiveBlock(session);

        var block = session.GetVariable("_activeBlock");
        Assert.Null(block);
    }

    // ===== Block Outputs =====

    [Fact]
    public void StoreBlockOutput_CreatesEntry()
    {
        var session = CreateTestSession();
        session.SetVariable("_blockOutputs", new Dictionary<string, object>());

        _sut.StoreBlockOutput(session, "node1", "inference", "hello world");

        var outputs = session.GetVariable("_blockOutputs") as Dictionary<string, object>;
        Assert.True(outputs!.ContainsKey("node1"));
        var entry = outputs["node1"] as Dictionary<string, object>;
        Assert.Equal("inference", entry!["type"]);
        Assert.Equal("hello world", entry["output"]);
    }

    [Fact]
    public void StoreBlockOutput_WithDetailOverride_UsesOverride()
    {
        var session = CreateTestSession();
        session.SetVariable("_blockOutputs", new Dictionary<string, object>());

        var detail = new Dictionary<string, object> { ["custom"] = "data" };
        _sut.StoreBlockOutput(session, "node1", "tool", null, detail);

        var outputs = session.GetVariable("_blockOutputs") as Dictionary<string, object>;
        var entry = outputs!["node1"] as Dictionary<string, object>;
        Assert.Equal("data", entry!["custom"]);
    }

    // ===== Phase Management =====

    [Fact]
    public void UpdatePhaseStatus_UpdatesMatchingPhase()
    {
        var session = CreateTestSession();
        var phases = new List<object>
        {
            new Dictionary<string, object> { ["id"] = "phase-1", ["status"] = "pending" },
            new Dictionary<string, object> { ["id"] = "phase-2", ["status"] = "pending" }
        };
        session.SetVariable("_phases", phases);

        var result = _sut.UpdatePhaseStatus(session, "phase-1", "running", 50);

        Assert.True(result);
        var updated = (session.GetVariable("_phases") as List<object>)?[0] as Dictionary<string, object>;
        Assert.Equal("running", updated!["status"]);
        Assert.Equal(50, updated["progress"]);
    }

    [Fact]
    public void UpdatePhaseStatus_ReturnsFalse_WhenPhaseNotFound()
    {
        var session = CreateTestSession();
        session.SetVariable("_phases", new List<object>());

        Assert.False(_sut.UpdatePhaseStatus(session, "nonexistent", "running"));
    }

    [Fact]
    public void UpdatePhaseStatus_RemovesProgress_WhenNull()
    {
        var session = CreateTestSession();
        var phases = new List<object>
        {
            new Dictionary<string, object> { ["id"] = "p1", ["status"] = "running", ["progress"] = 50 }
        };
        session.SetVariable("_phases", phases);

        _sut.UpdatePhaseStatus(session, "p1", "done");

        var updated = (session.GetVariable("_phases") as List<object>)?[0] as Dictionary<string, object>;
        Assert.False(updated!.ContainsKey("progress"));
    }

    // ===== Execution Logging =====

    [Fact]
    public void AppendExecutionLog_AddsEntry()
    {
        var session = CreateTestSession();
        session.SetVariable("_executionLog", new List<object>());

        _sut.AppendExecutionLog(session, "info", "test message");

        var log = session.GetVariable("_executionLog") as List<object>;
        Assert.Single(log!);
        var entry = log[0] as Dictionary<string, object>;
        Assert.Equal("info", entry!["level"]);
        Assert.Equal("test message", entry["msg"]);
    }

    [Fact]
    public void AppendExecutionLog_CapsAt200Entries()
    {
        var session = CreateTestSession();
        var existing = new List<object>();
        for (var i = 0; i < 200; i++)
            existing.Add(new Dictionary<string, object> { ["msg"] = $"msg-{i}" });
        session.SetVariable("_executionLog", existing);

        _sut.AppendExecutionLog(session, "info", "overflow");

        var log = session.GetVariable("_executionLog") as List<object>;
        Assert.Equal(200, log!.Count);
        var last = log[^1] as Dictionary<string, object>;
        Assert.Equal("overflow", last!["msg"]);
    }

    // ===== LLM Activity =====

    [Fact]
    public void AppendToLLMActivity_AddsEntry()
    {
        var session = CreateTestSession();
        session.SetVariable("_llmActivity", new List<object>());

        _sut.AppendToLLMActivity(session, new Dictionary<string, object> { ["model"] = "gpt-4" });

        var activity = session.GetVariable("_llmActivity") as List<object>;
        Assert.Single(activity!);
    }

    [Fact]
    public void AppendToLLMActivity_CapsAt20Entries()
    {
        var session = CreateTestSession();
        var existing = new List<object>();
        for (var i = 0; i < 20; i++)
            existing.Add(new Dictionary<string, object> { ["i"] = i });
        session.SetVariable("_llmActivity", existing);

        _sut.AppendToLLMActivity(session, new Dictionary<string, object> { ["i"] = 20 });

        var activity = session.GetVariable("_llmActivity") as List<object>;
        Assert.Equal(20, activity!.Count);
    }

    // ===== Artifacts =====

    [Fact]
    public void AddArtifact_CreatesNewEntry()
    {
        var session = CreateTestSession();
        session.SetVariable("_artifacts", new List<object>());

        _sut.AddArtifact(session, "output.json", "file", "1.2KB");

        var artifacts = session.GetVariable("_artifacts") as List<object>;
        Assert.Single(artifacts!);
        var artifact = artifacts[0] as Dictionary<string, object>;
        Assert.Equal("output.json", artifact!["name"]);
        Assert.Equal("file", artifact["type"]);
        Assert.Equal("1.2KB", artifact["size"]);
        Assert.Equal("new", artifact["status"]);
    }

    [Fact]
    public void AddArtifact_UpdatesExisting()
    {
        var session = CreateTestSession();
        var existing = new List<object>
        {
            new Dictionary<string, object> { ["name"] = "output.json", ["type"] = "file", ["status"] = "new" }
        };
        session.SetVariable("_artifacts", existing);

        _sut.AddArtifact(session, "output.json", "file", "2.5KB");

        var artifacts = session.GetVariable("_artifacts") as List<object>;
        Assert.Single(artifacts!);
        var artifact = artifacts[0] as Dictionary<string, object>;
        Assert.Equal("updated", artifact!["status"]);
        Assert.Equal("2.5KB", artifact["size"]);
    }

    // ===== Tree Manipulation =====

    [Fact]
    public void FindNodeById_FindsTopLevel()
    {
        var tree = new List<object>
        {
            SessionStateManager.CreateNode("a", "A", "pending"),
            SessionStateManager.CreateNode("b", "B", "pending")
        };

        var found = _sut.FindNodeById(tree, "b");
        Assert.NotNull(found);
        Assert.Equal("b", found!["id"]);
    }

    [Fact]
    public void FindNodeById_FindsNested()
    {
        var child = SessionStateManager.CreateNode("child", "Child", "pending");
        var parent = SessionStateManager.CreateNode("parent", "Parent", "pending");
        (parent["children"] as List<object>)!.Add(child);
        var tree = new List<object> { parent };

        var found = _sut.FindNodeById(tree, "child");
        Assert.NotNull(found);
        Assert.Equal("child", found!["id"]);
    }

    [Fact]
    public void FindNodeById_ReturnsNull_WhenNotFound()
    {
        var tree = new List<object> { SessionStateManager.CreateNode("a", "A", "pending") };
        Assert.Null(_sut.FindNodeById(tree, "nonexistent"));
    }

    [Fact]
    public void UpdateNodeById_ChangesStatusAndOutput()
    {
        var tree = new List<object> { SessionStateManager.CreateNode("n1", "N1", "pending") };

        _sut.UpdateNodeById(tree, "n1", "done", "result text");

        var node = tree[0] as Dictionary<string, object>;
        Assert.Equal("done", node!["status"]);
        Assert.Equal("result text", node["output"]);
    }

    [Fact]
    public void UpdateNodeById_RemovesOutput_WhenResetToPending()
    {
        var tree = new List<object> { SessionStateManager.CreateNode("n1", "N1", "done", "old") };

        _sut.UpdateNodeById(tree, "n1", "pending");

        var node = tree[0] as Dictionary<string, object>;
        Assert.Equal("pending", node!["status"]);
        Assert.False(node.ContainsKey("output"));
    }

    [Fact]
    public void ResetNodeTree_ResetsAllNodes()
    {
        var child = SessionStateManager.CreateNode("c1", "C1", "done", "child output");
        var parent = SessionStateManager.CreateNode("p1", "P1", "running", "parent output");
        (parent["children"] as List<object>)!.Add(child);
        var tree = new List<object> { parent };

        _sut.ResetNodeTree(tree);

        var p = tree[0] as Dictionary<string, object>;
        Assert.Equal("pending", p!["status"]);
        Assert.False(p.ContainsKey("output"));

        var children = p["children"] as List<object>;
        var c = children![0] as Dictionary<string, object>;
        Assert.Equal("pending", c!["status"]);
        Assert.False(c.ContainsKey("output"));
    }

    // ===== NormalizeJsonElementToList =====

    [Fact]
    public void NormalizeJsonElementToList_ConvertsJsonElementArray()
    {
        var session = CreateTestSession();
        var jsonArray = JsonSerializer.SerializeToElement(new[]
        {
            new { id = "p1", name = "Phase 1" },
            new { id = "p2", name = "Phase 2" }
        });
        session.SetVariable("_phases", jsonArray);

        SessionStateManager.NormalizeJsonElementToList(session, "_phases");

        var result = session.GetVariable("_phases") as List<object>;
        Assert.NotNull(result);
        Assert.Equal(2, result!.Count);
        var first = result[0] as Dictionary<string, object>;
        Assert.Equal("p1", first!["id"]);
        Assert.Equal("Phase 1", first["name"]);
    }

    [Fact]
    public void NormalizeJsonElementToList_ConvertsJsonString()
    {
        var session = CreateTestSession();
        session.SetVariable("items", "[{\"a\": 1}, {\"b\": 2}]");

        SessionStateManager.NormalizeJsonElementToList(session, "items");

        var result = session.GetVariable("items") as List<object>;
        Assert.NotNull(result);
        Assert.Equal(2, result!.Count);
    }

    [Fact]
    public void NormalizeJsonElementToList_LeavesNonArrayStringsAlone()
    {
        var session = CreateTestSession();
        session.SetVariable("val", "just a string");

        SessionStateManager.NormalizeJsonElementToList(session, "val");

        Assert.Equal("just a string", session.GetVariable("val"));
    }

    // ===== StorePhaseSummary =====

    [Fact]
    public void StorePhaseSummary_StoresResultOnMatchingPhase()
    {
        var session = CreateTestSession();
        var phases = new List<object>
        {
            new Dictionary<string, object> { ["id"] = "phase-1", ["status"] = "done" }
        };
        session.SetVariable("_phases", phases);
        session.SetVariable("_phaseMetrics", new Dictionary<string, object>());

        _sut.StorePhaseSummary(session, "phase-1", 5, 0.92);

        var updated = (session.GetVariable("_phases") as List<object>)?[0] as Dictionary<string, object>;
        Assert.True(updated!.ContainsKey("result"));
        var result = updated["result"] as Dictionary<string, object>;
        Assert.Equal(5, result!["iterations"]);
        Assert.Equal(0.92, result["fitness"]);
    }

    // ===== StoreIterationMetrics =====

    [Fact]
    public void StoreIterationMetrics_SkipsNullPhaseId()
    {
        var session = CreateTestSession();
        session.SetVariable("_phaseMetrics", new Dictionary<string, object>());

        _sut.StoreIterationMetrics(session, null, 1, 0.5);

        var metrics = session.GetVariable("_phaseMetrics") as Dictionary<string, object>;
        Assert.Empty(metrics!);
    }

    [Fact]
    public void StoreIterationMetrics_CreatesPhaseEntry()
    {
        var session = CreateTestSession();
        session.SetVariable("_phaseMetrics", new Dictionary<string, object>());
        session.SetVariable("_llmActivity", new List<object>());

        _sut.StoreIterationMetrics(session, "phase-1", 1, 0.75);

        var metrics = session.GetVariable("_phaseMetrics") as Dictionary<string, object>;
        Assert.True(metrics!.ContainsKey("phase-1"));
        var entry = metrics["phase-1"] as Dictionary<string, object>;
        var iterations = entry!["iterations"] as List<object>;
        Assert.Single(iterations!);
    }
}
