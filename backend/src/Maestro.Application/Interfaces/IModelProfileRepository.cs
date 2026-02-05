using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository for model profiles used in fitness calculations.
/// </summary>
public interface IModelProfileRepository
{
    /// <summary>
    /// Get a model profile by ID.
    /// </summary>
    Task<ModelProfile?> GetAsync(string modelId, CancellationToken ct = default);

    /// <summary>
    /// Get all model profiles.
    /// </summary>
    Task<IReadOnlyList<ModelProfile>> GetAllAsync(CancellationToken ct = default);

    /// <summary>
    /// Get model profiles by provider.
    /// </summary>
    Task<IReadOnlyList<ModelProfile>> GetByProviderAsync(string provider, CancellationToken ct = default);

    /// <summary>
    /// Save or update a model profile.
    /// </summary>
    Task<ModelProfile> SaveAsync(ModelProfile profile, CancellationToken ct = default);

    /// <summary>
    /// Delete a model profile.
    /// </summary>
    Task DeleteAsync(string modelId, CancellationToken ct = default);

    /// <summary>
    /// Check if a profile exists.
    /// </summary>
    Task<bool> ExistsAsync(string modelId, CancellationToken ct = default);

    /// <summary>
    /// Get or create a profile (creates generic if not found).
    /// </summary>
    Task<ModelProfile> GetOrCreateAsync(string modelId, string provider, bool isLocal = false, CancellationToken ct = default);

    /// <summary>
    /// Initialize default profiles if not present.
    /// </summary>
    Task InitializeDefaultsAsync(CancellationToken ct = default);
}
