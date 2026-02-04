using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Execution session status.
/// </summary>
public enum ExecutionSessionStatus
{
    /// <summary>Session is active and can execute commands.</summary>
    Active,
    /// <summary>Session is paused.</summary>
    Paused,
    /// <summary>Session has ended normally.</summary>
    Ended,
    /// <summary>Session has expired due to timeout.</summary>
    Expired
}

/// <summary>
/// Lightweight execution session for CLI permission context.
/// Sessions restrict permissions from their parent (workspace or session).
/// </summary>
public class ExecutionSession
{
    public string Id { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;

    /// <summary>Session type (e.g., "training", "evaluation", "foundry").</summary>
    public string Type { get; private set; } = string.Empty;

    /// <summary>Parent workspace ID (always set).</summary>
    public string ParentWorkspaceId { get; private set; } = string.Empty;

    /// <summary>Parent session ID (set for nested sessions).</summary>
    public string? ParentSessionId { get; private set; }

    /// <summary>Agent that created this session.</summary>
    public string? CreatedByAgentId { get; private set; }

    /// <summary>Permissions for this session context.</summary>
    public ContextPermissions Permissions { get; private set; } = ContextPermissions.None;

    /// <summary>Current session status.</summary>
    public ExecutionSessionStatus Status { get; private set; }

    /// <summary>Currently attached agent ID.</summary>
    public string? CurrentAgentId { get; private set; }

    /// <summary>Session context data (key-value store).</summary>
    public Dictionary<string, object> Context { get; private set; } = new();

    /// <summary>When the session was created.</summary>
    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>When the session was started (first command).</summary>
    public DateTimeOffset? StartedAt { get; private set; }

    /// <summary>When the session ended.</summary>
    public DateTimeOffset? EndedAt { get; private set; }

    /// <summary>When the session expires (if set).</summary>
    public DateTimeOffset? ExpiresAt { get; private set; }

    /// <summary>Whether to log all CLI commands.</summary>
    public bool LogAllCommands { get; private set; }

    /// <summary>Number of commands executed.</summary>
    public int CommandCount { get; private set; }

    /// <summary>Maximum iterations allowed (0 = unlimited).</summary>
    public int MaxIterations { get; private set; }

    private ExecutionSession() { }

    /// <summary>
    /// Creates a new execution session.
    /// </summary>
    public static ExecutionSession Create(
        string name,
        string type,
        string parentWorkspaceId,
        ContextPermissions permissions,
        string? parentSessionId = null,
        string? createdByAgentId = null,
        bool logAllCommands = true,
        int maxIterations = 0,
        TimeSpan? maxDuration = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Session name is required", nameof(name));
        if (string.IsNullOrWhiteSpace(type))
            throw new ArgumentException("Session type is required", nameof(type));
        if (string.IsNullOrWhiteSpace(parentWorkspaceId))
            throw new ArgumentException("Parent workspace ID is required", nameof(parentWorkspaceId));

        var now = DateTimeOffset.UtcNow;

        return new ExecutionSession
        {
            Id = $"session-{Guid.NewGuid():N}",
            Name = name,
            Type = type,
            ParentWorkspaceId = parentWorkspaceId,
            ParentSessionId = parentSessionId,
            CreatedByAgentId = createdByAgentId,
            Permissions = permissions ?? ContextPermissions.None,
            Status = ExecutionSessionStatus.Active,
            LogAllCommands = logAllCommands,
            MaxIterations = maxIterations,
            CreatedAt = now,
            ExpiresAt = maxDuration.HasValue ? now.Add(maxDuration.Value) : null
        };
    }

    /// <summary>
    /// Creates a session from a template.
    /// </summary>
    public static ExecutionSession CreateFromTemplate(
        string parentWorkspaceId,
        SessionTemplate template,
        string? createdByAgentId = null)
    {
        return Create(
            name: $"{template.Type}-{DateTime.UtcNow:yyyyMMdd-HHmmss}",
            type: template.Type,
            parentWorkspaceId: parentWorkspaceId,
            permissions: template.Permissions,
            parentSessionId: null,
            createdByAgentId: createdByAgentId,
            logAllCommands: template.LogAllCommands,
            maxIterations: template.MaxIterations,
            maxDuration: template.MaxDurationMinutes > 0
                ? TimeSpan.FromMinutes(template.MaxDurationMinutes)
                : null
        );
    }

    /// <summary>
    /// Attaches an agent to this session.
    /// </summary>
    public void AttachAgent(string agentId)
    {
        if (string.IsNullOrWhiteSpace(agentId))
            throw new ArgumentException("Agent ID is required", nameof(agentId));

        if (Status != ExecutionSessionStatus.Active)
            throw new InvalidOperationException($"Cannot attach agent to session in status {Status}");

        CurrentAgentId = agentId;
        StartedAt ??= DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Detaches the current agent from this session.
    /// </summary>
    public void DetachAgent()
    {
        CurrentAgentId = null;
    }

    /// <summary>
    /// Increments the command count.
    /// </summary>
    public void IncrementCommandCount()
    {
        CommandCount++;
        StartedAt ??= DateTimeOffset.UtcNow;

        // Check if max iterations exceeded
        if (MaxIterations > 0 && CommandCount >= MaxIterations)
        {
            End("Max iterations reached");
        }
    }

    /// <summary>
    /// Sets a context value.
    /// </summary>
    public void SetContext(string key, object value)
    {
        Context[key] = value;
    }

    /// <summary>
    /// Gets a context value.
    /// </summary>
    public T? GetContext<T>(string key)
    {
        return Context.TryGetValue(key, out var value) && value is T typedValue
            ? typedValue
            : default;
    }

    /// <summary>
    /// Pauses the session.
    /// </summary>
    public void Pause()
    {
        if (Status != ExecutionSessionStatus.Active)
            throw new InvalidOperationException($"Cannot pause session in status {Status}");

        Status = ExecutionSessionStatus.Paused;
    }

    /// <summary>
    /// Resumes a paused session.
    /// </summary>
    public void Resume()
    {
        if (Status != ExecutionSessionStatus.Paused)
            throw new InvalidOperationException($"Cannot resume session in status {Status}");

        Status = ExecutionSessionStatus.Active;
    }

    /// <summary>
    /// Ends the session.
    /// </summary>
    public void End(string? reason = null)
    {
        if (Status == ExecutionSessionStatus.Ended || Status == ExecutionSessionStatus.Expired)
            return; // Already ended

        Status = ExecutionSessionStatus.Ended;
        EndedAt = DateTimeOffset.UtcNow;
        CurrentAgentId = null;

        if (!string.IsNullOrEmpty(reason))
        {
            Context["endReason"] = reason;
        }
    }

    /// <summary>
    /// Marks the session as expired.
    /// </summary>
    public void Expire()
    {
        if (Status == ExecutionSessionStatus.Ended || Status == ExecutionSessionStatus.Expired)
            return;

        Status = ExecutionSessionStatus.Expired;
        EndedAt = DateTimeOffset.UtcNow;
        CurrentAgentId = null;
        Context["endReason"] = "Session expired";
    }

    /// <summary>
    /// Checks if the session has expired.
    /// </summary>
    public bool IsExpired()
    {
        if (Status == ExecutionSessionStatus.Expired)
            return true;

        if (ExpiresAt.HasValue && DateTimeOffset.UtcNow >= ExpiresAt.Value)
        {
            Expire();
            return true;
        }

        return false;
    }

    /// <summary>
    /// Checks if the session can execute commands.
    /// </summary>
    public bool CanExecute()
    {
        if (IsExpired())
            return false;

        return Status == ExecutionSessionStatus.Active;
    }

    /// <summary>
    /// Gets the duration of the session.
    /// </summary>
    public TimeSpan? Duration
    {
        get
        {
            if (!StartedAt.HasValue)
                return null;

            var end = EndedAt ?? DateTimeOffset.UtcNow;
            return end - StartedAt.Value;
        }
    }
}
