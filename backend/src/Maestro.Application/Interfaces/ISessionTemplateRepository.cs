using Maestro.Domain.Entities;
using Maestro.Domain.Enums;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository interface for SessionTemplate persistence operations.
/// </summary>
public interface ISessionTemplateRepository
{
    /// <summary>
    /// Gets a session template by its unique identifier.
    /// </summary>
    Task<SessionTemplate?> GetByIdAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Gets all session templates with optional filtering.
    /// </summary>
    Task<IEnumerable<SessionTemplate>> GetAllAsync(
        TemplateSource? source = null,
        EnvironmentMode? mode = null,
        string? categoryId = null,
        IEnumerable<string>? tags = null,
        CancellationToken ct = default);

    /// <summary>
    /// Gets all built-in session templates.
    /// </summary>
    Task<IEnumerable<SessionTemplate>> GetBuiltInAsync(CancellationToken ct = default);

    /// <summary>
    /// Gets all user-defined session templates.
    /// </summary>
    Task<IEnumerable<SessionTemplate>> GetUserDefinedAsync(CancellationToken ct = default);

    /// <summary>
    /// Saves a session template (create or update).
    /// User-defined templates only.
    /// </summary>
    Task SaveAsync(SessionTemplate template, CancellationToken ct = default);

    /// <summary>
    /// Deletes a session template by ID.
    /// User-defined templates only.
    /// </summary>
    Task DeleteAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Checks if a session template ID exists.
    /// </summary>
    Task<bool> ExistsAsync(string id, CancellationToken ct = default);
}
