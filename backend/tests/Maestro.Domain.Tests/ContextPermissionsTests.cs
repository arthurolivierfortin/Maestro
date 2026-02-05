using Maestro.Domain.ValueObjects;
using Xunit;

namespace Maestro.Domain.Tests;

public class ContextPermissionsTests
{
    [Fact]
    public void HasCommand_WithWildcard_ReturnsTrue()
    {
        var permissions = ContextPermissions.Full;
        Assert.True(permissions.HasCommand("run"));
        Assert.True(permissions.HasCommand("list-tools"));
        Assert.True(permissions.HasCommand("anything"));
    }

    [Fact]
    public void HasCommand_WithSpecificCommands_ChecksCorrectly()
    {
        var permissions = new ContextPermissions
        {
            AllowedCommands = new() { "run", "list-tools" }
        };

        Assert.True(permissions.HasCommand("run"));
        Assert.True(permissions.HasCommand("list-tools"));
        Assert.False(permissions.HasCommand("data"));
        Assert.False(permissions.HasCommand("session"));
    }

    [Fact]
    public void HasTool_WithWildcard_ReturnsTrue()
    {
        var permissions = ContextPermissions.Full;
        Assert.True(permissions.HasTool("system:fitness-calculator"));
        Assert.True(permissions.HasTool("my-tool"));
    }

    [Fact]
    public void HasTool_WithPrefixPattern_MatchesCorrectly()
    {
        var permissions = new ContextPermissions
        {
            AllowedTools = new() { "system:*" }
        };

        Assert.True(permissions.HasTool("system:fitness-calculator"));
        Assert.True(permissions.HasTool("system:data-store"));
        Assert.False(permissions.HasTool("workspace:my-tool"));
    }

    [Fact]
    public void HasBlock_WithExplicitList_ChecksCorrectly()
    {
        var permissions = new ContextPermissions
        {
            AllowedBlocks = new() { "training-loop", "fitness-calculator" }
        };

        Assert.True(permissions.HasBlock("training-loop"));
        Assert.True(permissions.HasBlock("fitness-calculator"));
        Assert.False(permissions.HasBlock("experiment-manager"));
    }

    [Fact]
    public void Intersect_WithBothWildcards_PreservesWildcard()
    {
        var a = ContextPermissions.Full;
        var b = ContextPermissions.Full;

        var result = a.Intersect(b);

        Assert.Contains("*", result.AllowedCommands);
        Assert.True(result.CanCreateBlocks);
        Assert.True(result.CanCreateSessions);
    }

    [Fact]
    public void Intersect_WithOneWildcard_ReturnsSpecificList()
    {
        var a = ContextPermissions.Full;
        var b = new ContextPermissions
        {
            AllowedCommands = new() { "run", "data" },
            AllowedTools = new() { "system:fitness-calculator" }
        };

        var result = a.Intersect(b);

        Assert.Equal(2, result.AllowedCommands.Count);
        Assert.Contains("run", result.AllowedCommands);
        Assert.Contains("data", result.AllowedCommands);
        Assert.Single(result.AllowedTools);
        Assert.Contains("system:fitness-calculator", result.AllowedTools);
    }

    [Fact]
    public void Intersect_WithNoOverlap_ReturnsEmpty()
    {
        var a = new ContextPermissions
        {
            AllowedCommands = new() { "run" }
        };
        var b = new ContextPermissions
        {
            AllowedCommands = new() { "data" }
        };

        var result = a.Intersect(b);

        Assert.Empty(result.AllowedCommands);
    }

    [Fact]
    public void Intersect_BooleanProperties_UseLogicalAnd()
    {
        var a = new ContextPermissions
        {
            CanCreateBlocks = true,
            CanCreateSessions = false
        };
        var b = new ContextPermissions
        {
            CanCreateBlocks = true,
            CanCreateSessions = true
        };

        var result = a.Intersect(b);

        Assert.True(result.CanCreateBlocks);
        Assert.False(result.CanCreateSessions);
    }

    [Fact]
    public void None_HasNoPermissions()
    {
        var permissions = ContextPermissions.None;

        Assert.Empty(permissions.AllowedCommands);
        Assert.Empty(permissions.AllowedTools);
        Assert.Empty(permissions.AllowedBlocks);
        Assert.False(permissions.CanCreateBlocks);
        Assert.False(permissions.CanCreateSessions);
    }

    [Fact]
    public void ReadOnly_HasLimitedPermissions()
    {
        var permissions = ContextPermissions.ReadOnly;

        Assert.Contains("list-tools", permissions.AllowedCommands);
        Assert.Contains("list-blocks", permissions.AllowedCommands);
        Assert.Contains("describe", permissions.AllowedCommands);
        Assert.DoesNotContain("run", permissions.AllowedCommands);
        Assert.False(permissions.CanCreateBlocks);
    }
}
