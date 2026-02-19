using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;
using Xunit;

namespace Maestro.Domain.Tests;

public class ContainerSessionTests
{
    // ===== Test Implementation =====

    /// <summary>
    /// Concrete implementation of ContainerSession for testing purposes.
    /// Simulates a simple session without parent context (like Workspace).
    /// </summary>
    private class TestRootSession : ContainerSession
    {
        public override ContainerSession? GetParentContext() => null;
        public override string GetStorageExtension() => ".test.json";

        protected override bool CanTransitionTo(ContainerSessionStatus newStatus)
        {
            return (Status, newStatus) switch
            {
                (ContainerSessionStatus.Created, ContainerSessionStatus.Active) => true,
                (ContainerSessionStatus.Active, ContainerSessionStatus.Paused) => true,
                (ContainerSessionStatus.Active, ContainerSessionStatus.Ended) => true,
                (ContainerSessionStatus.Paused, ContainerSessionStatus.Active) => true,
                (ContainerSessionStatus.Paused, ContainerSessionStatus.Ended) => true,
                _ => false
            };
        }

        public static TestRootSession Create(string name, ContextPermissions? permissions = null)
        {
            return new TestRootSession
            {
                Id = $"test-{Guid.NewGuid():N}",
                Name = name,
                Status = ContainerSessionStatus.Created,
                Permissions = permissions ?? ContextPermissions.Full,
                Binding = ContainerBinding.None,
                CreatedAt = DateTimeOffset.UtcNow
            };
        }

        // Expose protected method for testing
        public void TestTransitionTo(ContainerSessionStatus newStatus)
        {
            TransitionTo(newStatus);
        }
    }

    /// <summary>
    /// Concrete implementation with parent context for testing permission inheritance.
    /// </summary>
    private class TestChildSession : ContainerSession
    {
        private readonly ContainerSession? _parent;

        public TestChildSession(ContainerSession? parent = null)
        {
            _parent = parent;
        }

        public override ContainerSession? GetParentContext() => _parent;
        public override string GetStorageExtension() => ".test.json";

        protected override bool CanTransitionTo(ContainerSessionStatus newStatus)
        {
            return (Status, newStatus) switch
            {
                (ContainerSessionStatus.Created, ContainerSessionStatus.Active) => true,
                (ContainerSessionStatus.Active, ContainerSessionStatus.Paused) => true,
                (ContainerSessionStatus.Active, ContainerSessionStatus.Ended) => true,
                (ContainerSessionStatus.Paused, ContainerSessionStatus.Active) => true,
                (_, ContainerSessionStatus.Expired) => true,
                _ => false
            };
        }

        public static TestChildSession Create(
            string name,
            ContainerSession parent,
            ContextPermissions? permissions = null)
        {
            return new TestChildSession(parent)
            {
                Id = $"child-{Guid.NewGuid():N}",
                Name = name,
                Status = ContainerSessionStatus.Created,
                Permissions = permissions ?? ContextPermissions.Full,
                Binding = ContainerBinding.CreateSandbox(),
                CreatedAt = DateTimeOffset.UtcNow
            };
        }

        public static TestChildSession CreateWithBinding(
            string name,
            ContainerSession parent,
            ContainerBinding binding,
            ContextPermissions? permissions = null)
        {
            return new TestChildSession(parent)
            {
                Id = $"child-{Guid.NewGuid():N}",
                Name = name,
                Status = ContainerSessionStatus.Created,
                Permissions = permissions ?? ContextPermissions.Full,
                Binding = binding,
                CreatedAt = DateTimeOffset.UtcNow
            };
        }
    }

    // ===== Permission Inheritance Tests =====

    [Fact]
    public void GetEffectivePermissions_WithNoParent_ReturnsOwnPermissions()
    {
        var permissions = new ContextPermissions
        {
            AllowedCommands = new() { "run", "data" },
            CanCreateBlocks = true
        };
        var session = TestRootSession.Create("Root", permissions);

        var effective = session.GetEffectivePermissions();

        Assert.Equal(permissions.AllowedCommands, effective.AllowedCommands);
        Assert.True(effective.CanCreateBlocks);
    }

    [Fact]
    public void GetEffectivePermissions_WithParent_ReturnsIntersection()
    {
        var parentPermissions = new ContextPermissions
        {
            AllowedCommands = new() { "run", "data", "list-tools" },
            AllowedTools = new() { "system:*" },
            CanCreateBlocks = true
        };
        var parent = TestRootSession.Create("Parent", parentPermissions);

        var childPermissions = new ContextPermissions
        {
            AllowedCommands = new() { "run", "data" },  // Subset of parent
            AllowedTools = new() { "system:fitness-calculator" },  // More restrictive
            CanCreateBlocks = false  // More restrictive
        };
        var child = TestChildSession.Create("Child", parent, childPermissions);

        var effective = child.GetEffectivePermissions();

        Assert.Equal(2, effective.AllowedCommands.Count);
        Assert.Contains("run", effective.AllowedCommands);
        Assert.Contains("data", effective.AllowedCommands);
        Assert.DoesNotContain("list-tools", effective.AllowedCommands);
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
        var parent = TestRootSession.Create("Parent", parentPermissions);

        // Child tries to have more permissions than parent
        var childPermissions = new ContextPermissions
        {
            AllowedCommands = new() { "run", "data", "session" },  // More than parent
            CanCreateBlocks = true  // More than parent
        };
        var child = TestChildSession.Create("Child", parent, childPermissions);

        var effective = child.GetEffectivePermissions();

        // Should be limited to parent's permissions
        Assert.Single(effective.AllowedCommands);
        Assert.Contains("run", effective.AllowedCommands);
        Assert.False(effective.CanCreateBlocks);
    }

    [Fact]
    public void GetEffectivePermissions_ChainOfThree_IntersectsAll()
    {
        // Grandparent: full permissions
        var grandparent = TestRootSession.Create("Grandparent", ContextPermissions.Full);

        // Parent: restricts to subset
        var parentPermissions = new ContextPermissions
        {
            AllowedCommands = new() { "run", "data", "list-tools" },
            CanCreateBlocks = true
        };
        var parent = TestChildSession.Create("Parent", grandparent, parentPermissions);

        // Child: restricts further
        var childPermissions = new ContextPermissions
        {
            AllowedCommands = new() { "run" },
            CanCreateBlocks = false
        };
        var child = TestChildSession.Create("Child", parent, childPermissions);

        var effective = child.GetEffectivePermissions();

        Assert.Single(effective.AllowedCommands);
        Assert.Contains("run", effective.AllowedCommands);
        Assert.False(effective.CanCreateBlocks);
    }

    // ===== UpdatePermissions Tests =====

    [Fact]
    public void UpdatePermissions_WithNoParent_SetsDirectly()
    {
        var session = TestRootSession.Create("Root", ContextPermissions.None);

        var newPermissions = new ContextPermissions
        {
            AllowedCommands = new() { "run", "data" },
            CanCreateBlocks = true
        };
        session.UpdatePermissions(newPermissions);

        Assert.Equal(newPermissions.AllowedCommands, session.Permissions.AllowedCommands);
        Assert.True(session.Permissions.CanCreateBlocks);
        Assert.NotNull(session.UpdatedAt);
    }

    [Fact]
    public void UpdatePermissions_WithParent_RestrictsToParentMax()
    {
        var parentPermissions = new ContextPermissions
        {
            AllowedCommands = new() { "run" },
            CanCreateBlocks = false
        };
        var parent = TestRootSession.Create("Parent", parentPermissions);
        var child = TestChildSession.Create("Child", parent, ContextPermissions.None);

        // Try to set permissions exceeding parent
        var requestedPermissions = new ContextPermissions
        {
            AllowedCommands = new() { "run", "data", "session" },
            CanCreateBlocks = true
        };
        child.UpdatePermissions(requestedPermissions);

        // Should be intersected with parent
        Assert.Single(child.Permissions.AllowedCommands);
        Assert.Contains("run", child.Permissions.AllowedCommands);
        Assert.False(child.Permissions.CanCreateBlocks);
    }

    // ===== Permission Check Tests =====

    [Fact]
    public void HasCommandPermission_ChecksEffectivePermissions()
    {
        var session = TestRootSession.Create("Root", new ContextPermissions
        {
            AllowedCommands = new() { "run", "data" }
        });

        Assert.True(session.HasCommandPermission("run"));
        Assert.True(session.HasCommandPermission("data"));
        Assert.False(session.HasCommandPermission("session"));
    }

    [Fact]
    public void HasToolPermission_ChecksEffectivePermissions()
    {
        var session = TestRootSession.Create("Root", new ContextPermissions
        {
            AllowedTools = new() { "system:*" }
        });

        Assert.True(session.HasToolPermission("system:fitness-calculator"));
        Assert.False(session.HasToolPermission("workspace:my-tool"));
    }

    [Fact]
    public void HasBlockPermission_ChecksEffectivePermissions()
    {
        var session = TestRootSession.Create("Root", new ContextPermissions
        {
            AllowedBlocks = new() { "training-loop", "evaluator" }
        });

        Assert.True(session.HasBlockPermission("training-loop"));
        Assert.False(session.HasBlockPermission("unknown-block"));
    }

    // ===== Status Transition Tests =====

    [Fact]
    public void TransitionTo_ValidTransition_ChangesStatus()
    {
        var session = TestRootSession.Create("Test");
        Assert.Equal(ContainerSessionStatus.Created, session.Status);

        session.TestTransitionTo(ContainerSessionStatus.Active);

        Assert.Equal(ContainerSessionStatus.Active, session.Status);
        Assert.NotNull(session.UpdatedAt);
    }

    [Fact]
    public void TransitionTo_InvalidTransition_ThrowsException()
    {
        var session = TestRootSession.Create("Test");

        // Cannot go from Created directly to Ended
        Assert.Throws<InvalidOperationException>(() =>
            session.TestTransitionTo(ContainerSessionStatus.Ended));
    }

    [Fact]
    public void TransitionTo_ActiveToPaused_Succeeds()
    {
        var session = TestRootSession.Create("Test");
        session.TestTransitionTo(ContainerSessionStatus.Active);

        session.TestTransitionTo(ContainerSessionStatus.Paused);

        Assert.Equal(ContainerSessionStatus.Paused, session.Status);
    }

    [Fact]
    public void TransitionTo_PausedToActive_Succeeds()
    {
        var session = TestRootSession.Create("Test");
        session.TestTransitionTo(ContainerSessionStatus.Active);
        session.TestTransitionTo(ContainerSessionStatus.Paused);

        session.TestTransitionTo(ContainerSessionStatus.Active);

        Assert.Equal(ContainerSessionStatus.Active, session.Status);
    }

    // ===== Update Methods Tests =====

    [Fact]
    public void UpdateName_WithValidName_ChangesName()
    {
        var session = TestRootSession.Create("Original");

        session.UpdateName("New Name");

        Assert.Equal("New Name", session.Name);
        Assert.NotNull(session.UpdatedAt);
    }

    [Fact]
    public void UpdateName_WithEmptyName_ThrowsException()
    {
        var session = TestRootSession.Create("Original");

        Assert.Throws<ArgumentException>(() => session.UpdateName(""));
        Assert.Throws<ArgumentException>(() => session.UpdateName("   "));
    }

    [Fact]
    public void UpdateDescription_SetsDescription()
    {
        var session = TestRootSession.Create("Test");

        session.UpdateDescription("New description");

        Assert.Equal("New description", session.Description);
        Assert.NotNull(session.UpdatedAt);
    }

    [Fact]
    public void UpdateDescription_WithNull_ClearsDescription()
    {
        var session = TestRootSession.Create("Test");
        session.UpdateDescription("Initial description");

        session.UpdateDescription(null);

        Assert.Null(session.Description);
    }

    // ===== Container Binding Tests =====

    [Fact]
    public void UsesContainerIsolation_ReflectsBinding()
    {
        var parent = TestRootSession.Create("Parent");
        var sandboxSession = TestChildSession.CreateWithBinding(
            "SandboxTest",
            parent,
            ContainerBinding.CreateSandbox()
        );

        var noneSession = TestRootSession.Create("NoContainer");

        Assert.True(sandboxSession.UsesContainerIsolation);
        Assert.False(noneSession.UsesContainerIsolation);
    }

    [Fact]
    public void HasPersistentStorage_ReflectsBinding()
    {
        var parent = TestRootSession.Create("Parent");
        var repoSession = TestChildSession.CreateWithBinding(
            "RepoTest",
            parent,
            ContainerBinding.CreateRepositoryBound("/project")
        );

        var sandboxSession = TestChildSession.CreateWithBinding(
            "SandboxTest",
            parent,
            ContainerBinding.CreateSandbox()
        );

        Assert.True(repoSession.HasPersistentStorage);
        Assert.False(sandboxSession.HasPersistentStorage);
    }

    [Fact]
    public void GetVolumeMountString_DelegatesToBinding()
    {
        var parent = TestRootSession.Create("Parent");
        var repoSession = TestChildSession.CreateWithBinding(
            "RepoTest",
            parent,
            ContainerBinding.CreateRepositoryBound("/project")
        );

        var mountString = repoSession.GetVolumeMountString();

        Assert.Equal("/project:/workspace:rw", mountString);
    }

    // ===== Repository Binding Tests (Phase 12) =====

    [Fact]
    public void BindToRepository_SetsRepositoryPathAndBinding()
    {
        var session = TestRootSession.Create("Test");

        session.BindToRepository("/path/to/repo");

        Assert.NotNull(session.RepositoryPath);
        Assert.Contains("repo", session.RepositoryPath!);
        Assert.True(session.IsBoundToRepository);
        Assert.Equal(ContainerBindingType.Repository, session.Binding.Type);
    }

    [Fact]
    public void BindToRepository_WithAccessLevel_SetsCorrectBinding()
    {
        var session = TestRootSession.Create("Test");

        session.BindToRepository("/path/to/repo", RepositoryAccessLevel.ReadOnly);

        Assert.True(session.IsBoundToRepository);
        Assert.Equal(RepositoryAccessLevel.ReadOnly, session.Binding.AccessLevel);
    }

    [Fact]
    public void BindToRepository_AfterStart_Succeeds()
    {
        var session = TestRootSession.Create("Test");
        session.TestTransitionTo(ContainerSessionStatus.Active);

        session.BindToRepository("/path/to/repo");

        Assert.True(session.IsBoundToRepository);
    }

    [Fact]
    public void BindToRepository_WhenAlreadyBound_ThrowsException()
    {
        var session = TestRootSession.Create("Test");
        session.BindToRepository("/path/to/repo");

        Assert.Throws<InvalidOperationException>(() =>
            session.BindToRepository("/path/to/other-repo"));
    }

    [Fact]
    public void BindToRepository_WithEmptyPath_ThrowsException()
    {
        var session = TestRootSession.Create("Test");

        Assert.Throws<ArgumentException>(() =>
            session.BindToRepository(""));
        Assert.Throws<ArgumentException>(() =>
            session.BindToRepository("   "));
    }

    [Fact]
    public void IsBoundToRepository_WhenNotBound_ReturnsFalse()
    {
        var session = TestRootSession.Create("Test");

        Assert.False(session.IsBoundToRepository);
        Assert.Null(session.RepositoryPath);
    }

    [Fact]
    public void MaestroDataPath_WhenBound_ReturnsCorrectPath()
    {
        var session = TestRootSession.Create("Test");
        session.BindToRepository("/path/to/repo");

        Assert.NotNull(session.MaestroDataPath);
        Assert.Contains(".maestro", session.MaestroDataPath!);
    }

    [Fact]
    public void MaestroDataPath_WhenNotBound_ReturnsNull()
    {
        var session = TestRootSession.Create("Test");

        Assert.Null(session.MaestroDataPath);
    }

    // ===== ToString Tests =====

    [Fact]
    public void ToString_ReturnsReadableFormat()
    {
        var session = TestRootSession.Create("MySession");

        var str = session.ToString();

        Assert.Contains("TestRootSession", str);
        Assert.Contains("MySession", str);
        Assert.Contains("Created", str);
    }
}
