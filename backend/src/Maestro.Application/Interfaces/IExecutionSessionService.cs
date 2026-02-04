using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Service for managing execution sessions.
/// </summary>
public interface IExecutionSessionService
{
    /// <summary>
    /// Creates a new execution session.
    /// </summary>
    Task<ExecutionSession> CreateAsync(
        CreateExecutionSessionRequest request,
        CancellationToken ct = default);

    /// <summary>
    /// Creates a session from a workspace template.
    /// </summary>
    Task<ExecutionSession> CreateFromTemplateAsync(
        string workspaceId,
        string templateType,
        string? createdByAgentId = null,
        CancellationToken ct = default);

    /// <summary>
    /// Gets a session by ID.
    /// </summary>
    Task<ExecutionSession?> GetAsync(string sessionId, CancellationToken ct = default);

    /// <summary>
    /// Lists sessions by workspace.
    /// </summary>
    Task<IReadOnlyList<ExecutionSession>> ListByWorkspaceAsync(
        string workspaceId,
        ExecutionSessionStatus? status = null,
        CancellationToken ct = default);

    /// <summary>
    /// Lists sessions by parent session (nested sessions).
    /// </summary>
    Task<IReadOnlyList<ExecutionSession>> ListByParentSessionAsync(
        string parentSessionId,
        CancellationToken ct = default);

    /// <summary>
    /// Attaches an agent to a session.
    /// </summary>
    Task<ExecutionSession> AttachAgentAsync(
        string sessionId,
        string agentId,
        CancellationToken ct = default);

    /// <summary>
    /// Detaches the current agent from a session.
    /// </summary>
    Task<ExecutionSession> DetachAgentAsync(
        string sessionId,
        CancellationToken ct = default);

    /// <summary>
    /// Records a command execution (increments counter).
    /// </summary>
    Task<ExecutionSession> RecordCommandAsync(
        string sessionId,
        CancellationToken ct = default);

    /// <summary>
    /// Pauses a session.
    /// </summary>
    Task<ExecutionSession> PauseAsync(string sessionId, CancellationToken ct = default);

    /// <summary>
    /// Resumes a paused session.
    /// </summary>
    Task<ExecutionSession> ResumeAsync(string sessionId, CancellationToken ct = default);

    /// <summary>
    /// Ends a session.
    /// </summary>
    Task<ExecutionSession> EndAsync(
        string sessionId,
        string? reason = null,
        CancellationToken ct = default);

    /// <summary>
    /// Gets the effective permissions for a session.
    /// Computes intersection of session chain up to workspace.
    /// </summary>
    Task<ContextPermissions> GetEffectivePermissionsAsync(
        string sessionId,
        CancellationToken ct = default);

    /// <summary>
    /// Deletes a session (only if ended).
    /// </summary>
    Task DeleteAsync(string sessionId, CancellationToken ct = default);
}

/// <summary>
/// Request to create an execution session.
/// </summary>
public class CreateExecutionSessionRequest
{
    /// <summary>Session name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Session type (e.g., "training", "evaluation").</summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>Parent workspace ID.</summary>
    public string ParentWorkspaceId { get; set; } = string.Empty;

    /// <summary>Parent session ID (for nested sessions).</summary>
    public string? ParentSessionId { get; set; }

    /// <summary>Agent that created this session.</summary>
    public string? CreatedByAgentId { get; set; }

    /// <summary>Session permissions (cannot exceed parent).</summary>
    public ContextPermissions? Permissions { get; set; }

    /// <summary>Whether to log all commands.</summary>
    public bool LogAllCommands { get; set; } = true;

    /// <summary>Maximum iterations (0 = unlimited).</summary>
    public int MaxIterations { get; set; }

    /// <summary>Maximum duration.</summary>
    public TimeSpan? MaxDuration { get; set; }
}
