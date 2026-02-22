using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Manages sandbox images and worktree provisioning.
/// V1: CLI-local storage (.maestro/sandboxes/). Future 38-B: backend API.
/// </summary>
public interface ISandboxManager
{
    /// <summary>Creates a new sandbox image from a git repository.</summary>
    Task<SandboxImage> CreateAsync(string id, string sourcePath,
        IEnumerable<SandboxCheckpoint>? checkpoints = null, string? description = null,
        CancellationToken ct = default);

    /// <summary>Lists all sandbox images.</summary>
    Task<IReadOnlyList<SandboxImage>> ListAsync(CancellationToken ct = default);

    /// <summary>Gets a sandbox image by ID. Returns null if not found.</summary>
    Task<SandboxImage?> GetAsync(string id, CancellationToken ct = default);

    /// <summary>Deletes a sandbox image and its metadata.</summary>
    Task DeleteAsync(string id, CancellationToken ct = default);

    /// <summary>Adds a checkpoint to an existing image.</summary>
    Task AddCheckpointAsync(string imageId, SandboxCheckpoint checkpoint, CancellationToken ct = default);

    /// <summary>
    /// Provisions a git worktree at the given checkpoint ref.
    /// Returns the absolute path to the worktree.
    /// </summary>
    Task<string> ProvisionWorktreeAsync(string imageId, string checkpointId,
        string? targetPath = null, CancellationToken ct = default);

    /// <summary>Destroys a provisioned worktree.</summary>
    Task DestroyWorktreeAsync(string worktreePath, CancellationToken ct = default);
}
