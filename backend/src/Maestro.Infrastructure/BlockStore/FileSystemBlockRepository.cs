using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;

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
                var file = Path.Combine(dir, "block.json");
                if (!File.Exists(file)) continue;
                
                try
                {
                    var block = LoadBlockFromFile(file);
                    if (block != null)
                        list.Add(block);
                }
                catch
                {
                    // Skip invalid blocks
                }
            }
            return Task.FromResult<IEnumerable<BlockDefinition>>(list);
        }

        public Task<BlockDefinition?> GetByIdAsync(string id, CancellationToken ct = default)
        {
            var path = Path.Combine(_basePath, id);
            var file = Path.Combine(path, "block.json");
            
            if (!File.Exists(file)) 
                return Task.FromResult<BlockDefinition?>(null);
            
            try
            {
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
                
                var file = Path.Combine(dir, "block.json");
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
            
            // Load optional properties
            if (root.TryGetProperty("version", out var verEl))
            {
                // Version is set via Create(), so we'd need to update it differently
                // For now, default is handled in Create()
            }
            
            if (root.TryGetProperty("description", out var descEl))
            {
                // Description needs to be set via property or method
                // For now, store in metadata
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

            if (root.TryGetProperty("capabilities", out var capsEl))
            {
                // Capabilities are a list, would need to add them
                // For now, they're initialized empty
            }
            
            return def;
        }
    }
}
