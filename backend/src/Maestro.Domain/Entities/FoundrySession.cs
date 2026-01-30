using Maestro.Domain.Configuration;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a Foundry session - an interactive sandbox for developing, testing, and improving blocks.
/// The authority (human, agent, or AI) can run training, evaluate iterations, and publish to the catalog.
/// </summary>
public class FoundrySession
{
    private readonly List<SessionCommand> _commandHistory = new();
    private readonly List<SessionEvent> _eventHistory = new();
    private readonly List<FoundryIteration> _iterations = new();
    private readonly List<ImprovementSuggestion> _improvements = new();

    public required SessionId Id { get; init; }

    /// <summary>
    /// Display name for the session.
    /// </summary>
    public required string Name { get; set; }

    /// <summary>
    /// The type of session (always Foundry for this entity).
    /// </summary>
    public SessionType Type => SessionType.Foundry;

    /// <summary>
    /// Current status of the session.
    /// </summary>
    public SessionStatus Status { get; private set; } = SessionStatus.Created;

    /// <summary>
    /// The authority controlling this session.
    /// </summary>
    public required Authority Authority { get; set; }

    /// <summary>
    /// Configuration for this Foundry session.
    /// </summary>
    public required FoundrySessionConfig Config { get; init; }

    /// <summary>
    /// The currently loaded draft ID.
    /// </summary>
    public string? LoadedDraftId { get; private set; }

    /// <summary>
    /// Block registry for this session.
    /// </summary>
    public SessionBlockRegistry BlockRegistry { get; private set; } = SessionBlockRegistry.Empty();

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

    /// <summary>
    /// When the session was created.
    /// </summary>
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    /// <summary>
    /// When the session was started.
    /// </summary>
    public DateTime? StartedAt { get; private set; }

    /// <summary>
    /// When the session completed.
    /// </summary>
    public DateTime? CompletedAt { get; private set; }

    /// <summary>
    /// Duration of the session in milliseconds.
    /// </summary>
    public long? DurationMs => StartedAt.HasValue && CompletedAt.HasValue
        ? (long)(CompletedAt.Value - StartedAt.Value).TotalMilliseconds
        : null;

    /// <summary>
    /// Command history for this session.
    /// </summary>
    public IReadOnlyList<SessionCommand> CommandHistory => _commandHistory.AsReadOnly();

    /// <summary>
    /// Event history for this session.
    /// </summary>
    public IReadOnlyList<SessionEvent> EventHistory => _eventHistory.AsReadOnly();

    /// <summary>
    /// Error message if the session failed.
    /// </summary>
    public string? ErrorMessage { get; private set; }

    /// <summary>
    /// Event raised when a new event is emitted.
    /// </summary>
    public event EventHandler<SessionEvent>? OnEvent;

    private FoundrySession() { }

    /// <summary>
    /// Creates a new Foundry session.
    /// </summary>
    public static FoundrySession Create(string name, Authority authority, FoundrySessionConfig? config = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentNullException.ThrowIfNull(authority);

        var session = new FoundrySession
        {
            Id = SessionId.New(),
            Name = name,
            Authority = authority,
            Config = config ?? FoundrySessionConfig.Default
        };

        session.EmitEvent(SessionEvent.Info(session.Id.Value, $"Foundry session created with authority: {authority}"));

        // Auto-load draft if specified in config
        if (!string.IsNullOrEmpty(config?.DraftId))
        {
            session.LoadedDraftId = config.DraftId;
            session.EmitEvent(SessionEvent.Info(session.Id.Value, $"Draft loaded: {config.DraftId}"));
        }

        return session;
    }

    /// <summary>
    /// Initializes the block registry with available blocks.
    /// </summary>
    public void InitializeBlockRegistry(IEnumerable<string> blockIds)
    {
        BlockRegistry = SessionBlockRegistry.From(blockIds);
        EmitEvent(SessionEvent.Info(Id.Value, $"Block registry initialized with {BlockRegistry.Count} blocks"));
    }

    /// <summary>
    /// Starts the session.
    /// </summary>
    public void Start()
    {
        if (Status != SessionStatus.Created)
            throw new InvalidOperationException($"Cannot start session in status {Status}");

        var previousStatus = Status;
        Status = SessionStatus.Running;
        StartedAt = DateTime.UtcNow;

        EmitEvent(SessionEvent.StateChange(Id.Value, Status, previousStatus));
    }

    /// <summary>
    /// Pauses the session.
    /// </summary>
    public void Pause()
    {
        if (Status != SessionStatus.Running)
            throw new InvalidOperationException($"Cannot pause session in status {Status}");

        var previousStatus = Status;
        Status = SessionStatus.Paused;

        // Also pause training if running
        if (FoundryTrainingStatus == FoundryTrainingStatus.Running)
            FoundryTrainingStatus = FoundryTrainingStatus.Paused;

        EmitEvent(SessionEvent.StateChange(Id.Value, Status, previousStatus));
    }

    /// <summary>
    /// Resumes a paused session.
    /// </summary>
    public void Resume()
    {
        if (Status != SessionStatus.Paused)
            throw new InvalidOperationException($"Cannot resume session in status {Status}");

        var previousStatus = Status;
        Status = SessionStatus.Running;

        // Also resume training if it was paused
        if (FoundryTrainingStatus == FoundryTrainingStatus.Paused)
            FoundryTrainingStatus = FoundryTrainingStatus.Running;

        EmitEvent(SessionEvent.StateChange(Id.Value, Status, previousStatus));
    }

    /// <summary>
    /// Stops the session.
    /// </summary>
    public void Stop()
    {
        if (Status == SessionStatus.Completed || Status == SessionStatus.Failed ||
            Status == SessionStatus.Cancelled || Status == SessionStatus.Stopped)
            throw new InvalidOperationException($"Cannot stop session in status {Status}");

        var previousStatus = Status;
        Status = SessionStatus.Stopped;
        CompletedAt = DateTime.UtcNow;

        if (FoundryTrainingStatus == FoundryTrainingStatus.Running || FoundryTrainingStatus == FoundryTrainingStatus.Paused)
            FoundryTrainingStatus = FoundryTrainingStatus.Stopped;

        EmitEvent(SessionEvent.StateChange(Id.Value, Status, previousStatus));
    }

    /// <summary>
    /// Submits a command for execution.
    /// </summary>
    public SessionCommand SubmitCommand(string input)
    {
        if (Status != SessionStatus.Running)
            throw new InvalidOperationException($"Cannot execute commands in session status {Status}");

        var command = SessionCommand.Parse(input);
        _commandHistory.Add(command);

        EmitEvent(SessionEvent.CommandSubmitted(Id.Value, command));
        return command;
    }

    /// <summary>
    /// Loads a draft for editing/training.
    /// </summary>
    public void LoadDraft(string draftId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(draftId);
        LoadedDraftId = draftId;
        EmitEvent(SessionEvent.Info(Id.Value, $"Draft loaded: {draftId}"));
    }

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
        EmitEvent(SessionEvent.Info(Id.Value, $"Training started with {Config.Training.Iterations} iterations"));
    }

    /// <summary>
    /// Pauses training.
    /// </summary>
    public void PauseTraining()
    {
        if (FoundryTrainingStatus != FoundryTrainingStatus.Running)
            throw new InvalidOperationException("Training is not running.");

        FoundryTrainingStatus = FoundryTrainingStatus.Paused;
        EmitEvent(SessionEvent.Info(Id.Value, "Training paused"));
    }

    /// <summary>
    /// Resumes training.
    /// </summary>
    public void ResumeTraining()
    {
        if (FoundryTrainingStatus != FoundryTrainingStatus.Paused)
            throw new InvalidOperationException("Training is not paused.");

        FoundryTrainingStatus = FoundryTrainingStatus.Running;
        EmitEvent(SessionEvent.Info(Id.Value, "Training resumed"));
    }

    /// <summary>
    /// Stops training.
    /// </summary>
    public void StopTraining()
    {
        if (FoundryTrainingStatus != FoundryTrainingStatus.Running && FoundryTrainingStatus != FoundryTrainingStatus.Paused)
            throw new InvalidOperationException("Training is not running or paused.");

        FoundryTrainingStatus = FoundryTrainingStatus.Stopped;
        EmitEvent(SessionEvent.Info(Id.Value, "Training stopped"));
    }

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

        EmitEvent(SessionEvent.Info(Id.Value, $"Iteration {iteration.IterationNumber} completed in {durationMs}ms"));
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
        EmitEvent(SessionEvent.Info(Id.Value, $"Iteration {iteration.IterationNumber} evaluated: {score:P0}{status}"));
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

        EmitEvent(SessionEvent.Info(Id.Value, $"Training completed. {_iterations.Count} iterations, avg score: {Metrics.AverageScore:P0}"));
    }

    /// <summary>
    /// Adds an improvement suggestion.
    /// </summary>
    public void AddImprovement(ImprovementSuggestion improvement)
    {
        _improvements.Add(improvement);
        EmitEvent(SessionEvent.Info(Id.Value, $"Improvement suggested: {improvement.Title}"));
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

        EmitEvent(SessionEvent.Info(Id.Value, $"Improvement applied: {improvement.Title}"));
    }

    /// <summary>
    /// Completes the session successfully.
    /// </summary>
    public void Complete()
    {
        if (Status != SessionStatus.Running && Status != SessionStatus.Paused)
            throw new InvalidOperationException($"Cannot complete session in status {Status}");

        var previousStatus = Status;
        Status = SessionStatus.Completed;
        CompletedAt = DateTime.UtcNow;

        EmitEvent(SessionEvent.StateChange(Id.Value, Status, previousStatus));
    }

    /// <summary>
    /// Fails the session with an error.
    /// </summary>
    public void Fail(string errorMessage)
    {
        if (Status != SessionStatus.Running && Status != SessionStatus.Paused && Status != SessionStatus.Created)
            throw new InvalidOperationException($"Cannot fail session in status {Status}");

        var previousStatus = Status;
        Status = SessionStatus.Failed;
        CompletedAt = DateTime.UtcNow;
        ErrorMessage = errorMessage;

        EmitEvent(SessionEvent.Error(Id.Value, errorMessage));
        EmitEvent(SessionEvent.StateChange(Id.Value, Status, previousStatus));
    }

    /// <summary>
    /// Transfers control to a new authority.
    /// </summary>
    public void TransferControl(Authority newAuthority)
    {
        var oldAuthority = Authority;
        Authority = newAuthority;

        EmitEvent(SessionEvent.Info(Id.Value, $"Control transferred from {oldAuthority} to {newAuthority}"));
    }

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
    /// Emits an event and records it in history.
    /// </summary>
    private void EmitEvent(SessionEvent evt)
    {
        _eventHistory.Add(evt);
        OnEvent?.Invoke(this, evt);
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
