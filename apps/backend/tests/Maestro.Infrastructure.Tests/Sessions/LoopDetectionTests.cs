using System.Collections.Generic;
using System.Linq;
using Maestro.Infrastructure.Sessions;

namespace Maestro.Infrastructure.Tests.Sessions;

/// <summary>
/// Tests for the loop detection logic extracted from NodeExecutionEngine (Phase 61-B).
/// Verifies that DetectLoop correctly identifies stuck agents.
/// </summary>
public class LoopDetectionTests
{
    [Fact]
    public void LoopDetection_ForcesStopAfter5IdenticalToolCalls()
    {
        var recentToolCalls = new List<string>
            { "file-read", "file-read", "file-read", "file-read", "file-read" };

        var result = NodeExecutionEngine.DetectLoop(recentToolCalls);

        Assert.Equal(NodeExecutionEngine.LoopDetectionResult.ForceStop, result);
    }

    [Fact]
    public void LoopDetection_WarnsAfter3IdenticalToolCalls()
    {
        var recentToolCalls = new List<string>
            { "file-read", "file-read", "file-read" };

        var result = NodeExecutionEngine.DetectLoop(recentToolCalls);

        Assert.Equal(NodeExecutionEngine.LoopDetectionResult.Warning, result);
    }

    [Fact]
    public void LoopDetection_DoesNotTriggerForMixedCalls()
    {
        var recentToolCalls = new List<string>
            { "file-read", "file-write", "file-read", "contract-test", "file-read" };

        var result = NodeExecutionEngine.DetectLoop(recentToolCalls);

        Assert.Equal(NodeExecutionEngine.LoopDetectionResult.None, result);
    }

    [Fact]
    public void LoopDetection_ExcludesStepComplete()
    {
        // step-complete is excluded from loop detection — it's the normal way to end an agent
        var recentToolCalls = new List<string>
            { "step-complete", "step-complete", "step-complete", "step-complete", "step-complete" };

        var result = NodeExecutionEngine.DetectLoop(recentToolCalls);

        Assert.Equal(NodeExecutionEngine.LoopDetectionResult.None, result);
    }

    [Fact]
    public void LoopDetection_NoneForFewerThan3Calls()
    {
        var recentToolCalls = new List<string> { "file-read", "file-read" };

        var result = NodeExecutionEngine.DetectLoop(recentToolCalls);

        Assert.Equal(NodeExecutionEngine.LoopDetectionResult.None, result);
    }

    [Fact]
    public void LoopDetection_WarnsAt3EvenWith6TotalMixed()
    {
        // The last 3 are identical, the first 3 are mixed — should warn
        var recentToolCalls = new List<string>
            { "file-write", "shell-exec", "contract-test", "file-read", "file-read", "file-read" };

        var result = NodeExecutionEngine.DetectLoop(recentToolCalls);

        // Last 5 are not all identical, but last 3 are → Warning
        Assert.Equal(NodeExecutionEngine.LoopDetectionResult.Warning, result);
    }

    [Fact]
    public void LoopDetection_ForceStopWhenLast5IdenticalWithMixedPrefix()
    {
        // 2 mixed + 5 identical → ForceStop
        var recentToolCalls = new List<string>
            { "file-write", "shell-exec", "file-read", "file-read", "file-read", "file-read", "file-read" };

        var result = NodeExecutionEngine.DetectLoop(recentToolCalls);

        Assert.Equal(NodeExecutionEngine.LoopDetectionResult.ForceStop, result);
    }

    [Fact]
    public void LoopDetection_4IdenticalIsWarningNotForceStop()
    {
        var recentToolCalls = new List<string>
            { "file-read", "file-read", "file-read", "file-read" };

        var result = NodeExecutionEngine.DetectLoop(recentToolCalls);

        // 4 identical: last 3 are identical → Warning, but not ForceStop (needs 5)
        Assert.Equal(NodeExecutionEngine.LoopDetectionResult.Warning, result);
    }

    [Fact]
    public void LoopDetection_EmptyListReturnsNone()
    {
        var recentToolCalls = new List<string>();

        var result = NodeExecutionEngine.DetectLoop(recentToolCalls);

        Assert.Equal(NodeExecutionEngine.LoopDetectionResult.None, result);
    }

    [Fact]
    public void SameToolDifferentArgs_DoesNotTriggerLoop()
    {
        // 5x "file-read" with different args hashes should NOT trigger ForceStop
        // because each call reads a different file (different composite key)
        var recentToolCalls = new List<string>
        {
            "file-read:111",
            "file-read:222",
            "file-read:333",
            "file-read:444",
            "file-read:555"
        };

        var result = NodeExecutionEngine.DetectLoop(recentToolCalls);

        Assert.Equal(NodeExecutionEngine.LoopDetectionResult.None, result);
    }

    [Fact]
    public void SameToolSameArgs_TriggersForceStop()
    {
        // 5x "file-read" with the SAME args hash = loop (same file read 5 times)
        var recentToolCalls = new List<string>
        {
            "file-read:12345",
            "file-read:12345",
            "file-read:12345",
            "file-read:12345",
            "file-read:12345"
        };

        var result = NodeExecutionEngine.DetectLoop(recentToolCalls);

        Assert.Equal(NodeExecutionEngine.LoopDetectionResult.ForceStop, result);
    }

    [Fact]
    public void StepComplete_WithArgsHash_StillExcluded()
    {
        // step-complete with args hash should still be excluded from loop detection
        var recentToolCalls = new List<string>
        {
            "step-complete:999",
            "step-complete:999",
            "step-complete:999",
            "step-complete:999",
            "step-complete:999"
        };

        var result = NodeExecutionEngine.DetectLoop(recentToolCalls);

        Assert.Equal(NodeExecutionEngine.LoopDetectionResult.None, result);
    }

    [Fact]
    public void ExtractToolIdFromLoopKey_WithHash()
    {
        var toolId = NodeExecutionEngine.ExtractToolIdFromLoopKey("file-read:12345");

        Assert.Equal("file-read", toolId);
    }

    [Fact]
    public void ExtractToolIdFromLoopKey_WithoutHash()
    {
        var toolId = NodeExecutionEngine.ExtractToolIdFromLoopKey("file-read");

        Assert.Equal("file-read", toolId);
    }

    [Fact]
    public void GetLoopingToolId_ReturnsLastToolCall()
    {
        var recentToolCalls = new List<string> { "file-read", "file-write", "shell-exec" };

        var toolId = NodeExecutionEngine.GetLoopingToolId(recentToolCalls);

        Assert.Equal("shell-exec", toolId);
    }

    [Fact]
    public void GetLoopingToolId_ReturnsNullForEmptyList()
    {
        var recentToolCalls = new List<string>();

        var toolId = NodeExecutionEngine.GetLoopingToolId(recentToolCalls);

        Assert.Null(toolId);
    }
}
