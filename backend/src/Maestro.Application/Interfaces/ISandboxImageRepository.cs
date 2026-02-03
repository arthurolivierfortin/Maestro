using Maestro.Domain.Entities;
using Maestro.Domain.Enums;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository interface for SandboxImage persistence operations.
/// </summary>
public interface ISandboxImageRepository
{
    /// <summary>
    /// Gets a sandbox image by its unique identifier.
    /// </summary>
    Task<SandboxImage?> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Gets all sandbox images with optional filtering.
    /// </summary>
    Task<IEnumerable<SandboxImage>> GetAllAsync(
        ImageSource? source = null,
        bool? verified = null,
        IEnumerable<string>? tags = null,
        CancellationToken ct = default);

    /// <summary>
    /// Gets all built-in sandbox images.
    /// </summary>
    Task<IEnumerable<SandboxImage>> GetBuiltInAsync(CancellationToken ct = default);

    /// <summary>
    /// Gets all user-defined sandbox images.
    /// </summary>
    Task<IEnumerable<SandboxImage>> GetUserDefinedAsync(CancellationToken ct = default);

    /// <summary>
    /// Saves a sandbox image (create or update).
    /// User-defined images only.
    /// </summary>
    Task SaveAsync(SandboxImage image, CancellationToken ct = default);

    /// <summary>
    /// Deletes a sandbox image by ID.
    /// User-defined images only.
    /// </summary>
    Task DeleteAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Checks if a sandbox image ID exists.
    /// </summary>
    Task<bool> ExistsAsync(string id, CancellationToken ct = default);
}
