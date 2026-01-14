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
    public class FileSystemBlockRepository : IBlockRepository
    {
        private readonly string _basePath;
        private readonly Maestro.Application.Interfaces.IBlockChangePublisher? _publisher;

        public FileSystemBlockRepository(string basePath, Maestro.Application.Interfaces.IBlockChangePublisher? publisher = null)
        {
            _basePath = basePath ?? throw new ArgumentNullException(nameof(basePath));
            _publisher = publisher;
            Directory.CreateDirectory(_basePath);
        }

        public async Task DeleteAsync(string id, CancellationToken ct = default)
        {
            var path = Path.Combine(_basePath, id);
            if (Directory.Exists(path)) Directory.Delete(path, true);
            if (_publisher != null)
            {
                await _publisher.PublishBlockDeletedAsync(id);
            }
            return;
        }

        public Task<IEnumerable<BlockDefinition>> GetAllAsync(CancellationToken ct = default)
        {
            var list = new List<BlockDefinition>();
            foreach (var dir in Directory.EnumerateDirectories(_basePath))
            {
                var file = Path.Combine(dir, "block.json");
                if (!File.Exists(file)) continue;
                try
                {
                    var txt = File.ReadAllText(file);
                    using var doc = JsonDocument.Parse(txt);
                    var root = doc.RootElement;
                    var id = root.GetProperty("id").GetString() ?? Path.GetFileName(dir);
                    var name = root.GetProperty("name").GetString() ?? id;
                    var blockType = root.GetProperty("blockType").GetString() ?? "unknown";
                    var def = BlockDefinition.Create(id, name, blockType);
                    list.Add(def);
                }
                catch { }
            }
            return Task.FromResult<IEnumerable<BlockDefinition>>(list);
        }

        public Task<BlockDefinition?> GetByIdAsync(string id, CancellationToken ct = default)
        {
            var path = Path.Combine(_basePath, id);
            var file = Path.Combine(path, "block.json");
            if (!File.Exists(file)) return Task.FromResult<BlockDefinition?>(null);
            try
            {
                var txt = File.ReadAllText(file);
                using var doc = JsonDocument.Parse(txt);
                var root = doc.RootElement;
                var name = root.GetProperty("name").GetString() ?? id;
                var blockType = root.GetProperty("blockType").GetString() ?? "unknown";
                var def = BlockDefinition.Create(id, name, blockType);
                return Task.FromResult<BlockDefinition?>(def);
            }
            catch { return Task.FromResult<BlockDefinition?>(null); }
        }

        public Task<string?> GetBlockPathAsync(string id, CancellationToken ct = default)
        {
            var path = Path.Combine(_basePath, id);
            if (Directory.Exists(path)) return Task.FromResult<string?>(path);
            return Task.FromResult<string?>(null);
        }

        public async Task SaveAsync(BlockDefinition block, CancellationToken ct = default)
        {
            var dir = Path.Combine(_basePath, block.Id);
            Directory.CreateDirectory(dir);
            var file = Path.Combine(dir, "block.json");
            // atomic write
            var tmp = file + ".tmp";
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

            File.WriteAllText(tmp, json);
            if (File.Exists(file)) File.Delete(file);
            File.Move(tmp, file);

            if (_publisher != null)
            {
                var lightweight = new { id = block.Id, name = block.Name, blockType = block.BlockType };
                await _publisher.PublishBlockUpdatedAsync(lightweight);
            }

            return;
        }
    }
}
