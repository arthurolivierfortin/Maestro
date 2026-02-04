using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Resolves permissions for a given execution context.
/// </summary>
public interface IPermissionChecker
{
    /// <summary>
    /// Gets the effective permissions for a given execution context.
    /// </summary>
    Task<ContextPermissions> GetPermissionsAsync(CliExecutionContext context, CancellationToken ct = default);
}
