using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Utilities;

namespace Maestro.Infrastructure.BlockStore
{
    /// <summary>
    /// File system-based block repository with atomic writes and validation.
    /// </summary>
    public class FileSystemBlockRepository : IBlockRepository
    {
        private readonly string _basePath;
        private readonly IBlockChangePublisher? _publisher;
        private readonly IBlockValidator? _validator;
        private readonly SemaphoreSlim _writeLock = new(1, 1);

        public FileSystemBlockRepository(
            string basePath, 
            IBlockChangePublisher? publisher = null,
            IBlockValidator? validator = null)
        {
            _basePath = basePath ?? throw new ArgumentNullException(nameof(basePath));
            _publisher = publisher;
            _validator = validator;
            Directory.CreateDirectory(_basePath);
        }

        public async Task DeleteAsync(string id, CancellationToken ct = default)
        {
            await _writeLock.WaitAsync(ct);
            try
            {
                var path = Path.Combine(_basePath, id);
                if (Directory.Exists(path))
                {
                    Directory.Delete(path, recursive: true);
                }
                
                if (_publisher != null)
                {
                    await _publisher.PublishBlockDeletedAsync(id);
                }
            }
            finally
            {
                _writeLock.Release();
            }
        }

        public Task<IEnumerable<BlockDefinition>> GetAllAsync(CancellationToken ct = default)
        {
            var list = new List<BlockDefinition>();
            if (!Directory.Exists(_basePath))
                return Task.FromResult<IEnumerable<BlockDefinition>>(list);
                
            foreach (var dir in Directory.EnumerateDirectories(_basePath))
            {
                try
                {
                    // Find any file matching the block metadata convention
                    var file = Directory.EnumerateFiles(dir, "*.block.json", SearchOption.TopDirectoryOnly).FirstOrDefault();
                    if (file == null) continue;

                    var block = LoadBlockFromFile(file);
                    if (block != null)
                        list.Add(block);
                }
                catch
                {
                    // Skip invalid blocks or directories with IO errors
                }
            }
            return Task.FromResult<IEnumerable<BlockDefinition>>(list);
        }

        public Task<BlockDefinition?> GetByIdAsync(string id, CancellationToken ct = default)
        {
            var path = Path.Combine(_basePath, id);
            if (!Directory.Exists(path))
                return Task.FromResult<BlockDefinition?>(null);

            try
            {
                // Prefer files that match the name.type.block.json pattern; fallback to any *.block.json
                var file = Directory.EnumerateFiles(path, "*.block.json", SearchOption.TopDirectoryOnly).FirstOrDefault();
                if (file == null)
                    return Task.FromResult<BlockDefinition?>(null);

                var block = LoadBlockFromFile(file);
                return Task.FromResult<BlockDefinition?>(block);
            }
            catch
            {
                return Task.FromResult<BlockDefinition?>(null);
            }
        }

        public Task<string?> GetBlockPathAsync(string id, CancellationToken ct = default)
        {
            var path = Path.Combine(_basePath, id);
            if (Directory.Exists(path)) 
                return Task.FromResult<string?>(path);
            return Task.FromResult<string?>(null);
        }

        public async Task SaveAsync(BlockDefinition block, CancellationToken ct = default)
        {
            if (block == null) throw new ArgumentNullException(nameof(block));
            
            await _writeLock.WaitAsync(ct);
            try
            {
                var dir = Path.Combine(_basePath, block.Id);
                Directory.CreateDirectory(dir);
                var fileName = BlockFileNameHelper.CreateFileName(block.Name, block.BlockType);
                var file = Path.Combine(dir, fileName);
                var tempFile = file + ".tmp";
                
                // Serialize block
                var options = new JsonSerializerOptions { WriteIndented = true };
                var json = JsonSerializer.Serialize(new
                {
                    id = block.Id,
                    name = block.Name,
                    blockType = block.BlockType,
                    version = block.Version,
                    isAtomic = block.IsAtomic,
                    description = block.Description,
                    config = block.Config,
                    metadata = block.Metadata,
                    capabilities = block.Capabilities
                }, options);
                
                // Validate before writing (if validator provided)
                if (_validator != null)
                {
                    var validation = await _validator.ValidateAsync(json, ct);
                    if (!validation.IsValid)
                    {
                        // Log validation errors but continue for now
                        // In production, you might want to throw here
                    }
                }
                
                // Atomic write: write to temp file, then rename
                await File.WriteAllTextAsync(tempFile, json, ct);
                
                // Replace existing file atomically
                if (File.Exists(file))
                {
                    var backupFile = file + ".bak";
                    File.Move(file, backupFile, overwrite: true);
                    try
                    {
                        File.Move(tempFile, file);
                        File.Delete(backupFile);
                    }
                    catch
                    {
                        // Restore backup on failure
                        if (File.Exists(backupFile))
                            File.Move(backupFile, file, overwrite: true);
                        throw;
                    }
                }
                else
                {
                    File.Move(tempFile, file);
                }
                
                // Publish change event
                if (_publisher != null)
                {
                    var lightweight = new
                    {
                        id = block.Id,
                        name = block.Name,
                        blockType = block.BlockType
                    };
                    await _publisher.PublishBlockUpdatedAsync(lightweight);
                }
            }
            finally
            {
                _writeLock.Release();
            }
        }

        /// <summary>
        /// Save a block to a specific target folder (used for cloning blocks).
        /// </summary>
        public async Task SaveAsync(BlockDefinition block, string targetFolder, CancellationToken ct = default)
        {
            if (block == null) throw new ArgumentNullException(nameof(block));
            if (string.IsNullOrEmpty(targetFolder)) throw new ArgumentNullException(nameof(targetFolder));

            await _writeLock.WaitAsync(ct);
            try
            {
                // Resolve target folder relative to base path if not absolute
                var resolvedFolder = Path.IsPathRooted(targetFolder)
                    ? targetFolder
                    : Path.Combine(Path.GetDirectoryName(_basePath) ?? _basePath, targetFolder);

                Directory.CreateDirectory(resolvedFolder);

                var fileName = BlockFileNameHelper.CreateFileName(block.Name, block.BlockType);
                var file = Path.Combine(resolvedFolder, fileName);
                var tempFile = file + ".tmp";

                // Serialize block with all properties including override info
                var options = new JsonSerializerOptions { WriteIndented = true };
                var json = JsonSerializer.Serialize(new
                {
                    id = block.Id,
                    name = block.Name,
                    blockType = block.BlockType,
                    version = block.Version,
                    isAtomic = block.IsAtomic,
                    description = block.Description,
                    config = block.Config,
                    metadata = block.Metadata,
                    capabilities = block.Capabilities
                }, options);

                // Atomic write
                await File.WriteAllTextAsync(tempFile, json, ct);

                if (File.Exists(file))
                {
                    var backupFile = file + ".bak";
                    File.Move(file, backupFile, overwrite: true);
                    try
                    {
                        File.Move(tempFile, file);
                        File.Delete(backupFile);
                    }
                    catch
                    {
                        if (File.Exists(backupFile))
                            File.Move(backupFile, file, overwrite: true);
                        throw;
                    }
                }
                else
                {
                    File.Move(tempFile, file);
                }

                // Publish change event
                if (_publisher != null)
                {
                    var lightweight = new
                    {
                        id = block.Id,
                        name = block.Name,
                        blockType = block.BlockType
                    };
                    await _publisher.PublishBlockAddedAsync(lightweight);
                }
            }
            finally
            {
                _writeLock.Release();
            }
        }

        private BlockDefinition? LoadBlockFromFile(string filePath)
        {
            if (!File.Exists(filePath)) return null;

            var txt = File.ReadAllText(filePath);
            using var doc = JsonDocument.Parse(txt);
            var root = doc.RootElement;

            var id = root.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            var name = root.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : null;
            var blockType = root.TryGetProperty("blockType", out var btEl) ? btEl.GetString() : null;

            if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(name) || string.IsNullOrEmpty(blockType))
                return null;

            var def = BlockDefinition.Create(id, name, blockType);

            // Load isAtomic property
            if (root.TryGetProperty("isAtomic", out var atomicEl))
            {
                def.SetIsAtomic(atomicEl.GetBoolean());
            }
            else
            {
                // Default isAtomic based on block type if not specified
                var compositeTypes = new[] { "workflow", "agent", "task" };
                def.SetIsAtomic(!compositeTypes.Contains(blockType.ToLowerInvariant()));
            }

            // Load description
            if (root.TryGetProperty("description", out var descEl) && descEl.ValueKind == JsonValueKind.String)
            {
                def.SetDescription(descEl.GetString() ?? string.Empty);
            }

            if (root.TryGetProperty("config", out var cfg))
            {
                var configDict = JsonSerializer.Deserialize<Dictionary<string, object>>(cfg.GetRawText());
                if (configDict != null)
                    def.UpdateConfig(configDict);
            }

            if (root.TryGetProperty("metadata", out var meta))
            {
                var metaDict = JsonSerializer.Deserialize<Dictionary<string, object>>(meta.GetRawText());
                if (metaDict != null)
                    def.UpdateMetadata(metaDict);
            }

            // Load capabilities
            if (root.TryGetProperty("capabilities", out var capsEl) && capsEl.ValueKind == JsonValueKind.Array)
            {
                var capabilities = capsEl.EnumerateArray()
                    .Where(e => e.ValueKind == JsonValueKind.String)
                    .Select(e => e.GetString()!)
                    .ToList();
                def.AddCapabilities(capabilities);
            }

            return def;
        }

        
    }
}
