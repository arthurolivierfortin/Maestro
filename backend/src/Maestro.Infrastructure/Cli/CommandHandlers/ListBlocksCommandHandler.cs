using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Cli.CommandHandlers;

/// <summary>
/// Handles the 'list-blocks' command.
/// Lists all blocks available to the current context.
/// </summary>
public class ListBlocksCommandHandler : ICommandHandler
{
    private readonly IBlockDiscoveryService _blockDiscovery;
    private readonly ILogger<ListBlocksCommandHandler> _logger;

    public string Verb => "list-blocks";

    public ListBlocksCommandHandler(
        IBlockDiscoveryService blockDiscovery,
        ILogger<ListBlocksCommandHandler> logger)
    {
        _blockDiscovery = blockDiscovery;
        _logger = logger;
    }

    public async Task<CliResult> HandleAsync(
        ParsedCommand command,
        CliExecutionContext context,
        ContextPermissions permissions,
        CancellationToken ct = default)
    {
        // Get all blocks
        var allBlocks = await _blockDiscovery.DiscoverAllAsync();

        // Filter by type if specified
        var typeFilter = command.GetArgument("type");
        if (!string.IsNullOrEmpty(typeFilter))
        {
            allBlocks = allBlocks
                .Where(b => b.BlockType.Equals(typeFilter, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        // Filter by permissions
        var accessibleBlocks = allBlocks
            .Where(b => permissions.HasBlock(b.Id) || permissions.HasBlock(b.Name))
            .Select(b => new
            {
                id = b.Id,
                name = b.Name,
                type = b.BlockType,
                description = b.Description,
                isAtomic = b.IsAtomic,
                isSystem = b.Id.StartsWith("system:")
            })
            .OrderBy(b => b.type)
            .ThenBy(b => b.name)
            .ToList();

        _logger.LogDebug(
            "Listed {Count} blocks for context WorkspaceId={WorkspaceId}",
            accessibleBlocks.Count, context.WorkspaceId);

        return CliResult.Ok(new
        {
            blocks = accessibleBlocks,
            count = accessibleBlocks.Count
        });
    }
}
