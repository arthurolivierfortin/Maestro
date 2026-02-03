using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Configuration;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.BlockStore;

/// <summary>
/// Service for managing system blocks and their user overrides.
/// </summary>
public class SystemBlockService : ISystemBlockService
{
    private readonly FileSystemBlockDiscoveryService _blockDiscoveryService;
    private readonly string _userOverridesPath;
    private readonly ILogger<SystemBlockService>? _logger;

    public SystemBlockService(
        FileSystemBlockDiscoveryService blockDiscoveryService,
        string blocksBasePath,
        ILogger<SystemBlockService>? logger = null)
    {
        _blockDiscoveryService = blockDiscoveryService;
        _userOverridesPath = Path.Combine(blocksBasePath, MaestroConstants.UserOverridesFolderName);
        _logger = logger;
    }

    public Task<IEnumerable<BlockDefinition>> GetSystemBlocksAsync(CancellationToken ct = default)
    {
        return Task.FromResult(_blockDiscoveryService.GetSystemBlocks());
    }

    public Task<BlockDefinition?> GetSystemBlockAsync(string blockId, CancellationToken ct = default)
    {
        var systemBlock = _blockDiscoveryService.GetSystemBlocks()
            .FirstOrDefault(b => b.Id == blockId);
        return Task.FromResult(systemBlock);
    }

    public Task<IEnumerable<BlockDefinition>> GetUserOverridesAsync(CancellationToken ct = default)
    {
        return Task.FromResult(_blockDiscoveryService.GetUserOverrides());
    }

    public async Task<BlockDefinition> CreateOverrideAsync(
        string systemBlockId,
        Dictionary<string, object>? overrideConfig = null,
        CancellationToken ct = default)
    {
        var systemBlock = await GetSystemBlockAsync(systemBlockId, ct);
        if (systemBlock == null)
        {
            throw new ArgumentException($"System block '{systemBlockId}' not found");
        }

        if (!systemBlock.Overridable)
        {
            throw new InvalidOperationException($"System block '{systemBlockId}' is not overridable");
        }

        // Create user overrides directory if it doesn't exist
        if (!Directory.Exists(_userOverridesPath))
        {
            Directory.CreateDirectory(_userOverridesPath);
        }

        // Create the override block file
        var overrideBlockId = systemBlockId.Replace("system:", "user:");
        var fileName = $"{overrideBlockId.Replace(":", "-")}.{systemBlock.BlockType}.block.json";
        var filePath = Path.Combine(_userOverridesPath, fileName);

        // Create the override definition
        var overrideDefinition = new
        {
            id = overrideBlockId,
            name = systemBlock.Name,
            blockType = systemBlock.BlockType,
            description = systemBlock.Description,
            version = "1.0.0",
            isAtomic = systemBlock.IsAtomic,
            overridesSystemBlock = systemBlockId,
            config = overrideConfig ?? systemBlock.Config,
            metadata = new Dictionary<string, object>
            {
                ["_createdAt"] = DateTimeOffset.UtcNow.ToString("o"),
                ["_overridesSystemBlock"] = systemBlockId
            },
            capabilities = systemBlock.Capabilities
        };

        var json = JsonSerializer.Serialize(overrideDefinition, new JsonSerializerOptions
        {
            WriteIndented = true
        });

        await File.WriteAllTextAsync(filePath, json, ct);

        _logger?.LogInformation("Created override for system block {SystemBlockId} at {FilePath}",
            systemBlockId, filePath);

        // Create and return the override block definition
        var overrideBlock = BlockDefinition.Create(overrideBlockId, systemBlock.Name, systemBlock.BlockType);
        overrideBlock.SetIsAtomic(systemBlock.IsAtomic);
        overrideBlock.SetDescription(systemBlock.Description);
        overrideBlock.SetOverridesSystemBlock(systemBlockId);
        if (overrideConfig != null)
        {
            overrideBlock.UpdateConfig(overrideConfig);
        }
        overrideBlock.AddCapabilities(systemBlock.Capabilities);

        return overrideBlock;
    }

    public async Task RestoreSystemBlockAsync(string systemBlockId, CancellationToken ct = default)
    {
        var systemBlock = await GetSystemBlockAsync(systemBlockId, ct);
        if (systemBlock == null)
        {
            throw new ArgumentException($"System block '{systemBlockId}' not found");
        }

        // Find and delete any override files for this system block
        if (!Directory.Exists(_userOverridesPath))
        {
            return;
        }

        var overrides = _blockDiscoveryService.GetUserOverrides()
            .Where(o => o.OverridesSystemBlock == systemBlockId);

        foreach (var overrideBlock in overrides)
        {
            if (overrideBlock.Metadata.TryGetValue("_sourcePath", out var pathObj) && pathObj is string path)
            {
                if (File.Exists(path))
                {
                    File.Delete(path);
                    _logger?.LogInformation("Deleted override file {FilePath} for system block {SystemBlockId}",
                        path, systemBlockId);
                }
            }
        }
    }

    public Task<bool> HasOverrideAsync(string systemBlockId, CancellationToken ct = default)
    {
        var hasOverride = _blockDiscoveryService.GetUserOverrides()
            .Any(o => o.OverridesSystemBlock == systemBlockId);
        return Task.FromResult(hasOverride);
    }

    public async Task<BlockDefinition?> GetEffectiveBlockAsync(string blockId, CancellationToken ct = default)
    {
        // The discovery service already applies overrides, so just get from the main cache
        return await _blockDiscoveryService.GetByIdAsync(blockId, ct);
    }
}
