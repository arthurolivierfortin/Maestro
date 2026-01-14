using System;
using System.Collections.Concurrent;
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
    public class FileSystemBlockDiscoveryService : IBlockDiscoveryService, IDisposable
    {
        private readonly string[] _searchPaths;
        private readonly ConcurrentDictionary<string, BlockDefinition> _cache = new();
        private readonly List<FileSystemWatcher> _watchers = new();

        public FileSystemBlockDiscoveryService(string[] searchPaths)
        {
            _searchPaths = searchPaths ?? Array.Empty<string>();
            InitializeWatchers();
            ScanAll();
        }

        private void InitializeWatchers()
        {
            foreach (var path in _searchPaths)
            {
                if (!Directory.Exists(path)) continue;
                var watcher = new FileSystemWatcher(path)
                {
                    IncludeSubdirectories = true,
                    EnableRaisingEvents = true
                };

                watcher.Changed += OnFileChanged;
                watcher.Created += OnFileChanged;
                watcher.Deleted += OnFileChanged;
                watcher.Renamed += OnRenamed;

                _watchers.Add(watcher);
            }
        }

        private void OnRenamed(object sender, RenamedEventArgs e)
        {
            // Simplified: treat as modified
            OnFileChanged(sender, new FileSystemEventArgs(WatcherChangeTypes.Changed, Path.GetDirectoryName(e.FullPath) ?? string.Empty, Path.GetFileName(e.FullPath)));
        }

        private void OnFileChanged(object sender, FileSystemEventArgs e)
        {
            if (string.IsNullOrEmpty(e.Name) || !e.Name.Equals("block.json", StringComparison.OrdinalIgnoreCase)) return;
            var folder = Path.GetDirectoryName(e.FullPath);
            if (folder == null) return;
            try
            {
                var block = LoadBlockFromFolder(folder);
                if (block != null)
                {
                    _cache[block.Id] = block;
                }
            }
            catch { /* swallow errors for watcher */ }
        }

        private void ScanAll()
        {
            foreach (var basePath in _searchPaths)
            {
                // First scan project-level .maestro folders to allow overrides
                try
                {
                    var projectMaestro = Path.Combine(basePath, ".maestro");
                    if (Directory.Exists(projectMaestro))
                    {
                        foreach (var file in Directory.EnumerateFiles(projectMaestro, "block.json", SearchOption.AllDirectories))
                        {
                            var folder = Path.GetDirectoryName(file);
                            if (folder == null) continue;
                            try
                            {
                                var block = LoadBlockFromFolder(folder);
                                if (block != null)
                                {
                                    _cache[block.Id] = block;
                                }
                            }
                            catch { }
                        }
                    }
                }
                catch { }

                if (!Directory.Exists(basePath)) continue;
                foreach (var file in Directory.EnumerateFiles(basePath, "block.json", SearchOption.AllDirectories))
                {
                    var folder = Path.GetDirectoryName(file);
                    if (folder == null) continue;
                    try
                    {
                        var block = LoadBlockFromFolder(folder);
                        if (block != null)
                        {
                            _cache[block.Id] = block;
                        }
                    }
                    catch { }
                }
            }
        }

        private BlockDefinition? LoadBlockFromFolder(string folder)
        {
            var file = Path.Combine(folder, "block.json");
            if (!File.Exists(file)) return null;
            var txt = File.ReadAllText(file);
            using var doc = JsonDocument.Parse(txt);
            var root = doc.RootElement;
            var id = root.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            id ??= Path.GetFileName(folder);

            var name = root.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : id;
            var blockType = root.TryGetProperty("blockType", out var btEl) ? btEl.GetString() : "unknown";

            var def = BlockDefinition.Create(id ?? Guid.NewGuid().ToString(), name ?? id ?? string.Empty, blockType ?? string.Empty);

            if (root.TryGetProperty("config", out var cfg))
            {
                def.UpdateConfig(JsonSerializer.Deserialize<Dictionary<string, object>>(cfg.GetRawText()) ?? new());
            }

            if (root.TryGetProperty("metadata", out var meta))
            {
                def.UpdateMetadata(JsonSerializer.Deserialize<Dictionary<string, object>>(meta.GetRawText()) ?? new());
            }

            // Try to enrich using a specific handler

            try
            {
                Maestro.Infrastructure.BlockStore.Handlers.IBlockTypeHandler? handler = blockType?.ToLowerInvariant() switch
                {
                    "prompt" => new Maestro.Infrastructure.BlockStore.Handlers.PromptBlockHandler(),
                    "tool" => new Maestro.Infrastructure.BlockStore.Handlers.ToolBlockHandler(),
                    "agent" => new Maestro.Infrastructure.BlockStore.Handlers.AgentBlockHandler(),
                    "workflow" => new Maestro.Infrastructure.BlockStore.Handlers.WorkflowBlockHandler(),
                    _ => null
                };

                var enriched = handler?.Load(folder);
                if (enriched != null) return enriched;
            }
            catch { /* swallow handler errors */ }

            return def;
        }

        public Task<IEnumerable<BlockDefinition>> DiscoverAllAsync(CancellationToken ct = default)
        {
            return Task.FromResult(_cache.Values.AsEnumerable());
        }

        public Task<IEnumerable<BlockDefinition>> DiscoverByTypeAsync(string type, CancellationToken ct = default)
        {
            var matches = _cache.Values.Where(b => string.Equals(b.BlockType, type, StringComparison.OrdinalIgnoreCase));
            return Task.FromResult(matches);
        }

        public Task<BlockDefinition?> GetByIdAsync(string blockId, CancellationToken ct = default)
        {
            _cache.TryGetValue(blockId, out var b);
            return Task.FromResult(b);
        }

        public Task<BlockDefinition?> GetByPathAsync(string folderPath, CancellationToken ct = default)
        {
            try
            {
                var block = LoadBlockFromFolder(folderPath);
                return Task.FromResult(block);
            }
            catch { return Task.FromResult<BlockDefinition?>(null); }
        }

        public Task WatchForChangesAsync(Action<BlockChangeEvent> onChange, CancellationToken ct = default)
        {
            // For now, watcher updates _cache; we do not push events to caller in this simple impl.
            return Task.CompletedTask;
        }

        public void Dispose()
        {
            foreach (var w in _watchers) w.Dispose();
        }
    }
}
