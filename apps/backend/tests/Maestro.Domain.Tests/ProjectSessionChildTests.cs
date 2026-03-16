using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;
using Xunit;

namespace Maestro.Domain.Tests;

/// <summary>
/// Tests for ProjectSession.CreateAsChild(), SetParentSession(), and GetParentContext().
/// Phase 59-T: Validates child session isolation, inheritance, and permission chain.
/// </summary>
public class ProjectSessionChildTests
{
    private static ProjectSession CreateParentSession(
        string name = "parent-session",
        ContextPermissions? permissions = null,
        string? workspaceId = null)
    {
        if (workspaceId != null)
        {
            return ProjectSession.CreateInWorkspace(
                name,
                Authority.Human("tester"),
                new ProjectSessionConfig(),
                workspaceId,
                repositoryPath: null,
                permissions: permissions ?? ContextPermissions.Full);
        }

        return ProjectSession.Create(
            name,
            Authority.Human("tester"),
            new ProjectSessionConfig(),
            repositoryPath: null,
            permissions: permissions ?? ContextPermissions.Full);
    }

    // ═══════════════════════════════════════════════════════════
    // CreateAsChild — core identity and isolation
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void CreateAsChild_SetsParentSessionId()
    {
        var parent = CreateParentSession();

        var child = ProjectSession.CreateAsChild("child", parent);

        Assert.Equal(parent.Id, child.ParentSessionId);
    }

    [Fact]
    public void CreateAsChild_InheritsWorkspaceId()
    {
        var parent = CreateParentSession(workspaceId: "workspace-123");

        var child = ProjectSession.CreateAsChild("child", parent);

        Assert.Equal("workspace-123", child.ParentWorkspaceId);
    }

    [Fact]
    public void CreateAsChild_HasEmptyVariables()
    {
        var parent = CreateParentSession();
        parent.SetVariable("someVar", "someValue");
        parent.SetVariable("_workflowCheckpoint", "checkpoint-data");
        parent.SetVariable("anotherVar", 42);

        var child = ProjectSession.CreateAsChild("child", parent);

        Assert.Empty(child.Variables);
    }

    [Fact]
    public void CreateAsChild_InheritsPermissions()
    {
        var parentPermissions = new ContextPermissions
        {
            AllowedCommands = new() { "run", "data" },
            CanCreateBlocks = false
        };
        var parent = CreateParentSession(permissions: parentPermissions);

        var child = ProjectSession.CreateAsChild("child", parent);

        // Child's Permissions should be the parent's effective permissions
        Assert.Contains("run", child.Permissions.AllowedCommands);
        Assert.Contains("data", child.Permissions.AllowedCommands);
        Assert.False(child.Permissions.CanCreateBlocks);
    }

    [Fact]
    public void CreateAsChild_InheritsFileAccessRules()
    {
        var parent = CreateParentSession();
        parent.SetFileAccessRules(new List<FileAccessRule>
        {
            FileAccessRule.Hidden("secrets.env"),
            FileAccessRule.ReadOnly("config.json")
        });

        var child = ProjectSession.CreateAsChild("child", parent);

        Assert.Equal(2, child.FileAccessRules.Count);
        Assert.Equal("secrets.env", child.FileAccessRules[0].Path);
        Assert.Equal(FileAccessPermission.Hidden, child.FileAccessRules[0].Permission);
        Assert.Equal("config.json", child.FileAccessRules[1].Path);
        Assert.Equal(FileAccessPermission.ReadOnly, child.FileAccessRules[1].Permission);
    }

    [Fact]
    public void CreateAsChild_InheritsBlockPermissions()
    {
        var parent = CreateParentSession();
        parent.SetBlockPermissions(new List<BlockPermission>
        {
            BlockPermission.Deny("dangerous-tool"),
            BlockPermission.Allow("safe-tool")
        });

        var child = ProjectSession.CreateAsChild("child", parent);

        Assert.Equal(2, child.BlockPermissions.Count);
        Assert.Equal("dangerous-tool", child.BlockPermissions[0].BlockPattern);
        Assert.Equal(BlockPermissionLevel.Denied, child.BlockPermissions[0].Permission);
        Assert.Equal("safe-tool", child.BlockPermissions[1].BlockPattern);
        Assert.Equal(BlockPermissionLevel.Allowed, child.BlockPermissions[1].Permission);
    }

    [Fact]
    public void CreateAsChild_IsActive()
    {
        var parent = CreateParentSession();

        var child = ProjectSession.CreateAsChild("child", parent);

        Assert.Equal(ContainerSessionStatus.Active, child.Status);
    }

    [Fact]
    public void CreateAsChild_InheritsRepositoryPath_WhenNotOverridden()
    {
        var parent = ProjectSession.Create(
            "parent",
            Authority.Human("tester"),
            new ProjectSessionConfig { Access = new AccessConfig { Level = AccessLevel.Full } },
            repositoryPath: "/projects/myapp");

        var child = ProjectSession.CreateAsChild("child", parent);

        Assert.Equal(parent.RepositoryPath, child.RepositoryPath);
    }

    [Fact]
    public void CreateAsChild_UsesOverrideRepositoryPath_WhenProvided()
    {
        var parent = ProjectSession.Create(
            "parent",
            Authority.Human("tester"),
            new ProjectSessionConfig { Access = new AccessConfig { Level = AccessLevel.Full } },
            repositoryPath: "/projects/myapp");

        var child = ProjectSession.CreateAsChild("child", parent, "/projects/other");

        Assert.Equal("/projects/other", child.RepositoryPath);
    }

    // ═══════════════════════════════════════════════════════════
    // GetParentContext / SetParentSession
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void GetParentContext_ReturnsParent_WhenSetByCreateAsChild()
    {
        var parent = CreateParentSession();

        var child = ProjectSession.CreateAsChild("child", parent);

        Assert.NotNull(child.GetParentContext());
        Assert.Equal(parent.Id, child.GetParentContext()!.Id);
    }

    [Fact]
    public void GetParentContext_ReturnsNull_WhenNotSet()
    {
        var session = CreateParentSession();

        Assert.Null(session.GetParentContext());
    }

    [Fact]
    public void SetParentSession_SetsTransientReference()
    {
        var parent = CreateParentSession();
        // Simulate a session loaded from repository (no transient parent)
        var child = ProjectSession.Create(
            "child",
            Authority.Human("tester"),
            new ProjectSessionConfig());

        Assert.Null(child.GetParentContext());

        child.SetParentSession(parent);

        Assert.NotNull(child.GetParentContext());
        Assert.Equal(parent.Id, child.GetParentContext()!.Id);
    }

    // ═══════════════════════════════════════════════════════════
    // GetEffectivePermissions — intersection with parent
    // ═══════════════════════════════════════════════════════════

    [Fact]
    public void GetEffectivePermissions_IntersectsWithParent()
    {
        var parentPermissions = new ContextPermissions
        {
            AllowedCommands = new() { "run" },
            CanCreateBlocks = false
        };
        var parent = CreateParentSession(permissions: parentPermissions);

        var child = ProjectSession.CreateAsChild("child", parent);

        // Child inherits parent's effective permissions, then GetEffectivePermissions
        // intersects child.Permissions with parent.GetEffectivePermissions()
        var effective = child.GetEffectivePermissions();

        // Child's Permissions = parent.GetEffectivePermissions() (from CreateAsChild)
        // Effective = parent.GetEffectivePermissions().Intersect(child.Permissions)
        // Both are the same, so result should be the parent's permissions
        Assert.Contains("run", effective.AllowedCommands);
        Assert.False(effective.CanCreateBlocks);
    }

    [Fact]
    public void GetEffectivePermissions_ChildCannotExceedParent()
    {
        var parentPermissions = new ContextPermissions
        {
            AllowedCommands = new() { "run" },
            CanCreateBlocks = false
        };
        var parent = CreateParentSession(permissions: parentPermissions);

        var child = ProjectSession.CreateAsChild("child", parent);

        // Even though child tries to expand permissions after creation:
        child.UpdatePermissions(new ContextPermissions
        {
            AllowedCommands = new() { "run", "data", "session" },
            CanCreateBlocks = true
        });

        var effective = child.GetEffectivePermissions();

        // Should still be limited to parent's permissions
        Assert.Single(effective.AllowedCommands);
        Assert.Contains("run", effective.AllowedCommands);
        Assert.False(effective.CanCreateBlocks);
    }
}
