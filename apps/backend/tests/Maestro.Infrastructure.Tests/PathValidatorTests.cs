using System;
using System.IO;
using Maestro.Infrastructure.Containers;
using Xunit;

namespace Maestro.Infrastructure.Tests;

public class PathValidatorTests
{
    [Fact]
    public void IsPathUnderRoot_WithSubdirectory_ReturnsTrue()
    {
        var root = Path.GetTempPath();
        var child = Path.Combine(root, "subdir", "file.txt");

        Assert.True(PathValidator.IsPathUnderRoot(child, root));
    }

    [Fact]
    public void IsPathUnderRoot_WithSamePath_ReturnsTrue()
    {
        var root = Path.GetTempPath().TrimEnd(Path.DirectorySeparatorChar);

        Assert.True(PathValidator.IsPathUnderRoot(root, root));
    }

    [Fact]
    public void IsPathUnderRoot_WithTraversalAttack_ReturnsFalse()
    {
        var root = Path.Combine(Path.GetTempPath(), "sandbox");
        var attack = Path.Combine(root, "..", "..", "etc", "passwd");

        Assert.False(PathValidator.IsPathUnderRoot(attack, root));
    }

    [Fact]
    public void IsPathUnderRoot_WithUnrelatedPath_ReturnsFalse()
    {
        var root = Path.Combine(Path.GetTempPath(), "allowed");
        var unrelated = Path.Combine(Path.GetTempPath(), "other", "file.txt");

        Assert.False(PathValidator.IsPathUnderRoot(unrelated, root));
    }

    [Fact]
    public void ValidateAndResolve_WithValidPath_ReturnsResolvedPath()
    {
        var root = Path.GetTempPath();
        var requested = Path.Combine(root, "valid", "file.txt");

        var result = PathValidator.ValidateAndResolve(requested, root);

        Assert.Equal(Path.GetFullPath(requested), result);
    }

    [Fact]
    public void ValidateAndResolve_WithTraversal_ThrowsException()
    {
        var root = Path.Combine(Path.GetTempPath(), "sandbox");
        var attack = Path.Combine(root, "..", "..", "etc", "passwd");

        Assert.Throws<InvalidOperationException>(() =>
            PathValidator.ValidateAndResolve(attack, root));
    }
}
