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
/// Tests for cost limit resume scenarios: increased limits, changed enforcement,
/// auto-resume by period reset, and auto-resume disabled.
/// Phase 59-PRE-2-T — Tests #24-29.
/// </summary>
public class CostResumeTests
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

    /// <summary>
    /// Sets up a session as if it was previously stopped by a cost limit.
    /// </summary>
    private static void SetSessionAsCostStopped(
        ProjectSession session,
        string limitType = "daily",
        string? stoppedAt = null,
        bool autoResume = false)
    {
        session.SetVariable("_costLimitExceeded", "true");
        session.SetVariable("_costLimitType", limitType);
        session.SetVariable("_costLimitMessage", $"{limitType} limit exceeded");
        session.SetVariable("_costStoppedAt", stoppedAt ?? DateTime.UtcNow.AddHours(-1).ToString("o"));
        session.SetVariable("_costStoppedEntryPoint", "workflow-1");
        session.SetVariable("_costStoppedNodeId", "node-1");
        session.SetVariable("_costAutoResume", autoResume ? "true" : "false");
    }

    // ════════════════════════════════════════════════════════════════
    // #24 — Resume after limit increase
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Resume_AfterLimitIncrease_ExecutionPasses()
    {
        // First: limit exceeded
        _costTracking
            .Setup(c => c.CheckLimitAsync(It.IsAny<string>(), It.IsAny<decimal>()))
            .ReturnsAsync(CostLimitCheckResult.Ok()); // Now under the new higher limit

        var handler = CreateHandler();
        var session = CreateTestSession();
        SetSessionAsCostStopped(session, "daily");

        var result = await handler.CheckCostBeforeExecutionAsync(session, "node-2", "block-ref-2");

        Assert.Null(result); // null = execution continues (no stop)
        // Cost stop flags should be cleared since limit is no longer exceeded
        Assert.Null(session.GetVariable("_costLimitExceeded"));
    }

    // ════════════════════════════════════════════════════════════════
    // #25 — Resume after enforcement changed to warn
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Resume_AfterEnforcementChangedToWarn_Continues()
    {
        _costTracking
            .Setup(c => c.CheckLimitAsync(It.IsAny<string>(), It.IsAny<decimal>()))
            .ReturnsAsync(new CostLimitCheckResult
            {
                Exceeded = true,
                LimitType = "daily",
                Enforcement = "warn", // Changed from block to warn
                AutoResume = false,
                CurrentValue = 5.02m,
                MaxValue = 5.00m,
                Message = "Daily limit exceeded (warning)"
            });

        var handler = CreateHandler();
        var session = CreateTestSession();
        SetSessionAsCostStopped(session, "daily");

        var result = await handler.CheckCostBeforeExecutionAsync(session, "node-2", "block-ref-2");

        Assert.Null(result); // warn = continue, returns null
        Assert.Equal("true", session.GetVariable("_costLimitExceeded")?.ToString());
    }

    // ════════════════════════════════════════════════════════════════
    // #26 — Auto-resume: daily reset (stoppedAt = yesterday)
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task AutoResume_DailyReset_ClearsStopFlags()
    {
        // The daily period has reset, and the new period is under limit
        _costTracking
            .Setup(c => c.CheckLimitAsync(It.IsAny<string>(), It.IsAny<decimal>()))
            .ReturnsAsync(CostLimitCheckResult.Ok());

        var handler = CreateHandler();
        var session = CreateTestSession();

        // Stopped yesterday with auto-resume enabled
        var yesterday = DateTime.UtcNow.Date.AddDays(-1).AddHours(23);
        SetSessionAsCostStopped(session, "daily", yesterday.ToString("o"), autoResume: true);

        var result = await handler.CheckCostBeforeExecutionAsync(session, "node-1", "block-ref-1");

        Assert.Null(result); // Execution continues
        // Auto-resume should have cleared the stop flags
        Assert.Null(session.GetVariable("_costStoppedAt"));
    }

    // ════════════════════════════════════════════════════════════════
    // #27 — Auto-resume: same day — no auto-resume
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task AutoResume_SameDay_StillBlocked()
    {
        _costTracking
            .Setup(c => c.CheckLimitAsync(It.IsAny<string>(), It.IsAny<decimal>()))
            .ReturnsAsync(new CostLimitCheckResult
            {
                Exceeded = true,
                LimitType = "daily",
                Enforcement = "block",
                AutoResume = true,
                CurrentValue = 5.02m,
                MaxValue = 5.00m,
                Message = "Daily limit exceeded"
            });

        var handler = CreateHandler();
        var session = CreateTestSession();

        // Stopped earlier today — same day, no period reset
        var earlierToday = DateTime.UtcNow.Date.AddHours(1);
        SetSessionAsCostStopped(session, "daily", earlierToday.ToString("o"), autoResume: true);

        var result = await handler.CheckCostBeforeExecutionAsync(session, "node-1", "block-ref-1");

        Assert.NotNull(result); // Still blocked
        Assert.StartsWith("[COST-LIMIT-STOPPED]", result!);
    }

    // ════════════════════════════════════════════════════════════════
    // #28 — Auto-resume: weekly reset
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task AutoResume_WeeklyReset_ClearsStopFlags()
    {
        _costTracking
            .Setup(c => c.CheckLimitAsync(It.IsAny<string>(), It.IsAny<decimal>()))
            .ReturnsAsync(CostLimitCheckResult.Ok());

        var handler = CreateHandler();
        var session = CreateTestSession();

        // Stopped last week (8 days ago) with auto-resume enabled
        var lastWeek = DateTime.UtcNow.AddDays(-8);
        SetSessionAsCostStopped(session, "weekly", lastWeek.ToString("o"), autoResume: true);

        var result = await handler.CheckCostBeforeExecutionAsync(session, "node-1", "block-ref-1");

        Assert.Null(result); // Execution continues
        Assert.Null(session.GetVariable("_costStoppedAt"));
    }

    // ════════════════════════════════════════════════════════════════
    // #29 — No auto-resume when disabled
    // ════════════════════════════════════════════════════════════════

    [Fact]
    public async Task NoAutoResume_WhenDisabled_StillBlockedAfterPeriodReset()
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

        // Stopped yesterday but auto-resume is DISABLED
        var yesterday = DateTime.UtcNow.Date.AddDays(-1).AddHours(23);
        SetSessionAsCostStopped(session, "daily", yesterday.ToString("o"), autoResume: false);

        var result = await handler.CheckCostBeforeExecutionAsync(session, "node-1", "block-ref-1");

        // Without auto-resume, the stop flags are NOT auto-cleared.
        // BUT: TryAutoResumeAsync only runs if _costAutoResume == "true", so flags stay.
        // Then CheckLimitAsync runs and returns Exceeded=true (block), so still stopped.
        Assert.NotNull(result);
        Assert.StartsWith("[COST-LIMIT-STOPPED]", result!);
    }
}
