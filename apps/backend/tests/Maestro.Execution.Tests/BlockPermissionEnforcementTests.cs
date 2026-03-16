#nullable enable

using System;
using System.Collections.Generic;
using Maestro.Application.Interfaces;
using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.BlockExecutors;
using Maestro.Infrastructure.Sessions.NodeHandlers;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Maestro.Execution.Tests;

/// <summary>
/// Tests for BlockPermission enforcement in BlockRefHandler.CheckBlockPermission().
/// Phase 59-T: Validates that block permissions are correctly enforced during dispatch.
/// </summary>
public class BlockPermissionEnforcementTests
{
    private static ProjectSession CreateSessionWithPermissions(params BlockPermission[] permissions)
    {
        var session = ProjectSession.Create(
            "test-session",
            Authority.Human("tester"),
            new ProjectSessionConfig());
        session.SetBlockPermissions(permissions);
        return session;
    }

    // ═══════════════════════════════════════════════════════════
    // CheckBlockPermission — static method tests
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void AllowedBlock_ReturnsAllowed()
    {
        var session = CreateSessionWithPermissions(
            BlockPermission.Allow("agents/*"));

        var result = BlockRefHandler.CheckBlockPermission(session, "agents/test-designer");

        Assert.Equal(BlockPermissionLevel.Allowed, result);
    }

    [Fact]
    public void DeniedBlock_ReturnsDenied()
    {
        var session = CreateSessionWithPermissions(
            BlockPermission.Deny("agents/dangerous-agent"));

        var result = BlockRefHandler.CheckBlockPermission(session, "agents/dangerous-agent");

        Assert.Equal(BlockPermissionLevel.Denied, result);
    }

    [Fact]
    public void RequiresApprovalBlock_ReturnsRequiresApproval()
    {
        var session = CreateSessionWithPermissions(
            BlockPermission.RequiresApproval("agents/risky-agent"));

        var result = BlockRefHandler.CheckBlockPermission(session, "agents/risky-agent");

        Assert.Equal(BlockPermissionLevel.RequiresApproval, result);
    }

    [Fact]
    public void NoRules_DefaultAllowed()
    {
        var session = CreateSessionWithPermissions(); // Empty permissions

        var result = BlockRefHandler.CheckBlockPermission(session, "agents/any-agent");

        Assert.Equal(BlockPermissionLevel.Allowed, result);
    }

    [Fact]
    public void NoMatchingRule_DefaultAllowed()
    {
        var session = CreateSessionWithPermissions(
            BlockPermission.Deny("tools/dangerous-tool"));

        var result = BlockRefHandler.CheckBlockPermission(session, "agents/safe-agent");

        Assert.Equal(BlockPermissionLevel.Allowed, result);
    }

    [Fact]
    public void WildcardDeny_MatchesAll()
    {
        var session = CreateSessionWithPermissions(
            BlockPermission.Deny("*"));

        var result = BlockRefHandler.CheckBlockPermission(session, "agents/any-agent");

        Assert.Equal(BlockPermissionLevel.Denied, result);
    }

    [Fact]
    public void FirstMatchWins_AllowBeforeDeny()
    {
        var session = CreateSessionWithPermissions(
            BlockPermission.Allow("agents/test-designer"),
            BlockPermission.Deny("agents/*"));

        var result = BlockRefHandler.CheckBlockPermission(session, "agents/test-designer");

        Assert.Equal(BlockPermissionLevel.Allowed, result);
    }

    [Fact]
    public void FirstMatchWins_DenyBeforeAllow()
    {
        var session = CreateSessionWithPermissions(
            BlockPermission.Deny("agents/*"),
            BlockPermission.Allow("agents/test-designer"));

        // "agents/*" matches first — deny wins
        var result = BlockRefHandler.CheckBlockPermission(session, "agents/test-designer");

        Assert.Equal(BlockPermissionLevel.Denied, result);
    }

    [Fact]
    public void PatternMatching_WildcardPrefix()
    {
        var session = CreateSessionWithPermissions(
            BlockPermission.Deny("tools/*"));

        Assert.Equal(BlockPermissionLevel.Denied,
            BlockRefHandler.CheckBlockPermission(session, "tools/git-diff"));
        Assert.Equal(BlockPermissionLevel.Denied,
            BlockRefHandler.CheckBlockPermission(session, "tools/file-read"));
        Assert.Equal(BlockPermissionLevel.Allowed,
            BlockRefHandler.CheckBlockPermission(session, "agents/code-reviewer"));
    }

    // ═══════════════════════════════════════════════════════════
    // Child session inherits block permissions
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void ChildSession_InheritsBlockPermissions_EnforcedCorrectly()
    {
        var parent = ProjectSession.Create(
            "parent",
            Authority.Human("tester"),
            new ProjectSessionConfig());
        parent.SetBlockPermissions(new[]
        {
            BlockPermission.Deny("tools/dangerous"),
            BlockPermission.Allow("agents/*")
        });

        var child = ProjectSession.CreateAsChild("child", parent);

        Assert.Equal(BlockPermissionLevel.Denied,
            BlockRefHandler.CheckBlockPermission(child, "tools/dangerous"));
        Assert.Equal(BlockPermissionLevel.Allowed,
            BlockRefHandler.CheckBlockPermission(child, "agents/test-designer"));
    }
}
