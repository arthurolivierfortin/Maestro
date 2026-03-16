using Maestro.Domain.Configuration;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a Foundry session - an interactive sandbox for developing, testing, and improving blocks.
/// The authority (human, agent, or AI) can run training, evaluate iterations, and publish to the catalog.
///
/// Inherits from Session to get common session functionality (command history, events, lifecycle).
/// FoundrySession adds foundry-specific features like training, iterations, and improvements.
/// </summary>
public class FoundrySession : Session
{
    private readonly List<FoundryIteration> _iterations = new();
    private readonly List<ImprovementSuggestion> _improvements = new();

    /// <summary>
    /// Transient reference to the parent session (not serialized).
    /// Used by GetParentContext() for permission inheritance chain.
    /// </summary>
    private ContainerSession? _parentSession;

    // ===== Foundry-Specific Properties =====

    /// <summary>
    /// The type of session (always Foundry for this entity).
    /// </summary>
    public override SessionType SessionType => SessionType.Foundry;

    /// <summary>
    /// Configuration for this Foundry session.
    /// </summary>
    public FoundrySessionConfig Config { get; private set; } = null!;

    /// <summary>
    /// The currently loaded draft ID.
    /// </summary>
    public string? LoadedDraftId { get; private set; }

    /// <summary>
    /// Current training status.
    /// </summary>
    public FoundryTrainingStatus FoundryTrainingStatus { get; private set; } = FoundryTrainingStatus.Idle;

    /// <summary>
    /// Training iterations for this session.
    /// </summary>
    public IReadOnlyList<FoundryIteration> Iterations => _iterations.AsReadOnly();

    /// <summary>
    /// Improvement suggestions for this session.
    /// </summary>
    public IReadOnlyList<ImprovementSuggestion> Improvements => _improvements.AsReadOnly();

    /// <summary>
    /// Current metrics aggregated from iterations.
    /// </summary>
    public SessionMetrics Metrics { get; private set; } = new();

    /// <summary>
    /// Number of iterations pending evaluation.
    /// </summary>
    public int PendingEvaluations => _iterations.Count(i => !i.Evaluated);

    // ===== ContainerSession Implementation =====

    /// <summary>
    /// Returns the parent context for permission inheritance.
    /// Returns the transient _parentSession reference if set (via SetParentSession),
    /// otherwise null (root session or parent not yet loaded).
    /// </summary>
    public override ContainerSession? GetParentContext()
    {
        return _parentSession;
    }

    /// <summary>
    /// Sets the transient parent session reference for permission inheritance.
    /// Called after repository load when ParentSessionId is set.
    /// </summary>
    public void SetParentSession(ContainerSession parent)
    {
        _parentSession = parent;
    }

    // ===== Constructor =====

    private FoundrySession() { }

    // ===== Factory Methods =====

    /// <summary>
    /// Creates a new Foundry session.
    /// </summary>
    public static FoundrySession Create(
        string name,
        Authority authority,
        FoundrySessionConfig? config = null,
        string? repositoryPath = null,
        ContextPermissions? permissions = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentNullException.ThrowIfNull(authority);

        config ??= FoundrySessionConfig.Default;

        var session = new FoundrySession
        {
            Id = Guid.NewGuid().ToString(),
            Name = name,
            Authority = authority,
            Config = config,
            Status = ContainerSessionStatus.Created,
            Permissions = permissions ?? ContextPermissions.Full,
            Binding = ContainerBinding.CreateSandbox(), // Default
            CreatedAt = DateTimeOffset.UtcNow
        };

        // Priority: explicit repositoryPath > config.Source/RepositoryConfig
        if (repositoryPath != null)
        {
            var accessLevel = config.RepositoryConfig != null
                ? MapAccessLevel(config.RepositoryConfig.AccessLevel)
                : ValueObjects.RepositoryAccessLevel.Controlled;
            session.BindToRepository(repositoryPath, accessLevel);
        }
        else if (config.Source == SessionSource.Repository && config.RepositoryConfig != null)
        {
            // Backwards compatibility: use config source
            session.BindToRepository(
                config.RepositoryConfig.RepositoryPath,
                MapAccessLevel(config.RepositoryConfig.AccessLevel));
        }

        session.EmitEvent(SessionEvent.Info(session.Id, $"Foundry session created with authority: {authority}"));

        // Auto-load draft if specified in config
        if (!string.IsNullOrEmpty(config.DraftId))
        {
            session.LoadedDraftId = config.DraftId;
            session.EmitEvent(SessionEvent.Info(session.Id, $"Draft loaded: {config.DraftId}"));
        }

        return session;
    }

    /// <summary>
    /// Creates a Foundry session with a parent workspace.
    /// </summary>
    public static FoundrySession CreateInWorkspace(
        string name,
        Authority authority,
        FoundrySessionConfig config,
        string workspaceId,
        string? repositoryPath = null,
        ContextPermissions? permissions = null)
    {
        var session = Create(name, authority, config, repositoryPath, permissions);
        session.ParentWorkspaceId = workspaceId;
        return session;
    }

    /// <summary>
    /// Reconstitutes a Foundry session from persisted data.
    /// </summary>
    public static FoundrySession Reconstitute(
        string id,
        string name,
        Authority authority,
        FoundrySessionConfig config,
        ContainerSessionStatus status,
        SessionTerminalReason terminalReason,
        string? parentWorkspaceId,
        string? parentSessionId,
        string? loadedDraftId,
        FoundryTrainingStatus trainingStatus,
        ContextPermissions permissions,
        ContainerBinding binding,
        SessionBlockRegistry blockRegistry,
        SessionMetrics metrics,
        IList<FoundryIteration> iterations,
        IList<ImprovementSuggestion> improvements,
        string? errorMessage,
        DateTimeOffset createdAt,
        DateTimeOffset? startedAt,
        DateTimeOffset? completedAt,
        DateTimeOffset? updatedAt,
        string? createdBy,
        IEnumerable<SessionCommand>? commandHistory = null,
        IEnumerable<SessionEvent>? eventHistory = null,
        string? repositoryPath = null)
    {
        var session = new FoundrySession
        {
            Id = id,
            Name = name,
            Authority = authority,
            Config = config,
            Status = status,
            TerminalReason = terminalReason,
            ParentWorkspaceId = parentWorkspaceId,
            ParentSessionId = parentSessionId,
            LoadedDraftId = loadedDraftId,
            FoundryTrainingStatus = trainingStatus,
            Permissions = permissions,
            Binding = binding,
            BlockRegistry = blockRegistry,
            Metrics = metrics,
            RepositoryPath = repositoryPath ?? binding.RepositoryPath,
            ErrorMessage = errorMessage,
            CreatedAt = createdAt,
            StartedAt = startedAt,
            CompletedAt = completedAt,
            UpdatedAt = updatedAt,
            CreatedBy = createdBy
        };

        // Restore collections
        session._iterations.AddRange(iterations);
        session._improvements.AddRange(improvements);

        // Restore command and event history
        if (commandHistory != null)
        {
            foreach (var cmd in commandHistory)
            {
                session.AddCommandToHistory(cmd);
            }
        }

        if (eventHistory != null)
        {
            foreach (var evt in eventHistory)
            {
                session.AddEventToHistory(evt);
            }
        }

        return session;
    }

    // ===== Lifecycle Overrides =====

    /// <summary>
    /// Pauses the session and training if running.
    /// </summary>
    public override void Pause()
    {
        base.Pause();

        // Also pause training if running
        if (FoundryTrainingStatus == FoundryTrainingStatus.Running)
        {
            FoundryTrainingStatus = FoundryTrainingStatus.Paused;
        }
    }

    /// <summary>
    /// Resumes the session and training if it was paused.
    /// </summary>
    public override void Resume()
    {
        base.Resume();

        // Also resume training if it was paused
        if (FoundryTrainingStatus == FoundryTrainingStatus.Paused)
        {
            FoundryTrainingStatus = FoundryTrainingStatus.Running;
        }
    }

    /// <summary>
    /// Stops the session and training.
    /// </summary>
    public override void Stop()
    {
        // Stop training if running
        if (FoundryTrainingStatus == FoundryTrainingStatus.Running || FoundryTrainingStatus == FoundryTrainingStatus.Paused)
        {
            FoundryTrainingStatus = FoundryTrainingStatus.Stopped;
        }

        base.Stop();
    }

    // ===== Draft Management =====

    /// <summary>
    /// Loads a draft for editing/training.
    /// </summary>
    public void LoadDraft(string draftId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(draftId);
        LoadedDraftId = draftId;
        EmitEvent(SessionEvent.Info(Id, $"Draft loaded: {draftId}"));
    }

    // ===== Training Management =====

    /// <summary>
    /// Starts a training run.
    /// </summary>
    public void StartTraining()
    {
        if (string.IsNullOrEmpty(LoadedDraftId))
            throw new InvalidOperationException("No draft loaded. Use 'draft load <id>' first.");

        if (FoundryTrainingStatus == FoundryTrainingStatus.Running)
            throw new InvalidOperationException("Training is already running.");

        FoundryTrainingStatus = FoundryTrainingStatus.Running;
        EmitEvent(SessionEvent.Info(Id, $"Training started with {Config.Training.Iterations} iterations"));
    }

    /// <summary>
    /// Pauses training.
    /// </summary>
    public void PauseTraining()
    {
        if (FoundryTrainingStatus != FoundryTrainingStatus.Running)
            throw new InvalidOperationException("Training is not running.");

        FoundryTrainingStatus = FoundryTrainingStatus.Paused;
        EmitEvent(SessionEvent.Info(Id, "Training paused"));
    }

    /// <summary>
    /// Resumes training.
    /// </summary>
    public void ResumeTraining()
    {
        if (FoundryTrainingStatus != FoundryTrainingStatus.Paused)
            throw new InvalidOperationException("Training is not paused.");

        FoundryTrainingStatus = FoundryTrainingStatus.Running;
        EmitEvent(SessionEvent.Info(Id, "Training resumed"));
    }

    /// <summary>
    /// Stops training.
    /// </summary>
    public void StopTraining()
    {
        if (FoundryTrainingStatus != FoundryTrainingStatus.Running && FoundryTrainingStatus != FoundryTrainingStatus.Paused)
            throw new InvalidOperationException("Training is not running or paused.");

        FoundryTrainingStatus = FoundryTrainingStatus.Stopped;
        EmitEvent(SessionEvent.Info(Id, "Training stopped"));
    }

    /// <summary>
    /// Marks training as complete.
    /// </summary>
    public void CompleteTraining()
    {
        if (FoundryTrainingStatus != FoundryTrainingStatus.Running && FoundryTrainingStatus != FoundryTrainingStatus.Paused)
            throw new InvalidOperationException("Training is not running or paused.");

        FoundryTrainingStatus = FoundryTrainingStatus.Completed;
        UpdateMetrics();

        EmitEvent(SessionEvent.Info(Id, $"Training completed. {_iterations.Count} iterations, avg score: {Metrics.AverageScore:P0}"));
    }

    // ===== Iteration Management =====

    /// <summary>
    /// Records a training iteration.
    /// </summary>
    public FoundryIteration RecordIteration(IDictionary<string, object> inputs, object? output, long durationMs)
    {
        var iteration = new FoundryIteration
        {
            Id = $"iter-{_iterations.Count + 1:D4}",
            IterationNumber = _iterations.Count + 1,
            Inputs = new Dictionary<string, object>(inputs),
            Output = output,
            DurationMs = durationMs,
            ExecutedAt = DateTime.UtcNow
        };

        _iterations.Add(iteration);
        UpdateMetrics();

        EmitEvent(SessionEvent.Info(Id, $"Iteration {iteration.IterationNumber} completed in {durationMs}ms"));
        return iteration;
    }

    /// <summary>
    /// Evaluates an iteration.
    /// </summary>
    public void EvaluateIteration(string iterationId, double score, string? feedback = null, bool needsHumanReview = false)
    {
        var iteration = _iterations.FirstOrDefault(i => i.Id == iterationId)
            ?? throw new InvalidOperationException($"Iteration {iterationId} not found");

        iteration.Evaluate(score, feedback, needsHumanReview);
        UpdateMetrics();

        var status = needsHumanReview ? " (needs human review)" : "";
        EmitEvent(SessionEvent.Info(Id, $"Iteration {iteration.IterationNumber} evaluated: {score:P0}{status}"));
    }

    // ===== Improvement Management =====

    /// <summary>
    /// Adds an improvement suggestion.
    /// </summary>
    public void AddImprovement(ImprovementSuggestion improvement)
    {
        _improvements.Add(improvement);
        EmitEvent(SessionEvent.Info(Id, $"Improvement suggested: {improvement.Title}"));
    }

    /// <summary>
    /// Applies an improvement.
    /// </summary>
    public void ApplyImprovement(string improvementId)
    {
        var improvement = _improvements.FirstOrDefault(i => i.Id == improvementId)
            ?? throw new InvalidOperationException($"Improvement {improvementId} not found");

        improvement.Applied = true;
        improvement.AppliedAt = DateTime.UtcNow;

        EmitEvent(SessionEvent.Info(Id, $"Improvement applied: {improvement.Title}"));
    }

    // ===== Helpers =====

    /// <summary>
    /// Updates aggregated metrics from iterations.
    /// </summary>
    private void UpdateMetrics()
    {
        var evaluatedIterations = _iterations.Where(i => i.Evaluated).ToList();

        Metrics = new SessionMetrics
        {
            TotalIterations = _iterations.Count,
            EvaluatedIterations = evaluatedIterations.Count,
            AverageScore = evaluatedIterations.Count > 0 ? evaluatedIterations.Average(i => i.Score ?? 0) : 0,
            MinScore = evaluatedIterations.Count > 0 ? evaluatedIterations.Min(i => i.Score ?? 0) : 0,
            MaxScore = evaluatedIterations.Count > 0 ? evaluatedIterations.Max(i => i.Score ?? 0) : 0,
            AverageDurationMs = _iterations.Count > 0 ? _iterations.Average(i => i.DurationMs) : 0,
            TotalDurationMs = _iterations.Sum(i => i.DurationMs),
            PassRate = evaluatedIterations.Count > 0
                ? (double)evaluatedIterations.Count(i => i.Score >= Config.Evaluation.PassThreshold) / evaluatedIterations.Count
                : 0
        };
    }

    /// <summary>
    /// Maps RepositoryAccessLevel to ContainerBinding RepositoryAccessLevel.
    /// </summary>
    private static Maestro.Domain.ValueObjects.RepositoryAccessLevel MapAccessLevel(Configuration.RepositoryAccessLevel level)
    {
        return level switch
        {
            Configuration.RepositoryAccessLevel.ReadOnly => ValueObjects.RepositoryAccessLevel.ReadOnly,
            Configuration.RepositoryAccessLevel.Controlled => ValueObjects.RepositoryAccessLevel.Controlled,
            Configuration.RepositoryAccessLevel.Full => ValueObjects.RepositoryAccessLevel.Full,
            _ => ValueObjects.RepositoryAccessLevel.Controlled
        };
    }
}

/// <summary>
/// Status of training within a Foundry session.
/// </summary>
public enum FoundryTrainingStatus
{
    /// <summary>
    /// No training in progress.
    /// </summary>
    Idle,

    /// <summary>
    /// Training is running.
    /// </summary>
    Running,

    /// <summary>
    /// Training is paused.
    /// </summary>
    Paused,

    /// <summary>
    /// Training completed.
    /// </summary>
    Completed,

    /// <summary>
    /// Training was stopped.
    /// </summary>
    Stopped
}

/// <summary>
/// Represents a training iteration.
/// </summary>
public class FoundryIteration
{
    /// <summary>
    /// Unique ID for this iteration.
    /// </summary>
    public required string Id { get; init; }

    /// <summary>
    /// Iteration number (1-based).
    /// </summary>
    public required int IterationNumber { get; init; }

    /// <summary>
    /// Inputs provided to the block.
    /// </summary>
    public required IDictionary<string, object> Inputs { get; init; }

    /// <summary>
    /// Output from the block execution.
    /// </summary>
    public object? Output { get; init; }

    /// <summary>
    /// Duration of the iteration in milliseconds.
    /// </summary>
    public long DurationMs { get; init; }

    /// <summary>
    /// When the iteration was executed.
    /// </summary>
    public DateTime ExecutedAt { get; init; }

    /// <summary>
    /// Whether this iteration has been evaluated.
    /// </summary>
    public bool Evaluated { get; private set; }

    /// <summary>
    /// Evaluation score (0.0 - 1.0).
    /// </summary>
    public double? Score { get; private set; }

    /// <summary>
    /// Evaluation feedback.
    /// </summary>
    public string? Feedback { get; private set; }

    /// <summary>
    /// Whether this iteration needs human review.
    /// </summary>
    public bool NeedsHumanReview { get; private set; }

    /// <summary>
    /// When the iteration was evaluated.
    /// </summary>
    public DateTime? EvaluatedAt { get; private set; }

    /// <summary>
    /// Evaluates this iteration.
    /// </summary>
    public void Evaluate(double score, string? feedback = null, bool needsHumanReview = false)
    {
        Score = Math.Clamp(score, 0, 1);
        Feedback = feedback;
        NeedsHumanReview = needsHumanReview;
        Evaluated = true;
        EvaluatedAt = DateTime.UtcNow;
    }
}

/// <summary>
/// Aggregated metrics for a session.
/// </summary>
public class SessionMetrics
{
    public int TotalIterations { get; init; }
    public int EvaluatedIterations { get; init; }
    public double AverageScore { get; init; }
    public double MinScore { get; init; }
    public double MaxScore { get; init; }
    public double AverageDurationMs { get; init; }
    public long TotalDurationMs { get; init; }
    public double PassRate { get; init; }
}

/// <summary>
/// Represents an improvement suggestion.
/// </summary>
public class ImprovementSuggestion
{
    /// <summary>
    /// Unique ID for this suggestion.
    /// </summary>
    public string Id { get; init; } = Guid.NewGuid().ToString("N")[..12];

    /// <summary>
    /// Title of the improvement.
    /// </summary>
    public required string Title { get; init; }

    /// <summary>
    /// Detailed description of the improvement.
    /// </summary>
    public required string Description { get; init; }

    /// <summary>
    /// Type of improvement (prompt, config, logic, etc.).
    /// </summary>
    public required string Type { get; init; }

    /// <summary>
    /// Priority (high, medium, low).
    /// </summary>
    public string Priority { get; init; } = "medium";

    /// <summary>
    /// The suggested changes (JSON patch or full replacement).
    /// </summary>
    public object? SuggestedChanges { get; init; }

    /// <summary>
    /// When the suggestion was created.
    /// </summary>
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    /// <summary>
    /// Whether this improvement has been applied.
    /// </summary>
    public bool Applied { get; set; }

    /// <summary>
    /// When the improvement was applied.
    /// </summary>
    public DateTime? AppliedAt { get; set; }
}
