namespace Maestro.Application.Interfaces;

using Maestro.Domain.Entities;

/// <summary>
/// Resolves blocks with workspace-first priority.
/// Workspace-local blocks can override system blocks.
/// </summary>
public interface IWorkspaceBlockResolver
{
    /// <summary>
    /// Resolves a block ID to a BlockDefinition, checking workspace-local blocks first.
    /// Resolution order:
    /// 1. Workspace-local blocks (workspaces/{id}/blocks/)
    /// 2. User overrides (blocks/user/)
    /// 3. System blocks (blocks/system/)
    /// 4. Regular blocks (blocks/)
    /// </summary>
    /// <param name="blockId">The block ID to resolve</param>
    /// <param name="workspaceId">The workspace context (optional)</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>The resolved block definition, or null if not found</returns>
    Task<BlockDefinition?> ResolveAsync(string blockId, string? workspaceId = null, CancellationToken ct = default);

    /// <summary>
    /// Lists all blocks available in a workspace context.
    /// Includes workspace-local blocks (which may override system blocks).
    /// </summary>
    /// <param name="workspaceId">The workspace context (optional)</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>All available blocks with workspace overrides applied</returns>
    Task<IEnumerable<BlockDefinition>> ListAvailableAsync(string? workspaceId = null, CancellationToken ct = default);

    /// <summary>
    /// Checks if a workspace has a local override for a block.
    /// </summary>
    Task<bool> HasWorkspaceOverrideAsync(string blockId, string workspaceId, CancellationToken ct = default);
}
