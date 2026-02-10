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
using Maestro.Infrastructure.Configuration;

namespace Maestro.Infrastructure.BlockStore
{
    public class FileSystemBlockDiscoveryService : IBlockDiscoveryService, IDisposable
    {
        private readonly string[] _searchPaths;
        private readonly ConcurrentDictionary<string, BlockDefinition> _cache = new();
        private readonly ConcurrentDictionary<string, BlockDefinition> _systemBlocksCache = new();
        private readonly ConcurrentDictionary<string, BlockDefinition> _userOverridesCache = new();
        private readonly List<FileSystemWatcher> _watchers = new();
        private readonly IBlockChangePublisher? _changePublisher;

        public FileSystemBlockDiscoveryService(string[] searchPaths, IBlockChangePublisher? changePublisher = null)
        {
            _searchPaths = searchPaths ?? Array.Empty<string>();
            _changePublisher = changePublisher;
            InitializeWatchers();
            ScanAll();
        }

        /// <summary>
        /// Gets all system blocks (before any overrides are applied).
        /// </summary>
        public IEnumerable<BlockDefinition> GetSystemBlocks() => _systemBlocksCache.Values;

        /// <summary>
        /// Gets all user override blocks.
        /// </summary>
        public IEnumerable<BlockDefinition> GetUserOverrides() => _userOverridesCache.Values;

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
            // Only support new *.block.json format
            if (string.IsNullOrEmpty(e.Name)) return;
            
            if (!e.Name.EndsWith(MaestroConstants.BlockFileExtension, StringComparison.OrdinalIgnoreCase))
                return;
            
            try
            {
                var block = LoadBlockFromFile(e.FullPath);
                
                if (block != null)
                {
                    var isNew = !_cache.ContainsKey(block.Id);
                    _cache[block.Id] = block;
                    
                    // Publish SignalR event
                    if (_changePublisher != null)
                    {
                        if (isNew)
                        {
                            _ = _changePublisher.PublishBlockAddedAsync(new { id = block.Id, name = block.Name, blockType = block.BlockType });
                        }
                        else
                        {
                            _ = _changePublisher.PublishBlockUpdatedAsync(new { id = block.Id, name = block.Name, blockType = block.BlockType });
                        }
                    }
                }
                else if (e.ChangeType == WatcherChangeTypes.Deleted)
                {
                    // Block was deleted - extract ID from filename
                    var blockId = ExtractBlockIdFromPath(e.FullPath);
                    if (!string.IsNullOrEmpty(blockId) && _cache.TryRemove(blockId, out _))
                    {
                        if (_changePublisher != null)
                        {
                            _ = _changePublisher.PublishBlockDeletedAsync(blockId);
                        }
                    }
                }
            }
            catch { /* swallow errors for watcher */ }
        }
        
        /// <summary>
        /// Extracts the block ID from a file path.
        /// Format: name.type.block.json -> extracts "name.type" as ID.
        /// </summary>
        private static string? ExtractBlockIdFromPath(string filePath)
        {
            var fileName = Path.GetFileName(filePath);
            
            if (!fileName.EndsWith(MaestroConstants.BlockFileExtension, StringComparison.OrdinalIgnoreCase))
                return null;
            
            // Remove .block.json to get "name.type"
            var withoutBlockJson = fileName.Substring(0, fileName.Length - MaestroConstants.BlockFileExtension.Length);
            // Remove .type to get just the name portion, or keep full if no type
            var parts = withoutBlockJson.Split('.');
            return parts.Length > 1 ? withoutBlockJson : parts[0];
        }

        private void ScanAll()
        {
            // First pass: Load all system blocks
            foreach (var basePath in _searchPaths)
            {
                if (!Directory.Exists(basePath)) continue;

                var systemPath = Path.Combine(basePath, MaestroConstants.SystemBlocksFolderName);
                if (Directory.Exists(systemPath))
                {
                    ScanSystemBlocks(systemPath);
                }
            }

            // Second pass: Load user overrides
            foreach (var basePath in _searchPaths)
            {
                if (!Directory.Exists(basePath)) continue;

                var userPath = Path.Combine(basePath, MaestroConstants.UserOverridesFolderName);
                if (Directory.Exists(userPath))
                {
                    ScanUserOverrides(userPath);
                }
            }

            // Third pass: Load regular blocks (non-system, non-override)
            foreach (var basePath in _searchPaths)
            {
                if (!Directory.Exists(basePath)) continue;

                // Load project config if available (for .maestro folders)
                Dictionary<string, object>? projectConfig = null;
                try
                {
                    var projectConfigPath = Path.Combine(basePath, MaestroConstants.ProjectConfigFileName);
                    if (File.Exists(projectConfigPath))
                    {
                        var cfgTxt = File.ReadAllText(projectConfigPath);
                        projectConfig = JsonSerializer.Deserialize<Dictionary<string, object>>(cfgTxt);
                    }
                }
                catch { /* ignore invalid project config */ }

                // Scan for *.block.json files (excluding system and user folders)
                try
                {
                    foreach (var file in Directory.EnumerateFiles(basePath, MaestroConstants.BlockFileGlobPattern, SearchOption.AllDirectories))
                    {
                        // Skip files in system or user folders
                        if (IsSystemOrUserPath(file, basePath))
                            continue;

                        try
                        {
                            var block = LoadBlockFromFile(file);
                            if (block != null)
                            {
                                AttachProjectConfig(block, projectConfig);
                                _cache[block.Id] = block;
                            }
                        }
                        catch { }
                    }
                }
                catch { }
            }

            // Apply system blocks to cache (with overrides if present)
            ApplySystemBlocksToCache();
        }

        private void ScanSystemBlocks(string systemPath)
        {
            try
            {
                foreach (var file in Directory.EnumerateFiles(systemPath, MaestroConstants.BlockFileGlobPattern, SearchOption.AllDirectories))
                {
                    try
                    {
                        var block = LoadBlockFromFile(file, isSystem: true);
                        if (block != null)
                        {
                            _systemBlocksCache[block.Id] = block;
                        }
                    }
                    catch { }
                }
            }
            catch { }
        }

        private void ScanUserOverrides(string userPath)
        {
            try
            {
                foreach (var file in Directory.EnumerateFiles(userPath, MaestroConstants.BlockFileGlobPattern, SearchOption.AllDirectories))
                {
                    try
                    {
                        var block = LoadBlockFromFile(file, isSystem: false);
                        if (block != null)
                        {
                            // Check if this overrides a system block
                            var systemBlockId = GetOverriddenSystemBlockId(block);
                            if (!string.IsNullOrEmpty(systemBlockId))
                            {
                                block.SetOverridesSystemBlock(systemBlockId);
                            }
                            _userOverridesCache[block.Id] = block;
                        }
                    }
                    catch { }
                }
            }
            catch { }
        }

        private string? GetOverriddenSystemBlockId(BlockDefinition block)
        {
            // Check metadata for explicit override reference
            if (block.Metadata.TryGetValue("overridesSystemBlock", out var overrideId) && overrideId is string sId)
            {
                return sId;
            }

            // Check if block ID matches a system block pattern (system:xyz)
            if (_systemBlocksCache.ContainsKey(block.Id))
            {
                return block.Id;
            }

            // Check if ID without "system:" prefix matches a system block
            if (block.Id.StartsWith("system:", StringComparison.OrdinalIgnoreCase))
            {
                return block.Id;
            }

            return null;
        }

        private void ApplySystemBlocksToCache()
        {
            // Add system blocks to main cache
            foreach (var systemBlock in _systemBlocksCache.Values)
            {
                // Check if there's an override
                var overrideBlock = _userOverridesCache.Values
                    .FirstOrDefault(u => u.OverridesSystemBlock == systemBlock.Id);

                if (overrideBlock != null && systemBlock.Overridable)
                {
                    // Use the merged block (user config takes precedence)
                    var mergedBlock = MergeBlocks(systemBlock, overrideBlock);
                    _cache[systemBlock.Id] = mergedBlock;
                }
                else
                {
                    // Use system block as-is
                    _cache[systemBlock.Id] = systemBlock;
                }
            }
        }

        private BlockDefinition MergeBlocks(BlockDefinition systemBlock, BlockDefinition userOverride)
        {
            // Create a new block with system block as base, override with user values
            var merged = BlockDefinition.Create(
                systemBlock.Id,
                string.IsNullOrEmpty(userOverride.Name) ? systemBlock.Name : userOverride.Name,
                systemBlock.BlockType
            );

            merged.SetIsAtomic(systemBlock.IsAtomic);
            merged.SetIsSystem(true); // Still a system block, just overridden
            merged.SetOverridable(systemBlock.Overridable);
            merged.SetOverridesSystemBlock(null); // This is the merged result, not an override itself
            merged.SetDescription(string.IsNullOrEmpty(userOverride.Description) ? systemBlock.Description : userOverride.Description);
            merged.SetVersion(string.IsNullOrEmpty(userOverride.Version) ? systemBlock.Version : userOverride.Version);

            // Merge config (user takes precedence)
            var mergedConfig = new Dictionary<string, object>(systemBlock.Config ?? new());
            foreach (var kv in userOverride.Config ?? new())
            {
                mergedConfig[kv.Key] = kv.Value;
            }
            merged.UpdateConfig(mergedConfig);

            // Merge metadata
            var mergedMeta = new Dictionary<string, object>(systemBlock.Metadata ?? new());
            foreach (var kv in userOverride.Metadata ?? new())
            {
                mergedMeta[kv.Key] = kv.Value;
            }
            mergedMeta["_isOverridden"] = true;
            mergedMeta["_overrideSource"] = userOverride.Metadata?.GetValueOrDefault("_sourcePath") ?? "";
            merged.UpdateMetadata(mergedMeta);

            // Merge capabilities
            var allCaps = systemBlock.Capabilities.ToList();
            foreach (var cap in userOverride.Capabilities ?? new())
            {
                if (!allCaps.Contains(cap))
                    allCaps.Add(cap);
            }
            merged.AddCapabilities(allCaps);

            return merged;
        }

        private bool IsSystemOrUserPath(string filePath, string basePath)
        {
            var relativePath = Path.GetRelativePath(basePath, filePath);
            return relativePath.StartsWith(MaestroConstants.SystemBlocksFolderName + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
                || relativePath.StartsWith(MaestroConstants.SystemBlocksFolderName + "/", StringComparison.OrdinalIgnoreCase)
                || relativePath.StartsWith(MaestroConstants.UserOverridesFolderName + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
                || relativePath.StartsWith(MaestroConstants.UserOverridesFolderName + "/", StringComparison.OrdinalIgnoreCase);
        }
        
        private static void AttachProjectConfig(BlockDefinition block, Dictionary<string, object>? projectConfig)
        {
            if (projectConfig == null) return;
            
            var meta = new Dictionary<string, object>(block.Metadata ?? new Dictionary<string, object>());
            meta["projectConfig"] = projectConfig;
            block.UpdateMetadata(meta);
        }
        
        /// <summary>
        /// Loads a block from a flat file (new format: name.type.block.json).
        /// </summary>
        private BlockDefinition? LoadBlockFromFile(string filePath, bool isSystem = false)
        {
            if (!File.Exists(filePath)) return null;

            var txt = File.ReadAllText(filePath);
            using var doc = JsonDocument.Parse(txt);
            var root = doc.RootElement;

            // Get ID from file content, or derive from filename
            var id = root.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            var fileName = Path.GetFileName(filePath);

            // Parse name.type.block.json -> name = first part
            if (string.IsNullOrEmpty(id))
            {
                // Remove .block.json extension twice to get "name.type"
                var nameWithType = Path.GetFileNameWithoutExtension(Path.GetFileNameWithoutExtension(fileName));
                id = nameWithType; // Use full "name.type" as fallback ID
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
                // Default isAtomic based on block type if not specified
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

            // Load system block properties
            if (root.TryGetProperty("isSystem", out var isSysEl))
            {
                def.SetIsSystem(isSysEl.GetBoolean());
            }
            else
            {
                // Set based on parameter (determined by which folder the file is in)
                def.SetIsSystem(isSystem);
            }

            if (root.TryGetProperty("overridable", out var overridableEl))
            {
                def.SetOverridable(overridableEl.GetBoolean());
            }

            if (root.TryGetProperty("overridesSystemBlock", out var overridesEl) && overridesEl.ValueKind == JsonValueKind.String)
            {
                def.SetOverridesSystemBlock(overridesEl.GetString());
            }

            // Load capabilities
            if (root.TryGetProperty("capabilities", out var capsEl) && capsEl.ValueKind == JsonValueKind.Array)
            {
                var caps = new List<string>();
                foreach (var cap in capsEl.EnumerateArray())
                {
                    if (cap.ValueKind == JsonValueKind.String)
                    {
                        caps.Add(cap.GetString() ?? string.Empty);
                    }
                }
                def.AddCapabilities(caps);
            }

            if (root.TryGetProperty("config", out var cfg))
            {
                def.UpdateConfig(JsonSerializer.Deserialize<Dictionary<string, object>>(cfg.GetRawText()) ?? new());
            }

            if (root.TryGetProperty("metadata", out var meta))
            {
                def.UpdateMetadata(JsonSerializer.Deserialize<Dictionary<string, object>>(meta.GetRawText()) ?? new());
            }

            // Store the source file path in metadata for reference
            var blockMeta = new Dictionary<string, object>(def.Metadata ?? new Dictionary<string, object>());
            blockMeta["_sourcePath"] = filePath;
            def.UpdateMetadata(blockMeta);

            // Try to enrich using a specific handler
            try
            {
                var folder = Path.GetDirectoryName(filePath);
                if (folder != null)
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
                    if (enriched != null)
                    {
                        // Preserve system block properties on enriched block
                        enriched.SetIsSystem(def.IsSystem);
                        enriched.SetOverridable(def.Overridable);
                        if (!string.IsNullOrEmpty(def.OverridesSystemBlock))
                        {
                            enriched.SetOverridesSystemBlock(def.OverridesSystemBlock);
                        }
                        return enriched;
                    }
                }
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

        public Task<BlockDefinition?> GetByIdAsync(string blockId, IReadOnlyList<string> additionalSearchPaths, CancellationToken ct = default)
        {
            // First check global cache
            if (_cache.TryGetValue(blockId, out var cached))
                return Task.FromResult<BlockDefinition?>(cached);

            // Search additional paths on-demand
            if (additionalSearchPaths == null || additionalSearchPaths.Count == 0)
                return Task.FromResult<BlockDefinition?>(null);

            foreach (var searchPath in additionalSearchPaths)
            {
                if (!Directory.Exists(searchPath)) continue;

                try
                {
                    foreach (var file in Directory.EnumerateFiles(searchPath, MaestroConstants.BlockFileGlobPattern, SearchOption.AllDirectories))
                    {
                        try
                        {
                            var block = LoadBlockFromFile(file);
                            if (block != null && string.Equals(block.Id, blockId, StringComparison.OrdinalIgnoreCase))
                            {
                                // Cache for future lookups
                                _cache[block.Id] = block;
                                return Task.FromResult<BlockDefinition?>(block);
                            }
                        }
                        catch { /* skip invalid files */ }
                    }
                }
                catch { /* skip inaccessible paths */ }
            }

            return Task.FromResult<BlockDefinition?>(null);
        }

        public Task<BlockDefinition?> GetByPathAsync(string filePath, CancellationToken ct = default)
        {
            try
            {
                var block = LoadBlockFromFile(filePath);
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
