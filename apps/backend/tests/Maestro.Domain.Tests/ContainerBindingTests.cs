using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;
using Xunit;

namespace Maestro.Domain.Tests;

public class ContainerBindingTests
{
    // ===== Factory Method Tests =====

    [Fact]
    public void CreateSandbox_WithDefaults_CreatesCorrectBinding()
    {
        var binding = ContainerBinding.CreateSandbox();

        Assert.Equal(ContainerBindingType.Sandbox, binding.Type);
        Assert.Equal(ContainerBinding.DefaultSandboxImage, binding.SandboxImage);
        Assert.Empty(binding.ExcludePatterns);
        Assert.True(binding.UsesContainer);
        Assert.True(binding.IsIsolated);
        Assert.False(binding.HasPersistentStorage);
    }

    [Fact]
    public void CreateSandbox_WithCustomImage_UsesCustomImage()
    {
        var customImage = "my-custom/sandbox:v2";
        var binding = ContainerBinding.CreateSandbox(customImage);

        Assert.Equal(customImage, binding.SandboxImage);
    }

    [Fact]
    public void CreateRepositoryBound_WithDefaults_CreatesCorrectBinding()
    {
        var repoPath = "C:/projects/my-app";
        var binding = ContainerBinding.CreateRepositoryBound(repoPath);

        Assert.Equal(ContainerBindingType.Repository, binding.Type);
        Assert.Equal(repoPath, binding.RepositoryPath);
        Assert.Equal("/workspace", binding.DockerBindPath);
        Assert.Equal(RepositoryAccessLevel.Controlled, binding.AccessLevel);
        Assert.NotEmpty(binding.ExcludePatterns);
        Assert.True(binding.UsesContainer);
        Assert.False(binding.IsIsolated);
        Assert.True(binding.HasPersistentStorage);
    }

    [Fact]
    public void CreateRepositoryBound_WithCustomOptions_UsesCustomOptions()
    {
        var repoPath = "/home/user/project";
        var binding = ContainerBinding.CreateRepositoryBound(
            repoPath,
            accessLevel: RepositoryAccessLevel.ReadOnly,
            dockerBindPath: "/app"
        );

        Assert.Equal(repoPath, binding.RepositoryPath);
        Assert.Equal("/app", binding.DockerBindPath);
        Assert.Equal(RepositoryAccessLevel.ReadOnly, binding.AccessLevel);
    }

    [Fact]
    public void CreateRepositoryBound_WithEmptyPath_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(() =>
            ContainerBinding.CreateRepositoryBound(""));

        Assert.Throws<ArgumentException>(() =>
            ContainerBinding.CreateRepositoryBound("   "));
    }

    [Fact]
    public void None_HasNoContainerBinding()
    {
        var binding = ContainerBinding.None;

        Assert.Equal(ContainerBindingType.None, binding.Type);
        Assert.False(binding.UsesContainer);
        Assert.False(binding.IsIsolated);
        Assert.False(binding.HasPersistentStorage);
    }

    // ===== Volume Mount Tests =====

    [Fact]
    public void GetVolumeMountString_ForRepository_ReturnsCorrectFormat()
    {
        var binding = ContainerBinding.CreateRepositoryBound(
            "/home/user/project",
            RepositoryAccessLevel.Controlled
        );

        var mountString = binding.GetVolumeMountString();

        Assert.Equal("/home/user/project:/workspace:rw", mountString);
    }

    [Fact]
    public void GetVolumeMountString_ForReadOnlyRepository_UsesReadOnlyMode()
    {
        var binding = ContainerBinding.CreateRepositoryBound(
            "/home/user/project",
            RepositoryAccessLevel.ReadOnly
        );

        var mountString = binding.GetVolumeMountString();

        Assert.Equal("/home/user/project:/workspace:ro", mountString);
    }

    [Fact]
    public void GetVolumeMountString_ForSandbox_ReturnsNull()
    {
        var binding = ContainerBinding.CreateSandbox();

        var mountString = binding.GetVolumeMountString();

        Assert.Null(mountString);
    }

    [Fact]
    public void GetVolumeMountString_ForNone_ReturnsNull()
    {
        var binding = ContainerBinding.None;

        var mountString = binding.GetVolumeMountString();

        Assert.Null(mountString);
    }

    // ===== Security Exclude Patterns Tests =====

    [Fact]
    public void DefaultSecurityExcludePatterns_ContainsEnvFiles()
    {
        Assert.Contains(".env", ContainerBinding.DefaultSecurityExcludePatterns);
        Assert.Contains(".env.*", ContainerBinding.DefaultSecurityExcludePatterns);
    }

    [Fact]
    public void DefaultSecurityExcludePatterns_ContainsKeyFiles()
    {
        Assert.Contains("*.pem", ContainerBinding.DefaultSecurityExcludePatterns);
        Assert.Contains("*.key", ContainerBinding.DefaultSecurityExcludePatterns);
    }

    [Fact]
    public void DefaultSecurityExcludePatterns_ContainsSecretsDirectories()
    {
        Assert.Contains("secrets/", ContainerBinding.DefaultSecurityExcludePatterns);
        Assert.Contains(".secrets/", ContainerBinding.DefaultSecurityExcludePatterns);
    }

    [Fact]
    public void RepositoryBound_IncludesSecurityPatterns()
    {
        var binding = ContainerBinding.CreateRepositoryBound("/project");

        Assert.Contains(".env", binding.ExcludePatterns);
        Assert.Contains("*.pem", binding.ExcludePatterns);
    }

    // ===== Equality Tests =====

    [Fact]
    public void TwoSandboxBindings_WithSameImage_HaveSameProperties()
    {
        var binding1 = ContainerBinding.CreateSandbox("test:latest");
        var binding2 = ContainerBinding.CreateSandbox("test:latest");

        // Compare key properties (RuntimeConfig has Dictionary which breaks record equality)
        Assert.Equal(binding1.Type, binding2.Type);
        Assert.Equal(binding1.SandboxImage, binding2.SandboxImage);
        Assert.Equal(binding1.DockerBindPath, binding2.DockerBindPath);
        Assert.Equal(binding1.UsesContainer, binding2.UsesContainer);
        Assert.Equal(binding1.IsIsolated, binding2.IsIsolated);
    }

    [Fact]
    public void TwoRepositoryBindings_WithSameConfig_HaveSameProperties()
    {
        var binding1 = ContainerBinding.CreateRepositoryBound("/project", RepositoryAccessLevel.Full);
        var binding2 = ContainerBinding.CreateRepositoryBound("/project", RepositoryAccessLevel.Full);

        Assert.Equal(binding1.Type, binding2.Type);
        Assert.Equal(binding1.RepositoryPath, binding2.RepositoryPath);
        Assert.Equal(binding1.AccessLevel, binding2.AccessLevel);
        Assert.Equal(binding1.DockerBindPath, binding2.DockerBindPath);
    }

    [Fact]
    public void NoneBinding_IsAlwaysEqual()
    {
        var binding1 = ContainerBinding.None;
        var binding2 = ContainerBinding.None;

        // None has no RuntimeConfig, so record equality works
        Assert.Equal(binding1, binding2);
    }
}
