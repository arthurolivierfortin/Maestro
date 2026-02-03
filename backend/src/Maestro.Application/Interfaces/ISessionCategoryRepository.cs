using Maestro.Domain.Entities;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Repository interface for managing session categories.
/// </summary>
public interface ISessionCategoryRepository
{
    /// <summary>
    /// Gets all session categories (built-in and user-defined).
    /// </summary>
    Task<IEnumerable<SessionCategory>> GetAllAsync();

    /// <summary>
    /// Gets a session category by ID.
    /// </summary>
    Task<SessionCategory?> GetByIdAsync(string id);

    /// <summary>
    /// Creates a new user-defined category.
    /// </summary>
    Task<SessionCategory> CreateAsync(SessionCategory category);

    /// <summary>
    /// Updates an existing user-defined category.
    /// </summary>
    Task<SessionCategory> UpdateAsync(SessionCategory category);

    /// <summary>
    /// Deletes a user-defined category.
    /// Built-in categories cannot be deleted.
    /// </summary>
    Task DeleteAsync(string id);

    /// <summary>
    /// Checks if a category with the given ID exists.
    /// </summary>
    Task<bool> ExistsAsync(string id);

    /// <summary>
    /// Gets only user-defined categories.
    /// </summary>
    Task<IEnumerable<SessionCategory>> GetUserDefinedAsync();

    /// <summary>
    /// Gets only built-in categories.
    /// </summary>
    Task<IEnumerable<SessionCategory>> GetBuiltInAsync();
}
