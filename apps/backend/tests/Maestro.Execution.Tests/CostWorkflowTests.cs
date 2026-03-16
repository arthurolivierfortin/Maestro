#nullable enable

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.Sessions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Maestro.Execution.Tests;

/// <summary>
/// Tests for workflow-level cost-stop behavior in NodeExecutionEngine:
/// multi-block stop, for-each stop, condition stop, agent loop stop.
/// Phase 59-PRE-2-T — Tests #30-33.
///
/// Uses a mock INodeHandler (blockRef handler) that returns the cost-stop
/// signal after a configurable number of calls, simulating the BlockRefHandler's
/// CheckCostBeforeExecutionAsync returning [COST-LIMIT-STOPPED].
/// </summary>
public class CostWorkflowTests
{
    private readonly Mock<IProjectSessionRepository> _repository = new();
    private readonly Mock<ISessionStateManager> _stateManager = new();

    public CostWorkflowTests()
    {
        // Default setup: SaveAsync is a no-op
        _repository
            .Setup(r => r.SaveAsync(It.IsAny<ProjectSession>(), default))
            .Returns(Task.CompletedTask);

        // Default setup: stateManager methods are no-ops
        _stateManager
            .Setup(s => s.UpdateNodeById(It.IsAny<List<object>>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>()));
        _stateManager
            .Setup(s => s.SetActiveBlock(It.IsAny<ProjectSession>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>()));
        _stateManager
            .Setup(s => s.UpdateActiveBlockOutput(It.IsAny<ProjectSession>(), It.IsAny<string>()));
        _stateManager
            .Setup(s => s.UpdateActiveBlockStatus(It.IsAny<ProjectSession>(), It.IsAny<string>()));
        _stateManager
            .Setup(s => s.StoreBlockOutput(It.IsAny<ProjectSession>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<Dictionary<string, object>?>()));
        _stateManager
            .Setup(s => s.AppendExecutionLog(It.IsAny<ProjectSession>(), It.IsAny<string>(), It.IsAny<string>()));
        _stateManager
            .Setup(s => s.UpdatePhaseStatus(It.IsAny<ProjectSession>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int?>()))
            .Returns(false);
        _stateManager
            .Setup(s => s.GracefulCostStop(It.IsAny<ProjectSession>()));
        _stateManager
            .Setup(s => s.FindNodeById(It.IsAny<List<object>>(), It.IsAny<string>()))
            .Returns((Dictionary<string, object>?)null);
    }

    private static ProjectSession CreateTestSession()
    {
        return ProjectSession.Create(
            "test-session",
            Authority.Human("tester"),
            new ProjectSessionConfig());
    }

    /// <summary>
    /// Creates a mock INodeHandler that acts as a blockRef handler (NodeType == null).
    /// Returns normal output for the first N calls, then returns the cost-stop signal.
    /// </summary>
    private static Mock<INodeHandler> CreateCostStopBlockRefHandler(int normalCallsBeforeStop)
    {
        var callCount = 0;
        var handler = new Mock<INodeHandler>();
        handler.SetupGet(h => h.NodeType).Returns((string?)null); // blockRef handler

        handler
            .Setup(h => h.ExecuteAsync(
                It.IsAny<JsonElement>(),
                It.IsAny<NodeExecutionContext>(),
                It.IsAny<INodeExecutionCallback>(),
                It.IsAny<string?>()))
            .Returns((JsonElement node, NodeExecutionContext ctx, INodeExecutionCallback engine, string? prev) =>
            {
                callCount++;
                if (callCount > normalCallsBeforeStop)
                    return Task.FromResult<string?>("[COST-LIMIT-STOPPED] Daily limit of $5.00 exceeded");
                return Task.FromResult<string?>($"output-{callCount}");
            });

        return handler;
    }

    private NodeExecutionEngine CreateEngine(INodeHandler blockRefHandler)
    {
        return new NodeExecutionEngine(
            _repository.Object,
            _stateManager.Object,
            NullLogger<NodeExecutionEngine>.Instance,
            new[] { blockRefHandler });
    }

    // ════════════════════════════════════════════════════════════════
    // #30 — Workflow 3 blocks: stop at block 2, block 3 never reached
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Workflow_3Blocks_StopsAtSecondBlock()
    {
        // First block OK, second block returns cost-stop
        var handler = CreateCostStopBlockRefHandler(normalCallsBeforeStop: 1);
        var engine = CreateEngine(handler.Object);
        var session = CreateTestSession();

        var nodesJson = JsonSerializer.SerializeToElement(new[]
        {
            new { id = "block-1", blockRef = "inference-block" },
            new { id = "block-2", blockRef = "inference-block" },
            new { id = "block-3", blockRef = "inference-block" }
        });

        var displayTree = new List<object>();

        var result = await engine.ExecuteConfigNodesAsync(
            session, nodesJson, null, "/tmp", "wf-1", null, displayTree);

        // Block 1 executed (call 1), Block 2 stopped (call 2), Block 3 never called
        handler.Verify(h => h.ExecuteAsync(
            It.IsAny<JsonElement>(),
            It.IsAny<NodeExecutionContext>(),
            It.IsAny<INodeExecutionCallback>(),
            It.IsAny<string?>()), Times.Exactly(2));

        // GracefulCostStop should have been called
        _stateManager.Verify(s => s.GracefulCostStop(session), Times.Once);
    }

    // ════════════════════════════════════════════════════════════════
    // #31 — For-each: stop during second iteration
    //       Since for-each uses ExecuteConfigNodesAsync internally,
    //       we test that the engine breaks on cost-stop signal
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Workflow_ForEach_StopsDuringIteration()
    {
        // First iteration OK (1 block call), second iteration stops
        var handler = CreateCostStopBlockRefHandler(normalCallsBeforeStop: 1);
        var engine = CreateEngine(handler.Object);
        var session = CreateTestSession();

        // Simulate a sequence: block-1 OK, then block-2 stops
        var nodesJson = JsonSerializer.SerializeToElement(new[]
        {
            new { id = "iter-1-block", blockRef = "process-block" },
            new { id = "iter-2-block", blockRef = "process-block" }
        });

        var displayTree = new List<object>();

        var result = await engine.ExecuteConfigNodesAsync(
            session, nodesJson, null, "/tmp", "wf-1", null, displayTree);

        // iter-1-block executed, iter-2-block stopped
        handler.Verify(h => h.ExecuteAsync(
            It.IsAny<JsonElement>(),
            It.IsAny<NodeExecutionContext>(),
            It.IsAny<INodeExecutionCallback>(),
            It.IsAny<string?>()), Times.Exactly(2));

        _stateManager.Verify(s => s.GracefulCostStop(session), Times.Once);
    }

    // ════════════════════════════════════════════════════════════════
    // #32 — Condition stop: cost exceeded before condition is evaluated
    //       First block stops, condition node never reached
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Workflow_ConditionStop_BeforeConditionEvaluated()
    {
        // First block immediately returns cost-stop
        var handler = CreateCostStopBlockRefHandler(normalCallsBeforeStop: 0);
        var engine = CreateEngine(handler.Object);
        var session = CreateTestSession();

        // Block before condition, then a conditional node
        var nodesJson = JsonSerializer.SerializeToElement(new object[]
        {
            new { id = "pre-condition-block", blockRef = "check-block" },
            new { id = "condition-node", type = "conditional", condition = "true",
                  then = new { id = "then-block", blockRef = "then-action" } }
        });

        var displayTree = new List<object>();

        var result = await engine.ExecuteConfigNodesAsync(
            session, nodesJson, null, "/tmp", "wf-1", null, displayTree);

        // Only the first block was attempted (and returned cost-stop)
        handler.Verify(h => h.ExecuteAsync(
            It.IsAny<JsonElement>(),
            It.IsAny<NodeExecutionContext>(),
            It.IsAny<INodeExecutionCallback>(),
            It.IsAny<string?>()), Times.Once);

        _stateManager.Verify(s => s.GracefulCostStop(session), Times.Once);
    }

    // ════════════════════════════════════════════════════════════════
    // #33 — Agent loop: stop between iterations
    //       First iteration OK, second iteration cost-stopped
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Workflow_AgentLoop_StopsBetweenIterations()
    {
        // First block (iteration 1) OK, second block (iteration 2) stops
        var handler = CreateCostStopBlockRefHandler(normalCallsBeforeStop: 1);
        var engine = CreateEngine(handler.Object);
        var session = CreateTestSession();

        // Simulate sequential agent iterations as sequential blockRef nodes
        var nodesJson = JsonSerializer.SerializeToElement(new[]
        {
            new { id = "agent-iter-1", blockRef = "agent-block" },
            new { id = "agent-iter-2", blockRef = "agent-block" }
        });

        var displayTree = new List<object>();

        var result = await engine.ExecuteConfigNodesAsync(
            session, nodesJson, null, "/tmp", "wf-1", null, displayTree);

        // First iteration executed, second stopped
        handler.Verify(h => h.ExecuteAsync(
            It.IsAny<JsonElement>(),
            It.IsAny<NodeExecutionContext>(),
            It.IsAny<INodeExecutionCallback>(),
            It.IsAny<string?>()), Times.Exactly(2));

        // Engine performed graceful stop
        _stateManager.Verify(s => s.GracefulCostStop(session), Times.Once);

        // Result should be the cost-stop message
        Assert.NotNull(result);
        Assert.StartsWith("[COST-LIMIT-STOPPED]", result!);
    }
}
