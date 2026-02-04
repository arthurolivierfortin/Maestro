using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Cli.CommandHandlers;

/// <summary>
/// Handles the 'run' command to execute blocks.
/// Usage: run <block-id> [--input key=value] [--input-json {...}]
/// </summary>
public class RunCommandHandler : ICommandHandler
{
    private readonly IWorkspaceBlockResolver _blockResolver;
    private readonly IBlockRepository _blockRepository;
    private readonly ILogger<RunCommandHandler> _logger;

    public string Verb => "run";

    public RunCommandHandler(
        IWorkspaceBlockResolver blockResolver,
        IBlockRepository blockRepository,
        ILogger<RunCommandHandler> logger)
    {
        _blockResolver = blockResolver;
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
            return CliResult.Failure("Usage: run <block-id> [--input key=value]");
        }

        var blockId = command.Target;

        // Load block with workspace-first resolution
        var block = await _blockResolver.ResolveAsync(blockId, context.WorkspaceId, ct);
        if (block == null)
        {
            // Fallback to direct repository lookup for backwards compatibility
            block = await _blockRepository.GetByIdAsync(blockId, ct);
        }
        if (block == null)
        {
            return CliResult.Failure($"Block not found: {blockId}");
        }

        // Log if using workspace override
        if (block.Metadata?.ContainsKey("_isWorkspaceBlock") == true)
        {
            _logger.LogInformation(
                "Using workspace-local block {BlockId} from workspace {WorkspaceId}",
                blockId, context.WorkspaceId);
        }

        // Parse inputs
        var inputs = new Dictionary<string, object>();

        // Handle --input key=value arguments
        foreach (var arg in command.Arguments)
        {
            if (arg.Key.Equals("input", StringComparison.OrdinalIgnoreCase))
            {
                var parts = arg.Value.Split('=', 2);
                if (parts.Length == 2)
                {
                    inputs[parts[0]] = parts[1];
                }
            }
            else if (arg.Key.Equals("input-json", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    var jsonInputs = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(arg.Value);
                    if (jsonInputs != null)
                    {
                        foreach (var kv in jsonInputs)
                        {
                            inputs[kv.Key] = kv.Value;
                        }
                    }
                }
                catch (Exception ex)
                {
                    return CliResult.Failure($"Invalid JSON input: {ex.Message}");
                }
            }
        }

        // For now, return block info (actual execution would be done by block executor)
        _logger.LogInformation(
            "Run command for block {BlockId} with {InputCount} inputs",
            blockId, inputs.Count);

        return CliResult.Ok(new
        {
            blockId = block.Id,
            blockName = block.Name,
            blockType = block.BlockType,
            status = "pending",
            message = $"Block '{block.Name}' queued for execution",
            inputs
        });
    }
}
