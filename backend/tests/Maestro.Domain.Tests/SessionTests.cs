using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;
using Xunit;

namespace Maestro.Domain.Tests;

public class SessionTests
{
    // ===== Test Implementation =====

    /// <summary>
    /// Concrete implementation of Session for testing purposes.
    /// Simulates a simple session type.
    /// </summary>
    private class TestSession : Session
    {
        private readonly ContainerSession? _parent;

        public TestSession(ContainerSession? parent = null)
        {
            _parent = parent;
        }

        public override SessionType SessionType => SessionType.Project;

        public override ContainerSession? GetParentContext() => _parent;

        public static TestSession Create(
            string name,
            Authority authority,
            ContainerSession? parent = null,
            ContextPermissions? permissions = null,
            ContainerBinding? binding = null)
        {
            return new TestSession(parent)
            {
                Id = $"test-{Guid.NewGuid():N}",
                Name = name,
                Authority = authority,
                Status = ContainerSessionStatus.Created,
                Permissions = permissions ?? ContextPermissions.Full,
                Binding = binding ?? ContainerBinding.CreateSandbox(),
                ParentWorkspaceId = (parent as Workspace)?.Id,
                ParentSessionId = (parent as Session)?.Id,
                CreatedAt = DateTimeOffset.UtcNow
            };
        }

        public static TestSession CreateInWorkspace(
            string name,
            Authority authority,
            Workspace workspace,
            ContextPermissions? permissions = null)
        {
            var session = Create(name, authority, workspace, permissions);
            session.ParentWorkspaceId = workspace.Id;
            return session;
        }
    }

    // ===== Lifecycle Tests =====

    [Fact]
    public void Start_FromCreated_TransitionsToActive()
    {
        var session = TestSession.Create("Test", Authority.Human());

        session.Start();

        Assert.Equal(ContainerSessionStatus.Active, session.Status);
        Assert.NotNull(session.StartedAt);
        Assert.True(session.IsRunning);
    }

    [Fact]
    public void Start_FromNonCreated_ThrowsException()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();

        Assert.Throws<InvalidOperationException>(() => session.Start());
    }

    [Fact]
    public void Pause_FromActive_TransitionsToPaused()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();

        session.Pause();

        Assert.Equal(ContainerSessionStatus.Paused, session.Status);
        Assert.True(session.IsPaused);
    }

    [Fact]
    public void Pause_FromNonActive_ThrowsException()
    {
        var session = TestSession.Create("Test", Authority.Human());

        Assert.Throws<InvalidOperationException>(() => session.Pause());
    }

    [Fact]
    public void Resume_FromPaused_TransitionsToActive()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();
        session.Pause();

        session.Resume();

        Assert.Equal(ContainerSessionStatus.Active, session.Status);
        Assert.True(session.IsRunning);
    }

    [Fact]
    public void Resume_FromNonPaused_ThrowsException()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();

        Assert.Throws<InvalidOperationException>(() => session.Resume());
    }

    [Fact]
    public void Stop_FromActive_TransitionsToEnded()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();

        session.Stop();

        Assert.Equal(ContainerSessionStatus.Ended, session.Status);
        Assert.Equal(SessionTerminalReason.Stopped, session.TerminalReason);
        Assert.NotNull(session.CompletedAt);
        Assert.True(session.IsTerminal);
    }

    [Fact]
    public void Complete_FromActive_TransitionsToEnded()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();

        session.Complete();

        Assert.Equal(ContainerSessionStatus.Ended, session.Status);
        Assert.Equal(SessionTerminalReason.Completed, session.TerminalReason);
        Assert.True(session.IsCompleted);
    }

    [Fact]
    public void Fail_SetsErrorMessage()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();

        session.Fail("Something went wrong");

        Assert.Equal(ContainerSessionStatus.Ended, session.Status);
        Assert.Equal(SessionTerminalReason.Failed, session.TerminalReason);
        Assert.Equal("Something went wrong", session.ErrorMessage);
        Assert.True(session.IsFailed);
    }

    [Fact]
    public void Cancel_FromActive_TransitionsToEnded()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();

        session.Cancel();

        Assert.Equal(ContainerSessionStatus.Ended, session.Status);
        Assert.Equal(SessionTerminalReason.Cancelled, session.TerminalReason);
    }

    // ===== Command Tests =====

    [Fact]
    public void SubmitCommand_InActiveSession_AddsToHistory()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();

        var command = session.SubmitCommand("ls -la");

        Assert.Single(session.CommandHistory);
        Assert.Equal("ls -la", command.Command);
        Assert.Equal(SessionCommandType.Shell, command.Type);
    }

    [Fact]
    public void SubmitCommand_InNonActiveSession_ThrowsException()
    {
        var session = TestSession.Create("Test", Authority.Human());

        Assert.Throws<InvalidOperationException>(() => session.SubmitCommand("ls"));
    }

    [Fact]
    public void RecordCommandResult_Success_MarksCommandCompleted()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();
        var command = session.SubmitCommand("echo hello");

        session.RecordCommandResult(command, success: true, output: "hello");

        Assert.True(command.Success);
        Assert.Equal("hello", command.Output);
    }

    [Fact]
    public void RecordCommandResult_Failure_MarksCommandFailed()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();
        var command = session.SubmitCommand("invalid-command");

        session.RecordCommandResult(command, success: false, error: "Command not found");

        Assert.False(command.Success);
        Assert.Equal("Command not found", command.Error);
    }

    // ===== Authority Tests =====

    [Fact]
    public void TransferControl_UpdatesAuthority()
    {
        var session = TestSession.Create("Test", Authority.Human("alice"));

        session.TransferControl(Authority.Agent("orchestrator"));

        Assert.Equal(AuthorityType.Agent, session.Authority.Type);
        Assert.Equal("orchestrator", session.Authority.Identifier);
    }

    [Fact]
    public void TransferControl_WithNull_ThrowsException()
    {
        var session = TestSession.Create("Test", Authority.Human());

        Assert.Throws<ArgumentNullException>(() => session.TransferControl(null!));
    }

    // ===== Block Registry Tests =====

    [Fact]
    public void InitializeBlockRegistry_SetsAvailableBlocks()
    {
        var session = TestSession.Create("Test", Authority.Human());
        var blockIds = new[] { "block-1", "block-2", "block-3" };

        session.InitializeBlockRegistry(blockIds);

        Assert.Equal(3, session.BlockRegistry.Count);
        Assert.True(session.BlockRegistry.Contains("block-1"));
        Assert.True(session.BlockRegistry.Contains("block-2"));
        Assert.True(session.BlockRegistry.Contains("block-3"));
    }

    // ===== Event Tests =====

    [Fact]
    public void Start_EmitsStateChangeEvent()
    {
        var session = TestSession.Create("Test", Authority.Human());
        SessionEvent? capturedEvent = null;
        session.OnEvent += (_, evt) => capturedEvent = evt;

        session.Start();

        Assert.NotNull(capturedEvent);
        Assert.Equal(SessionEventType.StateChange, capturedEvent.Type);
    }

    [Fact]
    public void SubmitCommand_EmitsCommandSubmittedEvent()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();
        SessionEvent? capturedEvent = null;
        session.OnEvent += (_, evt) => capturedEvent = evt;

        session.SubmitCommand("ls");

        Assert.NotNull(capturedEvent);
        Assert.Equal(SessionEventType.CommandSubmitted, capturedEvent.Type);
    }

    [Fact]
    public void EventHistory_RecordsAllEvents()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();
        session.SubmitCommand("ls");
        session.Pause();
        session.Resume();

        Assert.True(session.EventHistory.Count >= 4);
    }

    // ===== Status Mapping Tests =====

    [Fact]
    public void GetSessionStatus_ReturnsCorrectStatusForCreated()
    {
        var session = TestSession.Create("Test", Authority.Human());

        Assert.Equal(SessionStatus.Created, session.GetSessionStatus());
    }

    [Fact]
    public void GetSessionStatus_ReturnsCorrectStatusForRunning()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();

        Assert.Equal(SessionStatus.Running, session.GetSessionStatus());
    }

    [Fact]
    public void GetSessionStatus_ReturnsCorrectStatusForPaused()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();
        session.Pause();

        Assert.Equal(SessionStatus.Paused, session.GetSessionStatus());
    }

    [Fact]
    public void GetSessionStatus_ReturnsCorrectStatusForCompleted()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();
        session.Complete();

        Assert.Equal(SessionStatus.Completed, session.GetSessionStatus());
    }

    [Fact]
    public void GetSessionStatus_ReturnsCorrectStatusForFailed()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();
        session.Fail("Error");

        Assert.Equal(SessionStatus.Failed, session.GetSessionStatus());
    }

    [Fact]
    public void GetSessionStatus_ReturnsCorrectStatusForCancelled()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();
        session.Cancel();

        Assert.Equal(SessionStatus.Cancelled, session.GetSessionStatus());
    }

    [Fact]
    public void GetSessionStatus_ReturnsCorrectStatusForStopped()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();
        session.Stop();

        Assert.Equal(SessionStatus.Stopped, session.GetSessionStatus());
    }

    // ===== Permission Inheritance Tests =====

    [Fact]
    public void GetEffectivePermissions_WithParentWorkspace_IntersectsPermissions()
    {
        var workspace = Workspace.Create("TestWorkspace", WorkspaceType.Research);
        workspace.UpdatePermissions(new ContextPermissions
        {
            AllowedCommands = new() { "run", "data", "list-tools" },
            CanCreateBlocks = true
        });

        var session = TestSession.CreateInWorkspace("TestSession", Authority.Human(), workspace, new ContextPermissions
        {
            AllowedCommands = new() { "run", "data" },
            CanCreateBlocks = false
        });

        var effective = session.GetEffectivePermissions();

        Assert.Equal(2, effective.AllowedCommands.Count);
        Assert.Contains("run", effective.AllowedCommands);
        Assert.Contains("data", effective.AllowedCommands);
        Assert.DoesNotContain("list-tools", effective.AllowedCommands);
        Assert.False(effective.CanCreateBlocks);
    }

    // ===== Duration Tests =====

    [Fact]
    public void DurationMs_ReturnsNullWhenNotStarted()
    {
        var session = TestSession.Create("Test", Authority.Human());

        Assert.Null(session.DurationMs);
    }

    [Fact]
    public void DurationMs_ReturnsNullWhenNotCompleted()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();

        Assert.Null(session.DurationMs);
    }

    [Fact]
    public void DurationMs_ReturnsValueWhenCompleted()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();
        session.Complete();

        Assert.NotNull(session.DurationMs);
        Assert.True(session.DurationMs >= 0);
    }

    // ===== Utility Property Tests =====

    [Fact]
    public void IsTerminal_ReturnsFalseForNonTerminalStates()
    {
        var session = TestSession.Create("Test", Authority.Human());

        Assert.False(session.IsTerminal);

        session.Start();
        Assert.False(session.IsTerminal);

        session.Pause();
        Assert.False(session.IsTerminal);
    }

    [Fact]
    public void IsTerminal_ReturnsTrueForTerminalStates()
    {
        var session = TestSession.Create("Test", Authority.Human());
        session.Start();
        session.Complete();

        Assert.True(session.IsTerminal);
    }

    // ===== Storage Extension Tests =====

    [Fact]
    public void GetStorageExtension_ReturnsSessionJson()
    {
        var session = TestSession.Create("Test", Authority.Human());

        Assert.Equal(".session.json", session.GetStorageExtension());
    }
}
