using System.Text.Json;
using Maestro.Domain.Entities;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Shared execution context passed to all node handlers.
/// Encapsulates the mutable state that control flow nodes need to read/write.
///
/// ARCHITECTURE (Phase 53-C): Introduced to avoid passing 8+ parameters to every
/// node handler method. All handlers operate on the same session, display tree,
/// and workflow context — this makes that explicit.
/// </summary>
public class NodeExecutionContext
{
    public required ProjectSession Session { get; init; }
    public required Dictionary<string, object>? WorkflowConfig { get; init; }
    public required string WorkingDir { get; init; }
    public required string WorkflowId { get; init; }
    public required string? ActivePhaseId { get; init; }
    public required List<object> DisplayTree { get; init; }
}

/// <summary>
/// Callback interface for node handlers to invoke recursive execution.
/// Handlers that need to execute child nodes (for-each, phase) or dispatch
/// to blocks (blockRef) use this instead of depending on the engine directly.
/// </summary>
public interface INodeExecutionCallback
{
    /// <summary>
    /// Recursively executes a list of config nodes (used by for-each, phase, etc.).
    /// </summary>
    Task<string?> ExecuteConfigNodesAsync(
        ProjectSession session,
        JsonElement configNodes,
        Dictionary<string, object>? workflowConfig,
        string workingDir,
        string workflowId,
        string? activePhaseId,
        List<object> displayTree,
        string? previousOutput = null);

    /// <summary>
    /// Dispatches execution to a referenced block via BlockExecutorRegistry.
    /// </summary>
    Task<string?> ExecuteBlockRefAsync(
        ProjectSession session,
        string blockRefId,
        JsonElement phaseNode,
        string workingDir,
        List<object> displayTree,
        string nodeId,
        string? previousOutput);
}

/// <summary>
/// Interface for node type handlers in the workflow execution engine.
/// Each handler processes one type of config.nodes entry (for-each, set-variable, blockRef, etc.).
///
/// ARCHITECTURE (Phase 53-C): Extracted from NodeExecutionEngine to enable:
/// - Single-responsibility: each handler owns one node type
/// - Open/Closed: new node types = new handler class, zero engine changes
/// - Testability: handlers can be unit-tested with a mock NodeExecutionContext
///
/// Handlers receive a callback for recursive execution (e.g., for-each
/// calling ExecuteConfigNodesAsync on child nodes).
/// </summary>
public interface INodeHandler
{
    /// <summary>
    /// The node type this handler processes (e.g., "for-each", "set-variable").
    /// Null means this handler processes blockRef nodes (default dispatch).
    /// </summary>
    string? NodeType { get; }

    /// <summary>
    /// Executes a node and returns the output string (passed as previousOutput to the next node).
    /// </summary>
    Task<string?> ExecuteAsync(
        JsonElement node,
        NodeExecutionContext context,
        INodeExecutionCallback engine,
        string? previousOutput);
}
