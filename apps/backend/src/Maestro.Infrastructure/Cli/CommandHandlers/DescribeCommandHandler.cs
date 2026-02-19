using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Cli.CommandHandlers;

/// <summary>
/// Handles the 'describe' command.
/// Shows detailed information about a block.
/// Usage: describe <block-id>
/// </summary>
public class DescribeCommandHandler : ICommandHandler
{
    private readonly IBlockRepository _blockRepository;
    private readonly ILogger<DescribeCommandHandler> _logger;

    public string Verb => "describe";

    public DescribeCommandHandler(
        IBlockRepository blockRepository,
        ILogger<DescribeCommandHandler> logger)
    {
        _blockRepository = blockRepository;
        _logger = logger;
    }

    public async Task<CliResult> HandleAsync(
        ParsedCommand command,
        CliExecutionContext context,
        ContextPermissions permissions,
        CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(command.Target))
        {
            return CliResult.Failure("Usage: describe <block-id>");
        }

        var blockId = command.Target;

        // Check permission
        if (!permissions.HasBlock(blockId) && !permissions.HasTool(blockId))
        {
            return CliResult.PermissionDenied($"Access denied to '{blockId}'");
        }

        // Load block
        var block = await _blockRepository.GetByIdAsync(blockId, ct);
        if (block == null)
        {
            return CliResult.Failure($"Block not found: {blockId}");
        }

        _logger.LogDebug("Described block {BlockId}", blockId);

        return CliResult.Ok(new
        {
            id = block.Id,
            name = block.Name,
            type = block.BlockType,
            description = block.Description,
            version = block.Version,
            isAtomic = block.IsAtomic,
            isSystem = block.IsSystem,
            config = block.Config,
            capabilities = block.Capabilities,
            metadata = block.Metadata
        });
    }
}
