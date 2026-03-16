#nullable enable

using System;
using System.Threading.Tasks;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.BlockExecutors;
using Maestro.Infrastructure.Sessions;
using Maestro.Infrastructure.Sessions.NodeHandlers;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Maestro.Execution.Tests;

/// <summary>
/// Tests for BlockRefHandler cost enforcement: CheckCostBeforeExecutionAsync.
/// Phase 59-PRE-2-T — Tests #16-23.
/// </summary>
public class BlockRefHandlerCostTests
{
    private readonly Mock<IBlockDiscoveryService> _blockDiscovery = new();
    private readonly Mock<ISessionStateManager> _stateManager = new();
    private readonly Mock<IProjectSessionRepository> _repository = new();
    private readonly Mock<ICostTrackingService> _costTracking = new();

    private static ProjectSession CreateTestSession()
    {
        return ProjectSession.Create(
            "test-session",
            Authority.Human("tester"),
            new ProjectSessionConfig());
    }

    private BlockRefHandler CreateHandler()
    {
        var registry = new BlockExecutorRegistry(Array.Empty<IBlockExecutor>());
        return new BlockRefHandler(
            _blockDiscovery.Object,
            registry,
            _stateManager.Object,
            _repository.Object,
            NullLogger<BlockRefHandler>.Instance,
            _costTracking.Object);
    }

    // ════════════════════════════════════════════════════════════════
    // #16 — Hard stop: block enforcement refuses execution
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task HardStop_BlockRefused_ReturnsCostStopMessage()
    {
        _costTracking
            .Setup(c => c.CheckLimitAsync(It.IsAny<string>(), It.IsAny<decimal>()))
            .ReturnsAsync(new CostLimitCheckResult
            {
                Exceeded = true,
                LimitType = "daily",
                Enforcement = "block",
                AutoResume = false,
                CurrentValue = 5.02m,
                MaxValue = 5.00m,
                Message = "Daily limit of $5.00 exceeded (current: $5.02). Enforcement: block."
            });

        var handler = CreateHandler();
        var session = CreateTestSession();

        var result = await handler.CheckCostBeforeExecutionAsync(session, "node-1", "block-ref-1");

        Assert.NotNull(result);
        Assert.StartsWith("[COST-LIMIT-STOPPED]", result);
    }

    // ════════════════════════════════════════════════════════════════
    // #17 — Hard stop: previously executed blocks not interrupted
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task HardStop_PreviousBlockOutputPreserved()
    {
        _costTracking
            .Setup(c => c.CheckLimitAsync(It.IsAny<string>(), It.IsAny<decimal>()))
            .ReturnsAsync(new CostLimitCheckResult
            {
                Exceeded = true,
                LimitType = "daily",
                Enforcement = "block",
                AutoResume = false,
                CurrentValue = 5.02m,
                MaxValue = 5.00m,
                Message = "Exceeded"
            });

        var handler = CreateHandler();
        var session = CreateTestSession();

        // Simulate block 1 already executed with output
        session.SetVariable("_nodeResult_block-1", "Block 1 output preserved");

        // Now block 2 is refused
        var result = await handler.CheckCostBeforeExecutionAsync(session, "block-2", "block-ref-2");

        Assert.NotNull(result);
        // Block 1 output still there
        Assert.Equal("Block 1 output preserved", session.GetVariable("_nodeResult_block-1")?.ToString());
    }

    // ════════════════════════════════════════════════════════════════
    // #18 — Warn: block continues execution
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Warn_BlockContinues_ReturnsNull()
    {
        _costTracking
            .Setup(c => c.CheckLimitAsync(It.IsAny<string>(), It.IsAny<decimal>()))
            .ReturnsAsync(new CostLimitCheckResult
            {
                Exceeded = true,
                LimitType = "daily",
                Enforcement = "warn",
                AutoResume = false,
                CurrentValue = 5.02m,
                MaxValue = 5.00m,
                Message = "Daily limit exceeded (warning)"
            });

        var handler = CreateHandler();
        var session = CreateTestSession();

        var result = await handler.CheckCostBeforeExecutionAsync(session, "node-1", "block-ref-1");

        Assert.Null(result); // null = continue execution
        Assert.Equal("true", session.GetVariable("_costLimitExceeded")?.ToString());
    }

    // ════════════════════════════════════════════════════════════════
    // #19 — Variables preserved after hard stop
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task HardStop_PreExistingVariablesPreserved()
    {
        _costTracking
            .Setup(c => c.CheckLimitAsync(It.IsAny<string>(), It.IsAny<decimal>()))
            .ReturnsAsync(new CostLimitCheckResult
            {
                Exceeded = true,
                LimitType = "session",
                Enforcement = "block",
                AutoResume = false,
                CurrentValue = 1.05m,
                MaxValue = 1.00m,
                Message = "Session limit exceeded"
            });

        var handler = CreateHandler();
        var session = CreateTestSession();

        // Set pre-existing variables
        session.SetVariable("myCustomVar", "important-data");
        session.SetVariable("_accumulatedCost", "0.95");
        session.SetVariable("_executionLog", new System.Collections.Generic.List<object>());

        await handler.CheckCostBeforeExecutionAsync(session, "node-1", "block-ref-1");

        Assert.Equal("important-data", session.GetVariable("myCustomVar")?.ToString());
        Assert.Equal("0.95", session.GetVariable("_accumulatedCost")?.ToString());
        Assert.NotNull(session.GetVariable("_executionLog"));
    }

    // ════════════════════════════════════════════════════════════════
    // #20 — _activeWorkflow not directly set by CheckCostBeforeExecutionAsync
    //       (that's done by GracefulCostStop in the engine, tested separately)
    //       But we verify the stop signal is returned so the engine can handle it
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task HardStop_ReturnsStopSignalForEngine()
    {
        _costTracking
            .Setup(c => c.CheckLimitAsync(It.IsAny<string>(), It.IsAny<decimal>()))
            .ReturnsAsync(new CostLimitCheckResult
            {
                Exceeded = true,
                LimitType = "daily",
                Enforcement = "block",
                AutoResume = false,
                CurrentValue = 5.02m,
                MaxValue = 5.00m,
                Message = "Daily limit exceeded"
            });

        var handler = CreateHandler();
        var session = CreateTestSession();
        session.SetVariable("_activeWorkflow", "my-workflow");

        var result = await handler.CheckCostBeforeExecutionAsync(session, "node-1", "block-ref-1");

        Assert.NotNull(result);
        Assert.StartsWith("[COST-LIMIT-STOPPED]", result);
        // _activeWorkflow NOT cleared here — that's the engine's job via GracefulCostStop
    }

    // ════════════════════════════════════════════════════════════════
    // #21 — Session is NOT set to error state after hard stop
    //       (session remains in its current state, engine handles idle transition)
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task HardStop_SessionNotSetToError()
    {
        _costTracking
            .Setup(c => c.CheckLimitAsync(It.IsAny<string>(), It.IsAny<decimal>()))
            .ReturnsAsync(new CostLimitCheckResult
            {
                Exceeded = true,
                LimitType = "session",
                Enforcement = "block",
                AutoResume = false,
                CurrentValue = 1.05m,
                MaxValue = 1.00m,
                Message = "Session limit exceeded"
            });

        var handler = CreateHandler();
        var session = CreateTestSession();

        await handler.CheckCostBeforeExecutionAsync(session, "node-1", "block-ref-1");

        // Session should NOT have an error status variable set by the handler
        // The handler only sets cost-related variables, not session status
        var costExceeded = session.GetVariable("_costLimitExceeded")?.ToString();
        Assert.Equal("true", costExceeded);
        // Verify it's a cost stop, not an error
        Assert.Contains("session", session.GetVariable("_costLimitType")?.ToString() ?? "");
    }

    // ════════════════════════════════════════════════════════════════
    // #22 — _costStopped* variables set after hard stop
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task HardStop_CostStoppedVariablesSet()
    {
        _costTracking
            .Setup(c => c.CheckLimitAsync(It.IsAny<string>(), It.IsAny<decimal>()))
            .ReturnsAsync(new CostLimitCheckResult
            {
                Exceeded = true,
                LimitType = "daily",
                Enforcement = "block",
                AutoResume = false,
                CurrentValue = 5.02m,
                MaxValue = 5.00m,
                Message = "Daily limit exceeded"
            });

        var handler = CreateHandler();
        var session = CreateTestSession();

        await handler.CheckCostBeforeExecutionAsync(session, "node-42", "block-ref-1");

        Assert.NotNull(session.GetVariable("_costStoppedAt"));
        Assert.Equal("node-42", session.GetVariable("_costStoppedNodeId")?.ToString());
        Assert.NotNull(session.GetVariable("_costStoppedEntryPoint"));
        Assert.Equal("daily", session.GetVariable("_costLimitType")?.ToString());
    }

    // ════════════════════════════════════════════════════════════════
    // #23 — _costAutoResume set from config
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task HardStop_CostAutoResumeSetFromConfig()
    {
        _costTracking
            .Setup(c => c.CheckLimitAsync(It.IsAny<string>(), It.IsAny<decimal>()))
            .ReturnsAsync(new CostLimitCheckResult
            {
                Exceeded = true,
                LimitType = "daily",
                Enforcement = "block",
                AutoResume = true, // auto-resume enabled
                CurrentValue = 5.02m,
                MaxValue = 5.00m,
                Message = "Daily limit exceeded"
            });

        var handler = CreateHandler();
        var session = CreateTestSession();

        await handler.CheckCostBeforeExecutionAsync(session, "node-1", "block-ref-1");

        Assert.Equal("true", session.GetVariable("_costAutoResume")?.ToString());
    }
}
