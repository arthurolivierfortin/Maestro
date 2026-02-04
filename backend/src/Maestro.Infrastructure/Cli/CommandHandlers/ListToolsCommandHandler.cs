using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Cli.CommandHandlers;

/// <summary>
/// Handles the 'list-tools' command.
/// Lists all tools available to the current context.
/// </summary>
public class ListToolsCommandHandler : ICommandHandler
{
    private readonly IBlockDiscoveryService _blockDiscovery;
    private readonly ILogger<ListToolsCommandHandler> _logger;

    public string Verb => "list-tools";

    public ListToolsCommandHandler(
        IBlockDiscoveryService blockDiscovery,
        ILogger<ListToolsCommandHandler> logger)
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
        // Get all tool blocks
        var allBlocks = await _blockDiscovery.DiscoverAllAsync();
        var toolBlocks = allBlocks
            .Where(b => b.BlockType.Equals("tool", StringComparison.OrdinalIgnoreCase))
            .ToList();

        // Filter by permissions
        var accessibleTools = toolBlocks
            .Where(t => permissions.HasTool(t.Id) || permissions.HasTool(t.Name))
            .Select(t => new
            {
                id = t.Id,
                name = t.Name,
                description = t.Description,
                isSystem = t.Id.StartsWith("system:")
            })
            .OrderBy(t => t.name)
            .ToList();

        _logger.LogDebug(
            "Listed {Count} tools for context WorkspaceId={WorkspaceId}",
            accessibleTools.Count, context.WorkspaceId);

        return CliResult.Ok(new
        {
            tools = accessibleTools,
            count = accessibleTools.Count
        });
    }
}
