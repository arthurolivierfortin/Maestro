using System;
using System.Collections.Generic;
using Maestro.Application.Interfaces;
using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.BlockExecutors;
using Moq;

namespace Maestro.Infrastructure.Tests.BlockExecutors;

/// <summary>
/// Tests for MultiNodeBlockExecutor.PreFlightCheck (Phase 61-B).
/// Verifies that the pre-flight check blocks when maxIterations is misconfigured.
/// </summary>
public class PreFlightCheckTests
{
    private readonly Mock<ISessionStateManager> _stateManager;
    private readonly ProjectSession _session;

    public PreFlightCheckTests()
    {
        _stateManager = new Mock<ISessionStateManager>();
        _session = ProjectSession.Create(
            "test-session",
            Authority.Human("test-user"),
            new ProjectSessionConfig());
    }

    [Fact]
    public void PreFlight_ValidMaxIterations_DoesNotThrow()
    {
        var block = BlockDefinition.Create("test-block", "Test Block", "agent");
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["maxIterations"] = "10",
            ["nodes"] = new List<object>()
        });

        // Should not throw
        MultiNodeBlockExecutor.PreFlightCheck(block, _session, _stateManager.Object);

        // Should log info with cost estimate
        _stateManager.Verify(s => s.AppendExecutionLog(_session, "info", It.Is<string>(m => m.Contains("Pre-flight:"))), Times.AtLeastOnce);
    }

    [Fact]
    public void PreFlight_MaxIterationsNotSet_DoesNotThrow()
    {
        var block = BlockDefinition.Create("test-block", "Test Block", "agent");
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["nodes"] = new List<object>()
        });

        // "not set" is informational — should NOT throw
        MultiNodeBlockExecutor.PreFlightCheck(block, _session, _stateManager.Object);

        _stateManager.Verify(s => s.AppendExecutionLog(_session, "info", It.Is<string>(m => m.Contains("not set"))), Times.AtLeastOnce);
    }

    [Fact]
    public void PreFlight_InvalidMaxIterations_Throws()
    {
        var block = BlockDefinition.Create("test-block", "Test Block", "agent");
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["maxIterations"] = "abc",
            ["nodes"] = new List<object>()
        });

        var ex = Assert.Throws<InvalidOperationException>(() =>
            MultiNodeBlockExecutor.PreFlightCheck(block, _session, _stateManager.Object));

        Assert.Contains("Pre-flight FAILED", ex.Message);
        Assert.Contains("abc", ex.Message);
        Assert.Contains("not a valid number", ex.Message);
    }

    [Fact]
    public void PreFlight_TemplateVariableWithResolvedSessionVar_DoesNotThrow()
    {
        var block = BlockDefinition.Create("test-block", "Test Block", "agent");
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["maxIterations"] = "{{maxIterations}}",
            ["nodes"] = new List<object>()
        });

        // Session variable IS set and IS a valid number
        _session.SetVariable("maxIterations", "15");

        // Should not throw — template variable resolves from session
        MultiNodeBlockExecutor.PreFlightCheck(block, _session, _stateManager.Object);
    }

    [Fact]
    public void PreFlight_TemplateVariableWithoutSessionVar_Throws()
    {
        var block = BlockDefinition.Create("test-block", "Test Block", "agent");
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["maxIterations"] = "{{maxIterations}}",
            ["nodes"] = new List<object>()
        });

        // Session variable NOT set — template variable unresolvable
        var ex = Assert.Throws<InvalidOperationException>(() =>
            MultiNodeBlockExecutor.PreFlightCheck(block, _session, _stateManager.Object));

        Assert.Contains("Pre-flight FAILED", ex.Message);
        Assert.Contains("template variable", ex.Message);
        Assert.Contains("not set or not a number", ex.Message);
    }

    [Fact]
    public void PreFlight_TemplateVariableWithNonNumericSessionVar_Throws()
    {
        var block = BlockDefinition.Create("test-block", "Test Block", "agent");
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["maxIterations"] = "{{maxIterations}}",
            ["nodes"] = new List<object>()
        });

        // Session variable IS set but is NOT a valid number
        _session.SetVariable("maxIterations", "not-a-number");

        var ex = Assert.Throws<InvalidOperationException>(() =>
            MultiNodeBlockExecutor.PreFlightCheck(block, _session, _stateManager.Object));

        Assert.Contains("Pre-flight FAILED", ex.Message);
    }

    [Fact]
    public void PreFlight_MaxIterationsAbove50_LogsWarning()
    {
        var block = BlockDefinition.Create("test-block", "Test Block", "agent");
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["maxIterations"] = "100",
            ["nodes"] = new List<object>()
        });

        MultiNodeBlockExecutor.PreFlightCheck(block, _session, _stateManager.Object);

        _stateManager.Verify(s => s.AppendExecutionLog(_session, "warning",
            It.Is<string>(m => m.Contains("exceeds recommended max"))), Times.Once);
    }

    [Fact]
    public void PreFlight_MaxIterationsZero_LogsWarning()
    {
        var block = BlockDefinition.Create("test-block", "Test Block", "agent");
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["maxIterations"] = "0",
            ["nodes"] = new List<object>()
        });

        MultiNodeBlockExecutor.PreFlightCheck(block, _session, _stateManager.Object);

        _stateManager.Verify(s => s.AppendExecutionLog(_session, "warning",
            It.Is<string>(m => m.Contains("invalid (must be > 0)"))), Times.Once);
    }

    [Fact]
    public void PreFlight_HighCost_LogsWarning()
    {
        var block = BlockDefinition.Create("test-block", "Test Block", "agent");
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["maxIterations"] = "40",
            ["nodes"] = new List<object>()
        });

        MultiNodeBlockExecutor.PreFlightCheck(block, _session, _stateManager.Object);

        // 40 * $0.14 = $5.60 — exceeds $5 threshold
        _stateManager.Verify(s => s.AppendExecutionLog(_session, "warning",
            It.Is<string>(m => m.Contains("exceeds $5"))), Times.Once);
    }

    [Fact]
    public void PreFlight_LowCost_NoWarning()
    {
        var block = BlockDefinition.Create("test-block", "Test Block", "agent");
        block.UpdateConfig(new Dictionary<string, object>
        {
            ["maxIterations"] = "10",
            ["nodes"] = new List<object>()
        });

        MultiNodeBlockExecutor.PreFlightCheck(block, _session, _stateManager.Object);

        // 10 * $0.14 = $1.40 — does NOT exceed $5 threshold
        _stateManager.Verify(s => s.AppendExecutionLog(_session, "warning",
            It.Is<string>(m => m.Contains("exceeds $5"))), Times.Never);
    }
}
