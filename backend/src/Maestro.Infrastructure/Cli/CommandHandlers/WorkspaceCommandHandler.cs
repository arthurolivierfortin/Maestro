using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Cli.CommandHandlers;

/// <summary>
/// Handles the 'workspace' command for workspace information.
/// Usage: workspace <subcommand>
/// Subcommands: info, blocks, config
/// </summary>
public class WorkspaceCommandHandler : ICommandHandler
{
    private readonly IWorkspaceService _workspaceService;
    private readonly IBlockDiscoveryService _blockDiscovery;
    private readonly ILogger<WorkspaceCommandHandler> _logger;

    public string Verb => "workspace";

    public WorkspaceCommandHandler(
        IWorkspaceService workspaceService,
        IBlockDiscoveryService blockDiscovery,
        ILogger<WorkspaceCommandHandler> logger)
    {
        _workspaceService = workspaceService;
        _blockDiscovery = blockDiscovery;
        _logger = logger;
    }

    public async Task<CliResult> HandleAsync(
        ParsedCommand command,
        CliExecutionContext context,
        ContextPermissions permissions,
        CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(context.WorkspaceId))
        {
            return CliResult.Failure("Workspace commands require a workspace context");
        }

        var subcommand = command.Target?.ToLowerInvariant() ?? "info";

        return subcommand switch
        {
            "info" => await HandleInfo(context, ct),
            "blocks" => await HandleBlocks(context, permissions, ct),
            "config" => await HandleConfig(context, ct),
            _ => CliResult.Failure($"Unknown workspace subcommand: {subcommand}")
        };
    }

    private async Task<CliResult> HandleInfo(
        CliExecutionContext context,
        CancellationToken ct)
    {
        var workspace = await _workspaceService.GetWorkspaceAsync(context.WorkspaceId!, ct);
        if (workspace == null)
        {
            return CliResult.Failure($"Workspace not found: {context.WorkspaceId}");
        }

        return CliResult.Ok(new
        {
            id = workspace.Id,
            name = workspace.Name,
            description = workspace.Description,
            type = workspace.Type,
            path = workspace.Path,
            status = workspace.Status.ToString(),
            sessionCount = 0, // Would need to query sessions
            entryPoints = workspace.EntryPoints,
            templateTypes = workspace.SessionTemplates.Keys.ToList(),
            createdAt = workspace.CreatedAt,
            updatedAt = workspace.UpdatedAt
        });
    }

    private async Task<CliResult> HandleBlocks(
        CliExecutionContext context,
        ContextPermissions permissions,
        CancellationToken ct)
    {
        var allBlocks = await _blockDiscovery.DiscoverAllAsync();

        // Group by type
        var blocksByType = allBlocks
            .Where(b => permissions.HasBlock(b.Id) || permissions.HasBlock(b.Name))
            .GroupBy(b => b.BlockType)
            .ToDictionary(
                g => g.Key,
                g => g.Select(b => new { id = b.Id, name = b.Name }).ToList()
            );

        return CliResult.Ok(new
        {
            workspaceId = context.WorkspaceId,
            blocks = blocksByType,
            totalCount = blocksByType.Values.Sum(v => v.Count)
        });
    }

    private async Task<CliResult> HandleConfig(
        CliExecutionContext context,
        CancellationToken ct)
    {
        var workspace = await _workspaceService.GetWorkspaceAsync(context.WorkspaceId!, ct);
        if (workspace == null)
        {
            return CliResult.Failure($"Workspace not found: {context.WorkspaceId}");
        }

        return CliResult.Ok(new
        {
            workspaceId = workspace.Id,
            permissions = new
            {
                allowedCommands = workspace.Permissions.AllowedCommands,
                allowedTools = workspace.Permissions.AllowedTools,
                allowedBlocks = workspace.Permissions.AllowedBlocks,
                canCreateBlocks = workspace.Permissions.CanCreateBlocks,
                canCreateSessions = workspace.Permissions.CanCreateSessions,
                dataCollections = workspace.Permissions.DataCollections
            },
            sessionTemplates = workspace.SessionTemplates.Keys.ToList(),
            entryPoints = workspace.EntryPoints
        });
    }
}
