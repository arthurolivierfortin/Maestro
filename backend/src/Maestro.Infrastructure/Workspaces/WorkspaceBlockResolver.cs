using System.Collections.Concurrent;
using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Configuration;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Workspaces;

/// <summary>
/// Resolves blocks with workspace-first priority.
/// </summary>
public class WorkspaceBlockResolver : IWorkspaceBlockResolver
{
    private readonly IBlockDiscoveryService _blockDiscoveryService;
    private readonly ILogger<WorkspaceBlockResolver> _logger;
    private readonly string _workspacesBasePath;
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, BlockDefinition>> _workspaceBlockCache = new();

    public WorkspaceBlockResolver(
        IBlockDiscoveryService blockDiscoveryService,
        ILogger<WorkspaceBlockResolver> logger,
        string? workspacesBasePath = null)
    {
        _blockDiscoveryService = blockDiscoveryService;
        _logger = logger;
        _workspacesBasePath = workspacesBasePath ?? Path.Combine(Directory.GetCurrentDirectory(), "workspaces");
    }

    /// <inheritdoc/>
    public async Task<BlockDefinition?> ResolveAsync(string blockId, string? workspaceId = null, CancellationToken ct = default)
    {
        // 1. Check workspace-local blocks first
        if (!string.IsNullOrEmpty(workspaceId))
        {
            var workspaceBlock = await GetWorkspaceBlockAsync(blockId, workspaceId, ct);
            if (workspaceBlock != null)
            {
                _logger.LogDebug(
                    "Resolved block {BlockId} from workspace {WorkspaceId}",
                    blockId, workspaceId);
                return workspaceBlock;
            }
        }

        // 2. Fall back to global block discovery (includes system and user blocks)
        var globalBlock = await _blockDiscoveryService.GetByIdAsync(blockId, ct);
        if (globalBlock != null)
        {
            _logger.LogDebug("Resolved block {BlockId} from global discovery", blockId);
        }

        return globalBlock;
    }

    /// <inheritdoc/>
    public async Task<IEnumerable<BlockDefinition>> ListAvailableAsync(string? workspaceId = null, CancellationToken ct = default)
    {
        // Start with all global blocks
        var allBlocks = (await _blockDiscoveryService.DiscoverAllAsync(ct)).ToDictionary(b => b.Id);

        // If workspace specified, overlay workspace blocks
        if (!string.IsNullOrEmpty(workspaceId))
        {
            var workspaceBlocks = await GetAllWorkspaceBlocksAsync(workspaceId, ct);
            foreach (var block in workspaceBlocks)
            {
                // Workspace blocks override global blocks with the same ID
                allBlocks[block.Id] = block;
            }
        }

        return allBlocks.Values;
    }

    /// <inheritdoc/>
    public async Task<bool> HasWorkspaceOverrideAsync(string blockId, string workspaceId, CancellationToken ct = default)
    {
        var workspaceBlock = await GetWorkspaceBlockAsync(blockId, workspaceId, ct);
        return workspaceBlock != null;
    }

    private async Task<BlockDefinition?> GetWorkspaceBlockAsync(string blockId, string workspaceId, CancellationToken ct)
    {
        var workspaceBlocks = await GetOrLoadWorkspaceBlocksAsync(workspaceId, ct);
        workspaceBlocks.TryGetValue(blockId, out var block);
        return block;
    }

    private async Task<IEnumerable<BlockDefinition>> GetAllWorkspaceBlocksAsync(string workspaceId, CancellationToken ct)
    {
        var workspaceBlocks = await GetOrLoadWorkspaceBlocksAsync(workspaceId, ct);
        return workspaceBlocks.Values;
    }

    private Task<ConcurrentDictionary<string, BlockDefinition>> GetOrLoadWorkspaceBlocksAsync(string workspaceId, CancellationToken ct)
    {
        return Task.FromResult(_workspaceBlockCache.GetOrAdd(workspaceId, id => LoadWorkspaceBlocks(id)));
    }

    private ConcurrentDictionary<string, BlockDefinition> LoadWorkspaceBlocks(string workspaceId)
    {
        var blocks = new ConcurrentDictionary<string, BlockDefinition>();
        var blocksPath = Path.Combine(_workspacesBasePath, workspaceId, "blocks");

        if (!Directory.Exists(blocksPath))
        {
            return blocks;
        }

        try
        {
            // Scan for *.block.json files in workspace blocks folder
            foreach (var file in Directory.EnumerateFiles(blocksPath, MaestroConstants.BlockFileGlobPattern, SearchOption.AllDirectories))
            {
                try
                {
                    var block = LoadBlockFromFile(file, workspaceId);
                    if (block != null)
                    {
                        blocks[block.Id] = block;
                        _logger.LogDebug(
                            "Loaded workspace block {BlockId} from {Path}",
                            block.Id, file);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to load workspace block from {Path}", file);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to scan workspace blocks for {WorkspaceId}", workspaceId);
        }

        return blocks;
    }

    private BlockDefinition? LoadBlockFromFile(string filePath, string workspaceId)
    {
        if (!File.Exists(filePath)) return null;

        var txt = File.ReadAllText(filePath);
        using var doc = JsonDocument.Parse(txt);
        var root = doc.RootElement;

        // Get ID from file content, or derive from filename
        var id = root.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
        var fileName = Path.GetFileName(filePath);

        if (string.IsNullOrEmpty(id))
        {
            // Remove .block.json extension to get "name.type"
            var nameWithType = Path.GetFileNameWithoutExtension(Path.GetFileNameWithoutExtension(fileName));
            id = nameWithType;
        }

        var name = root.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : id;
        var blockType = root.TryGetProperty("blockType", out var btEl) ? btEl.GetString() : "unknown";

        var def = BlockDefinition.Create(id ?? Guid.NewGuid().ToString(), name ?? id ?? string.Empty, blockType ?? string.Empty);

        // Load isAtomic property
        if (root.TryGetProperty("isAtomic", out var atomicEl))
        {
            def.SetIsAtomic(atomicEl.GetBoolean());
        }
        else
        {
            var compositeTypes = new[] { "workflow", "agent", "task" };
            def.SetIsAtomic(!compositeTypes.Contains((blockType ?? string.Empty).ToLowerInvariant()));
        }

        // Load description
        if (root.TryGetProperty("description", out var descEl) && descEl.ValueKind == JsonValueKind.String)
        {
            def.SetDescription(descEl.GetString() ?? string.Empty);
        }

        // Load version
        if (root.TryGetProperty("version", out var verEl) && verEl.ValueKind == JsonValueKind.String)
        {
            def.SetVersion(verEl.GetString() ?? "1.0.0");
        }

        // Mark as workspace-local block
        def.SetIsSystem(false);

        // Check if this overrides a system block
        if (root.TryGetProperty("overridesSystemBlock", out var overridesEl) && overridesEl.ValueKind == JsonValueKind.String)
        {
            def.SetOverridesSystemBlock(overridesEl.GetString());
        }

        // Load config
        if (root.TryGetProperty("config", out var cfg))
        {
            def.UpdateConfig(JsonSerializer.Deserialize<Dictionary<string, object>>(cfg.GetRawText()) ?? new());
        }

        // Load and enhance metadata
        var metadata = new Dictionary<string, object>();
        if (root.TryGetProperty("metadata", out var meta))
        {
            metadata = JsonSerializer.Deserialize<Dictionary<string, object>>(meta.GetRawText()) ?? new();
        }
        metadata["_sourcePath"] = filePath;
        metadata["_workspaceId"] = workspaceId;
        metadata["_isWorkspaceBlock"] = true;
        def.UpdateMetadata(metadata);

        return def;
    }

    /// <summary>
    /// Invalidates the cache for a specific workspace.
    /// Call this when workspace blocks are modified.
    /// </summary>
    public void InvalidateWorkspaceCache(string workspaceId)
    {
        _workspaceBlockCache.TryRemove(workspaceId, out _);
        _logger.LogDebug("Invalidated block cache for workspace {WorkspaceId}", workspaceId);
    }

    /// <summary>
    /// Invalidates all workspace caches.
    /// </summary>
    public void InvalidateAllCaches()
    {
        _workspaceBlockCache.Clear();
        _logger.LogDebug("Invalidated all workspace block caches");
    }
}
