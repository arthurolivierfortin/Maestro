using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Domain.Entities;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Service for managing system blocks and their user overrides.
/// </summary>
public interface ISystemBlockService
{
    /// <summary>
    /// Gets all system blocks (before overrides are applied).
    /// </summary>
    Task<IEnumerable<BlockDefinition>> GetSystemBlocksAsync(CancellationToken ct = default);

    /// <summary>
    /// Gets a specific system block by ID.
    /// </summary>
    Task<BlockDefinition?> GetSystemBlockAsync(string blockId, CancellationToken ct = default);

    /// <summary>
    /// Gets all user overrides.
    /// </summary>
    Task<IEnumerable<BlockDefinition>> GetUserOverridesAsync(CancellationToken ct = default);

    /// <summary>
    /// Creates a user override for a system block.
    /// </summary>
    /// <param name="systemBlockId">The ID of the system block to override</param>
    /// <param name="overrideConfig">Configuration to override</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>The created override block</returns>
    Task<BlockDefinition> CreateOverrideAsync(
        string systemBlockId,
        Dictionary<string, object>? overrideConfig = null,
        CancellationToken ct = default);

    /// <summary>
    /// Restores a system block to its default configuration by removing any user override.
    /// </summary>
    /// <param name="systemBlockId">The ID of the system block to restore</param>
    /// <param name="ct">Cancellation token</param>
    Task RestoreSystemBlockAsync(string systemBlockId, CancellationToken ct = default);

    /// <summary>
    /// Checks if a system block has a user override.
    /// </summary>
    Task<bool> HasOverrideAsync(string systemBlockId, CancellationToken ct = default);

    /// <summary>
    /// Gets the effective block (system block with override applied if present).
    /// </summary>
    Task<BlockDefinition?> GetEffectiveBlockAsync(string blockId, CancellationToken ct = default);
}
