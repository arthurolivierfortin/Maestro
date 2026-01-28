using Maestro.Domain.ValueObjects;

namespace Maestro.Application.DTOs;

/// <summary>
/// Data Transfer Object for block permissions.
/// </summary>
public record BlockPermissionDto
{
    public string BlockPattern { get; init; } = string.Empty;
    public string Permission { get; init; } = "allowed";
    public string? Reason { get; init; }

    public static BlockPermissionDto FromDomain(BlockPermission perm)
    {
        return new BlockPermissionDto
        {
            BlockPattern = perm.BlockPattern,
            Permission = perm.Permission.ToString().ToLowerInvariant(),
            Reason = perm.Reason
        };
    }

    public BlockPermission ToDomain()
    {
        return new BlockPermission
        {
            BlockPattern = BlockPattern,
            Permission = Enum.TryParse<BlockPermissionLevel>(Permission, true, out var p) ? p : BlockPermissionLevel.Allowed,
            Reason = Reason
        };
    }
}

/// <summary>
/// Request to update block permissions.
/// </summary>
public record UpdateBlockPermissionsRequest
{
    public List<BlockPermissionDto> Permissions { get; init; } = new();
}
