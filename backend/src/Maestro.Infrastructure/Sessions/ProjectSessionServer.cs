using System.Runtime.CompilerServices;
using System.Threading.Channels;
using Maestro.Application.Interfaces;
using Maestro.Domain.Configuration;
using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Sessions;

/// <summary>
/// Implementation of the Project Session Server.
/// Manages interactive project sessions with command execution and event streaming.
/// </summary>
public class ProjectSessionServer : IProjectSessionServer
{
    private readonly IProjectSessionRepository _repository;
    private readonly IProjectRepository _projectRepository;
    private readonly IBlockRepository _blockRepository;
    private readonly IEnumerable<ICommandExecutor> _commandExecutors;
    private readonly SessionContextStorage _contextStorage;
    private readonly ILogger<ProjectSessionServer> _logger;

    public ProjectSessionServer(
        IProjectSessionRepository repository,
        IProjectRepository projectRepository,
        IBlockRepository blockRepository,
        IEnumerable<ICommandExecutor> commandExecutors,
        SessionContextStorage contextStorage,
        ILogger<ProjectSessionServer> logger)
    {
        _repository = repository;
        _projectRepository = projectRepository;
        _blockRepository = blockRepository;
        _commandExecutors = commandExecutors;
        _contextStorage = contextStorage;
        _logger = logger;
    }

    public async Task<ProjectSession> CreateAsync(
        string name,
        Authority authority,
        ProjectSessionConfig config,
        CancellationToken ct = default)
    {
        // Validate project exists
        var project = await FindProjectAsync(config.ProjectId, ct);
        if (project == null)
        {
            throw new InvalidOperationException($"Project {config.ProjectId} not found");
        }

        // Create session
        var session = ProjectSession.Create(name, authority, config);

        // Initialize block registry with all available blocks
        var blocks = await _blockRepository.GetAllAsync(ct);
        session.InitializeBlockRegistry(blocks.Select(b => b.Id));

        // Subscribe to session events
        session.OnEvent += (_, evt) => BroadcastEvent(session.Id, evt);

        // Save to repository
        await _repository.SaveAsync(session, ct);

        // Ensure event channel exists for this session
        _contextStorage.GetOrCreateEventChannel(session.Id);

        _logger.LogInformation(
            "Created project session {SessionId} for project {ProjectId} with authority {Authority}",
            session.Id, config.ProjectId, authority);

        return session;
    }

    public Task<ProjectSession?> GetAsync(SessionId id, CancellationToken ct = default)
    {
        return _repository.GetByIdAsync(id, ct);
    }

    public Task<IEnumerable<ProjectSession>> GetAllAsync(
        SessionStatus? status = null,
        string? projectId = null,
        int? limit = null,
        CancellationToken ct = default)
    {
        return _repository.GetAllAsync(status, projectId, null, limit, ct);
    }

    public async Task<ProjectSession> StartAsync(SessionId id, CancellationToken ct = default)
    {
        var session = await _repository.GetByIdAsync(id, ct)
            ?? throw new InvalidOperationException($"Session {id.Value} not found");

        var project = await FindProjectAsync(session.Config.ProjectId, ct)
            ?? throw new InvalidOperationException($"Project {session.Config.ProjectId} not found");

        // Subscribe to session events if not already subscribed
        session.OnEvent += (_, evt) => BroadcastEvent(session.Id, evt);

        // Start the session
        session.Start();

        // Create session context and store in singleton storage
        var context = new ProjectSessionContext(
            session,
            project.RootPath,
            evt => BroadcastEvent(session.Id, evt));
        _contextStorage.SetContext(session.Id, context);

        // Ensure event channel exists
        _contextStorage.GetOrCreateEventChannel(session.Id);

        await _repository.SaveAsync(session, ct);

        _logger.LogInformation("Started project session {SessionId}", id.Value);

        return session;
    }

    public async Task<CommandResult> ExecuteCommandAsync(
        SessionId id,
        string commandInput,
        CancellationToken ct = default)
    {
        var session = await _repository.GetByIdAsync(id, ct)
            ?? throw new InvalidOperationException($"Session {id.Value} not found");

        if (!session.IsRunning)
        {
            throw new InvalidOperationException($"Session is not running (status: {session.Status})");
        }

        if (!_contextStorage.TryGetContext(session.Id, out var context) || context == null)
        {
            throw new InvalidOperationException("Session context not found. Did you start the session?");
        }

        // Parse and submit command
        var command = session.SubmitCommand(commandInput);
        command.MarkStarted();

        BroadcastEvent(session.Id, SessionEvent.CommandStarted(command.Id, command.Command));

        try
        {
            // Find executor for this command
            var executor = _commandExecutors.FirstOrDefault(e => e.CanHandle(command));
            if (executor == null)
            {
                var error = $"No executor found for command type: {command.Type}";
                session.RecordCommandResult(command, false, error: error);
                await _repository.SaveAsync(session, ct);
                return new CommandResult
                {
                    Command = command,
                    Success = false,
                    Error = error
                };
            }

            // Execute command
            var result = await executor.ExecuteAsync(command, context, ct);

            // Record result
            session.RecordCommandResult(command, result.Success, result.Output, result.Error, result.ExitCode);
            await _repository.SaveAsync(session, ct);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Command execution failed for session {SessionId}", id.Value);
            session.RecordCommandResult(command, false, error: ex.Message);
            await _repository.SaveAsync(session, ct);

            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = ex.Message
            };
        }
    }

    public async IAsyncEnumerable<SessionEvent> SubscribeAsync(
        SessionId id,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var session = await _repository.GetByIdAsync(id, ct)
            ?? throw new InvalidOperationException($"Session {id.Value} not found");

        // Get or create channel
        var channel = _contextStorage.GetOrCreateEventChannel(session.Id);

        // First, replay existing event history
        foreach (var evt in session.EventHistory)
        {
            yield return evt;
        }

        // Then stream new events
        await foreach (var evt in channel.Reader.ReadAllAsync(ct))
        {
            yield return evt;
        }
    }

    public async Task<ProjectSession> PauseAsync(SessionId id, CancellationToken ct = default)
    {
        var session = await _repository.GetByIdAsync(id, ct)
            ?? throw new InvalidOperationException($"Session {id.Value} not found");

        session.Pause();
        await _repository.SaveAsync(session, ct);

        _logger.LogInformation("Paused project session {SessionId}", id.Value);

        return session;
    }

    public async Task<ProjectSession> ResumeAsync(SessionId id, CancellationToken ct = default)
    {
        var session = await _repository.GetByIdAsync(id, ct)
            ?? throw new InvalidOperationException($"Session {id.Value} not found");

        session.Resume();
        await _repository.SaveAsync(session, ct);

        _logger.LogInformation("Resumed project session {SessionId}", id.Value);

        return session;
    }

    public async Task<ProjectSession> StopAsync(SessionId id, CancellationToken ct = default)
    {
        var session = await _repository.GetByIdAsync(id, ct)
            ?? throw new InvalidOperationException($"Session {id.Value} not found");

        session.Stop();
        await _repository.SaveAsync(session, ct);

        // Cleanup from storage
        _contextStorage.RemoveContext(session.Id);
        if (_contextStorage.TryGetEventChannel(session.Id, out var channel) && channel != null)
        {
            channel.Writer.Complete();
            _contextStorage.RemoveEventChannel(session.Id);
        }

        _logger.LogInformation("Stopped project session {SessionId}", id.Value);

        return session;
    }

    public async Task<ProjectSession> TakeControlAsync(
        SessionId id,
        Authority newAuthority,
        CancellationToken ct = default)
    {
        var session = await _repository.GetByIdAsync(id, ct)
            ?? throw new InvalidOperationException($"Session {id.Value} not found");

        session.TransferControl(newAuthority);
        await _repository.SaveAsync(session, ct);

        _logger.LogInformation(
            "Control of session {SessionId} transferred to {Authority}",
            id.Value, newAuthority);

        return session;
    }

    public async Task DeleteAsync(SessionId id, CancellationToken ct = default)
    {
        var session = await _repository.GetByIdAsync(id, ct);
        if (session == null) return;

        // Stop if running
        if (session.IsRunning || session.IsPaused)
        {
            session.Stop();
        }

        // Cleanup from storage
        _contextStorage.RemoveContext(session.Id);
        if (_contextStorage.TryGetEventChannel(session.Id, out var channel) && channel != null)
        {
            channel.Writer.Complete();
            _contextStorage.RemoveEventChannel(session.Id);
        }

        await _repository.DeleteAsync(id, ct);

        _logger.LogInformation("Deleted project session {SessionId}", id.Value);
    }

    private async Task<Project?> FindProjectAsync(string projectId, CancellationToken ct)
    {
        var projects = await _projectRepository.GetAllAsync(ct);
        return projects.FirstOrDefault(p => p.Id.ToString() == projectId);
    }

    private void BroadcastEvent(string sessionId, SessionEvent evt)
    {
        if (_contextStorage.TryGetEventChannel(sessionId, out var channel) && channel != null)
        {
            channel.Writer.TryWrite(evt);
        }
    }
}

/// <summary>
/// Context for a running project session.
/// </summary>
public class ProjectSessionContext : ISessionContext
{
    private readonly ProjectSession _session;
    private readonly Action<SessionEvent> _emitEvent;

    public string SessionId => _session.Id;
    public SessionType SessionType => SessionType.Project;
    public string WorkingDirectory { get; private set; }
    public string? ProjectId => _session.Config.ProjectId;
    public string? ProjectPath { get; }
    public AccessLevel AccessLevel => _session.Config.Access.Level;
    public SessionBlockRegistry BlockRegistry => _session.BlockRegistry;

    public ProjectSessionContext(
        ProjectSession session,
        string projectPath,
        Action<SessionEvent> emitEvent)
    {
        _session = session;
        ProjectPath = projectPath;
        WorkingDirectory = projectPath;
        _emitEvent = emitEvent;
    }

    public void EmitEvent(SessionEvent evt)
    {
        _emitEvent(evt);
    }

    public void SetWorkingDirectory(string path)
    {
        WorkingDirectory = path;
        _session.SetWorkingDirectory(path);
    }

    public void RecordFileChange(FileChange change)
    {
        _session.RecordFileChange(change);
    }
}
