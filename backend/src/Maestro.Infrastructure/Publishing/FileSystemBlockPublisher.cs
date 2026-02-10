using System.Text.Json;
using System.Text.Json.Serialization;
using Maestro.Application.Interfaces;
using Maestro.Infrastructure.Configuration;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Publishing;

/// <summary>
/// Publishes approved blocks to the user blocks directory and updates the catalog index.
/// Blocks are written to {dataPath}/blocks/{blockType}/{blockId}/
/// Catalog index is at {dataPath}/catalog/index.json
/// </summary>
public class FileSystemBlockPublisher : IBlockPublisher
{
    private readonly IBlockRepository _blockRepository;
    private readonly MaestroConfiguration _config;
    private readonly ILogger<FileSystemBlockPublisher>? _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    public FileSystemBlockPublisher(
        IBlockRepository blockRepository,
        MaestroConfiguration config,
        ILogger<FileSystemBlockPublisher>? logger = null)
    {
        _blockRepository = blockRepository;
        _config = config;
        _logger = logger;
    }

    public async Task<BlockManifest> PublishBlockAsync(
        string blockId,
        string blockName,
        string blockType,
        string? submittedBy,
        Dictionary<string, object>? metadata,
        CancellationToken ct = default)
    {
        // 1. Get the block definition from the repository
        var block = await _blockRepository.GetByIdAsync(blockId, ct);
        if (block == null)
        {
            throw new InvalidOperationException($"Block '{blockId}' not found in repository");
        }

        // 2. Build the manifest
        var manifest = BuildManifest(block, submittedBy, metadata);

        // 3. Write block definition and manifest to content/user/blocks/{blockType}/{blockId}/
        var blockDir = Path.Combine(_config.DataPath, "blocks", blockType, blockId);
        Directory.CreateDirectory(blockDir);

        var manifestPath = Path.Combine(blockDir, "manifest.json");
        var manifestJson = JsonSerializer.Serialize(manifest, JsonOptions);
        await File.WriteAllTextAsync(manifestPath, manifestJson, ct);

        var blockDefPath = Path.Combine(blockDir, "block.json");
        var blockDefJson = SerializeBlockDefinition(block);
        await File.WriteAllTextAsync(blockDefPath, blockDefJson, ct);

        _logger?.LogInformation(
            "Published block '{BlockId}' to {Path}",
            blockId, blockDir);

        // 4. Update catalog index
        await UpdateCatalogIndexAsync(manifest, ct);

        return manifest;
    }

    private static BlockManifest BuildManifest(
        Domain.Entities.BlockDefinition block,
        string? submittedBy,
        Dictionary<string, object>? metadata)
    {
        var manifest = new BlockManifest
        {
            Id = block.Id,
            Version = block.Version ?? "1.0.0",
            Type = block.BlockType,
            Author = submittedBy,
            Description = block.Description
        };

        // Extract tags from metadata if present
        if (metadata != null && metadata.TryGetValue("tags", out var tagsObj))
        {
            if (tagsObj is JsonElement tagsElement && tagsElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var tag in tagsElement.EnumerateArray())
                {
                    var tagStr = tag.GetString();
                    if (tagStr != null)
                    {
                        manifest.Tags.Add(tagStr);
                    }
                }
            }
            else if (tagsObj is IEnumerable<string> tagsList)
            {
                manifest.Tags.AddRange(tagsList);
            }
        }

        // Extract fitness info from metadata if present
        if (metadata != null && metadata.TryGetValue("fitness", out var fitnessObj))
        {
            if (fitnessObj is JsonElement fitnessElement)
            {
                var fitnessJson = fitnessElement.GetRawText();
                var fitness = JsonSerializer.Deserialize<BlockManifest.FitnessInfo>(fitnessJson, JsonOptions);
                if (fitness != null)
                {
                    manifest.Fitness = fitness;
                }
            }
        }

        manifest.Metrics = new BlockManifest.MetricsInfo
        {
            TestedAt = DateTimeOffset.UtcNow.ToString("o")
        };

        return manifest;
    }

    private static string SerializeBlockDefinition(Domain.Entities.BlockDefinition block)
    {
        var dto = new Dictionary<string, object?>
        {
            ["id"] = block.Id,
            ["name"] = block.Name,
            ["blockType"] = block.BlockType,
            ["version"] = block.Version,
            ["isAtomic"] = block.IsAtomic,
            ["description"] = block.Description,
            ["config"] = block.Config,
            ["metadata"] = block.Metadata,
            ["capabilities"] = block.Capabilities
        };

        return JsonSerializer.Serialize(dto, JsonOptions);
    }

    private async Task UpdateCatalogIndexAsync(BlockManifest manifest, CancellationToken ct)
    {
        var catalogDir = Path.Combine(_config.DataPath, "catalog");
        Directory.CreateDirectory(catalogDir);

        var indexPath = Path.Combine(catalogDir, "index.json");

        // Read existing catalog or create new one
        CatalogIndex catalog;
        if (File.Exists(indexPath))
        {
            try
            {
                var existingJson = await File.ReadAllTextAsync(indexPath, ct);
                catalog = JsonSerializer.Deserialize<CatalogIndex>(existingJson, JsonOptions)
                    ?? new CatalogIndex();
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to read existing catalog index, creating new one");
                catalog = new CatalogIndex();
            }
        }
        else
        {
            catalog = new CatalogIndex();
        }

        // Remove existing entry for same block ID (update scenario)
        catalog.Blocks.RemoveAll(b => b.Id == manifest.Id);

        // Add the new entry
        catalog.Blocks.Add(new CatalogEntry
        {
            Id = manifest.Id,
            Version = manifest.Version,
            Type = manifest.Type,
            Author = manifest.Author,
            Description = manifest.Description,
            Tags = manifest.Tags,
            PublishedAt = DateTimeOffset.UtcNow.ToString("o"),
            Path = $"blocks/{manifest.Type}/{manifest.Id}"
        });

        catalog.UpdatedAt = DateTimeOffset.UtcNow.ToString("o");

        // Write back
        var catalogJson = JsonSerializer.Serialize(catalog, JsonOptions);
        await File.WriteAllTextAsync(indexPath, catalogJson, ct);

        _logger?.LogInformation(
            "Updated catalog index with block '{BlockId}', total blocks: {Count}",
            manifest.Id, catalog.Blocks.Count);
    }

    /// <summary>
    /// Internal DTO for the catalog index.json file.
    /// </summary>
    private class CatalogIndex
    {
        public string Schema { get; set; } = "maestro-catalog/1.0";
        public string UpdatedAt { get; set; } = DateTimeOffset.UtcNow.ToString("o");
        public List<CatalogEntry> Blocks { get; set; } = new();
    }

    /// <summary>
    /// Internal DTO for a single catalog entry.
    /// </summary>
    private class CatalogEntry
    {
        public string Id { get; set; } = string.Empty;
        public string Version { get; set; } = "1.0.0";
        public string Type { get; set; } = string.Empty;
        public string? Author { get; set; }
        public string? Description { get; set; }
        public List<string> Tags { get; set; } = new();
        public string PublishedAt { get; set; } = string.Empty;
        public string Path { get; set; } = string.Empty;
    }
}
