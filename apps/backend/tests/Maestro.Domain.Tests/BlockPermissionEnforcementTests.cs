using Maestro.Domain.ValueObjects;
using Xunit;

namespace Maestro.Domain.Tests;

/// <summary>
/// Tests for BlockPermission.Matches() pattern matching.
/// Phase 59-T: Validates exact, wildcard, and global matching.
/// </summary>
public class BlockPermissionEnforcementTests
{
    [Fact]
    public void Matches_ExactBlockId_ReturnsTrue()
    {
        var rule = BlockPermission.Deny("agents/test-designer");

        Assert.True(rule.Matches("agents/test-designer"));
    }

    [Fact]
    public void Matches_ExactBlockId_CaseInsensitive()
    {
        var rule = BlockPermission.Deny("Agents/Test-Designer");

        Assert.True(rule.Matches("agents/test-designer"));
    }

    [Fact]
    public void Matches_WildcardPattern_ReturnsTrue()
    {
        var rule = BlockPermission.Deny("agents/*");

        Assert.True(rule.Matches("agents/test-designer"));
        Assert.True(rule.Matches("agents/code-reviewer"));
    }

    [Fact]
    public void Matches_DifferentBlock_ReturnsFalse()
    {
        var rule = BlockPermission.Deny("agents/test-designer");

        Assert.False(rule.Matches("agents/code-reviewer"));
    }

    [Fact]
    public void Matches_WildcardDoesNotMatchDifferentPrefix()
    {
        var rule = BlockPermission.Deny("agents/*");

        Assert.False(rule.Matches("tools/git-diff"));
    }

    [Fact]
    public void Matches_GlobalWildcard_MatchesAll()
    {
        var rule = BlockPermission.Deny("*");

        Assert.True(rule.Matches("agents/test-designer"));
        Assert.True(rule.Matches("tools/git-diff"));
        Assert.True(rule.Matches("anything"));
    }

    [Fact]
    public void Matches_EmptyBlockId_ReturnsFalse()
    {
        var rule = BlockPermission.Deny("agents/*");

        Assert.False(rule.Matches(""));
    }

    [Fact]
    public void Matches_NullBlockId_ReturnsFalse()
    {
        var rule = BlockPermission.Deny("agents/*");

        Assert.False(rule.Matches(null!));
    }

    [Fact]
    public void Allow_HasCorrectPermissionLevel()
    {
        var rule = BlockPermission.Allow("agents/*");

        Assert.Equal(BlockPermissionLevel.Allowed, rule.Permission);
    }

    [Fact]
    public void Deny_HasCorrectPermissionLevel()
    {
        var rule = BlockPermission.Deny("agents/*");

        Assert.Equal(BlockPermissionLevel.Denied, rule.Permission);
    }

    [Fact]
    public void RequiresApproval_HasCorrectPermissionLevel()
    {
        var rule = BlockPermission.RequiresApproval("agents/*");

        Assert.Equal(BlockPermissionLevel.RequiresApproval, rule.Permission);
    }
}
