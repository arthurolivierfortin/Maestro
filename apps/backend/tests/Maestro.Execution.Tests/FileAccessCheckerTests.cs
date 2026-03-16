#nullable enable

using System.Collections.Generic;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.BlockExecutors;
using Xunit;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Execution.Tests;

/// <summary>
/// Tests for FileAccessChecker: permission checking, path matching, serialization/deserialization.
/// Phase 59-T: Validates file access rule enforcement for agent isolation.
/// </summary>
public class FileAccessCheckerTests
{
    private const string WorkingDir = "/projects/myapp";

    private static ExecutionContext CreateContextWithRules(params FileAccessRule[] rules)
    {
        var ctx = new ExecutionContext();
        if (rules.Length > 0)
        {
            ctx.Variables[FileAccessChecker.FileAccessRulesKey] =
                FileAccessChecker.SerializeRules(rules);
        }
        return ctx;
    }

    // ═══════════════════════════════════════════════════════════
    // Permission level checks
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void ReadWrite_AllowsReadAndWrite()
    {
        var ctx = CreateContextWithRules(
            new FileAccessRule { Path = "data.txt", Permission = FileAccessPermission.ReadWrite });

        Assert.Null(FileAccessChecker.CheckReadAccess(ctx, "data.txt", WorkingDir));
        Assert.Null(FileAccessChecker.CheckWriteAccess(ctx, "data.txt", WorkingDir));
        Assert.True(FileAccessChecker.IsVisibleInListing(ctx, "data.txt", WorkingDir));
    }

    [Fact]
    public void ReadOnly_AllowsRead_DeniesWrite()
    {
        var ctx = CreateContextWithRules(
            FileAccessRule.ReadOnly("config.json"));

        Assert.Null(FileAccessChecker.CheckReadAccess(ctx, "config.json", WorkingDir));
        Assert.NotNull(FileAccessChecker.CheckWriteAccess(ctx, "config.json", WorkingDir));
        Assert.True(FileAccessChecker.IsVisibleInListing(ctx, "config.json", WorkingDir));
    }

    [Fact]
    public void Hidden_DeniesReadAndWrite_HiddenInListing()
    {
        var ctx = CreateContextWithRules(
            FileAccessRule.Hidden("secrets.env"));

        Assert.NotNull(FileAccessChecker.CheckReadAccess(ctx, "secrets.env", WorkingDir));
        Assert.NotNull(FileAccessChecker.CheckWriteAccess(ctx, "secrets.env", WorkingDir));
        Assert.False(FileAccessChecker.IsVisibleInListing(ctx, "secrets.env", WorkingDir));
    }

    [Fact]
    public void Excluded_DeniesReadAndWrite_HiddenInListing()
    {
        var ctx = CreateContextWithRules(
            FileAccessRule.Excluded("node_modules", FileAccessType.Directory));

        // File inside excluded directory
        var permission = FileAccessChecker.GetPermission(ctx, "node_modules/something.js", WorkingDir);

        Assert.Equal(FileAccessPermission.Excluded, permission);
        Assert.NotNull(FileAccessChecker.CheckReadAccess(ctx, "node_modules/something.js", WorkingDir));
        Assert.NotNull(FileAccessChecker.CheckWriteAccess(ctx, "node_modules/something.js", WorkingDir));
        Assert.False(FileAccessChecker.IsVisibleInListing(ctx, "node_modules/something.js", WorkingDir));
    }

    // ═══════════════════════════════════════════════════════════
    // No rules = allow all
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void NoRules_AllowsAll()
    {
        var ctx = new ExecutionContext(); // No rules set

        Assert.Equal(FileAccessPermission.ReadWrite,
            FileAccessChecker.GetPermission(ctx, "anything.txt", WorkingDir));
        Assert.Null(FileAccessChecker.CheckReadAccess(ctx, "anything.txt", WorkingDir));
        Assert.Null(FileAccessChecker.CheckWriteAccess(ctx, "anything.txt", WorkingDir));
        Assert.True(FileAccessChecker.IsVisibleInListing(ctx, "anything.txt", WorkingDir));
    }

    [Fact]
    public void EmptyRulesKey_AllowsAll()
    {
        var ctx = new ExecutionContext();
        ctx.Variables[FileAccessChecker.FileAccessRulesKey] = "";

        Assert.Equal(FileAccessPermission.ReadWrite,
            FileAccessChecker.GetPermission(ctx, "anything.txt", WorkingDir));
    }

    // ═══════════════════════════════════════════════════════════
    // Path matching
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void DirectoryRule_MatchesFilesInDirectory()
    {
        var ctx = CreateContextWithRules(
            FileAccessRule.Hidden(".git", FileAccessType.Directory));

        Assert.Equal(FileAccessPermission.Hidden,
            FileAccessChecker.GetPermission(ctx, ".git/config", WorkingDir));
        Assert.Equal(FileAccessPermission.Hidden,
            FileAccessChecker.GetPermission(ctx, ".git/HEAD", WorkingDir));
    }

    [Fact]
    public void FileRule_MatchesExactFile()
    {
        var ctx = CreateContextWithRules(
            FileAccessRule.Hidden("secrets.env"));

        Assert.Equal(FileAccessPermission.Hidden,
            FileAccessChecker.GetPermission(ctx, "secrets.env", WorkingDir));
        // A different file should not match
        Assert.Equal(FileAccessPermission.ReadWrite,
            FileAccessChecker.GetPermission(ctx, "config.env", WorkingDir));
    }

    [Fact]
    public void FirstMatchWins()
    {
        // First rule: secrets.env is Hidden
        // Second rule: *.env is ReadOnly (if we interpret it literally, it won't match since there's no glob)
        // But let's test with two rules for the same path — first should win
        var ctx = CreateContextWithRules(
            FileAccessRule.Hidden("secrets.env"),
            new FileAccessRule { Path = "secrets.env", Permission = FileAccessPermission.ReadWrite });

        Assert.Equal(FileAccessPermission.Hidden,
            FileAccessChecker.GetPermission(ctx, "secrets.env", WorkingDir));
    }

    [Fact]
    public void UnmatchedPath_ReturnsReadWrite()
    {
        var ctx = CreateContextWithRules(
            FileAccessRule.Hidden("secrets.env"));

        // A file not matching any rule gets default ReadWrite
        Assert.Equal(FileAccessPermission.ReadWrite,
            FileAccessChecker.GetPermission(ctx, "readme.md", WorkingDir));
    }

    // ═══════════════════════════════════════════════════════════
    // Serialization round-trip
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void SerializeRules_RoundTrips()
    {
        var rules = new List<FileAccessRule>
        {
            FileAccessRule.Hidden("secrets.env", reason: "Sensitive file"),
            FileAccessRule.ReadOnly("config.json"),
            FileAccessRule.Excluded("node_modules", FileAccessType.Directory)
        };

        var serialized = FileAccessChecker.SerializeRules(rules);

        // Put in context and verify deserialized rules work
        var ctx = new ExecutionContext();
        ctx.Variables[FileAccessChecker.FileAccessRulesKey] = serialized;

        Assert.Equal(FileAccessPermission.Hidden,
            FileAccessChecker.GetPermission(ctx, "secrets.env", WorkingDir));
        Assert.Equal(FileAccessPermission.ReadOnly,
            FileAccessChecker.GetPermission(ctx, "config.json", WorkingDir));
    }

    [Fact]
    public void MalformedRulesJson_FailsOpen()
    {
        var ctx = new ExecutionContext();
        ctx.Variables[FileAccessChecker.FileAccessRulesKey] = "not valid json";

        // Malformed rules should fail open (no restriction)
        Assert.Equal(FileAccessPermission.ReadWrite,
            FileAccessChecker.GetPermission(ctx, "anything.txt", WorkingDir));
    }
}
