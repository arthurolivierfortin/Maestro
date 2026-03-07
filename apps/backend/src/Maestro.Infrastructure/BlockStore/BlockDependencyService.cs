using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.BlockStore
{
    /// <summary>
    /// Walks the block dependency tree (config.nodes / blockRef) to produce manifests,
    /// model maps, validation results, and reverse-dependency lookups.
    /// Ported from adapt-optimize.ts extractManifest().
    /// </summary>
    public class BlockDependencyService : IBlockDependencyService
    {
        private readonly IBlockDiscoveryService _discovery;

        public BlockDependencyService(IBlockDiscoveryService discovery)
        {
            _discovery = discovery ?? throw new ArgumentNullException(nameof(discovery));
        }

        // ── GetManifestAsync ──────────────────────────────────────────

        public async Task<BlockDependencyManifest> GetManifestAsync(string blockId, CancellationToken ct = default)
        {
            var visited = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            return await ExtractManifestAsync(blockId, visited, ct);
        }

        /// <summary>
        /// Recursively walks config.nodes to build the manifest tree.
        /// Mirrors the TypeScript extractManifest() from adapt-optimize.ts.
        /// </summary>
        private async Task<BlockDependencyManifest> ExtractManifestAsync(
            string blockId,
            HashSet<string> visited,
            CancellationToken ct)
        {
            // Cycle detection — return a stub if we've seen this block already
            if (visited.Contains(blockId))
            {
                return new BlockDependencyManifest(blockId, "circular-ref", null, null, true, new List<BlockDependencyManifest>());
            }

            visited.Add(blockId);

            var block = await _discovery.GetByIdAsync(blockId, ct);
            if (block == null)
            {
                // Unresolved block — DON'T throw, return stub with BlockType = "unresolved"
                return new BlockDependencyManifest(blockId, "unresolved", null, null, true, new List<BlockDependencyManifest>());
            }

            // Extract top-level model / planningModel from config
            string? model = GetConfigString(block.Config, "model");
            string? planningModel = GetConfigString(block.Config, "planningModel");

            var children = new List<BlockDependencyManifest>();

            // Walk config.nodes (composite blocks: agents, workflows, tools)
            if (block.Config != null && block.Config.TryGetValue("nodes", out var nodesObj))
            {
                var nodeElements = GetJsonElementArray(nodesObj);
                if (nodeElements != null)
                {
                    foreach (var node in nodeElements)
                    {
                        await WalkNodeAsync(node, blockId, children, visited, ct);
                    }
                }
            }

            return new BlockDependencyManifest(
                blockId,
                block.BlockType ?? "unknown",
                model,
                planningModel,
                block.IsAtomic,
                children
            );
        }

        /// <summary>
        /// Walks a single node element, extracting inline model overrides, blockRefs,
        /// and recursing into nested structures (nodes, then, else).
        /// </summary>
        private async Task WalkNodeAsync(
            JsonElement node,
            string parentBlockId,
            List<BlockDependencyManifest> children,
            HashSet<string> visited,
            CancellationToken ct)
        {
            var nodeId = GetStringProperty(node, "id");
            var blockRef = GetStringProperty(node, "blockRef");

            // Check for inline model override in node.config
            if (node.TryGetProperty("config", out var nodeConfig) && nodeConfig.ValueKind == JsonValueKind.Object)
            {
                var nodeModel = GetStringProperty(nodeConfig, "model");
                var nodePlanningModel = GetStringProperty(nodeConfig, "planningModel");

                if (nodeModel != null || nodePlanningModel != null)
                {
                    children.Add(new BlockDependencyManifest(
                        blockRef ?? nodeId ?? "inline",
                        "node",
                        nodeModel,
                        nodePlanningModel,
                        true,
                        new List<BlockDependencyManifest>()
                    ));
                }
            }

            // Recurse into blockRef
            if (!string.IsNullOrEmpty(blockRef) && !visited.Contains(blockRef))
            {
                var normalizedRef = NormalizeBlockRef(blockRef);
                if (!visited.Contains(normalizedRef))
                {
                    children.Add(await ExtractManifestAsync(normalizedRef, visited, ct));
                }
            }

            // Recurse into nested nodes (while body, for-each body)
            if (node.TryGetProperty("nodes", out var subNodes) && subNodes.ValueKind == JsonValueKind.Array)
            {
                foreach (var subNode in subNodes.EnumerateArray())
                {
                    await WalkNodeAsync(subNode, parentBlockId, children, visited, ct);
                }
            }

            // Handle then/else at node level (conditional branches)
            await WalkBranchAsync(node, "then", parentBlockId, children, visited, ct);
            await WalkBranchAsync(node, "else", parentBlockId, children, visited, ct);
        }

        /// <summary>
        /// Walks a conditional branch (then/else). A branch can be:
        /// - An object with a blockRef directly
        /// - An object with a .nodes array
        /// </summary>
        private async Task WalkBranchAsync(
            JsonElement parent,
            string branchName,
            string parentBlockId,
            List<BlockDependencyManifest> children,
            HashSet<string> visited,
            CancellationToken ct)
        {
            if (!parent.TryGetProperty(branchName, out var branch))
                return;

            if (branch.ValueKind == JsonValueKind.Object)
            {
                // Direct blockRef on the branch
                var branchBlockRef = GetStringProperty(branch, "blockRef");
                if (!string.IsNullOrEmpty(branchBlockRef))
                {
                    var normalizedRef = NormalizeBlockRef(branchBlockRef);
                    if (!visited.Contains(normalizedRef))
                    {
                        children.Add(await ExtractManifestAsync(normalizedRef, visited, ct));
                    }
                }

                // Nested nodes within the branch
                if (branch.TryGetProperty("nodes", out var branchNodes) && branchNodes.ValueKind == JsonValueKind.Array)
                {
                    foreach (var branchNode in branchNodes.EnumerateArray())
                    {
                        await WalkNodeAsync(branchNode, parentBlockId, children, visited, ct);
                    }
                }
            }
        }

        // ── GetRequiredModelsAsync ────────────────────────────────────

        public async Task<Dictionary<string, List<string>>> GetRequiredModelsAsync(string blockId, CancellationToken ct = default)
        {
            var manifest = await GetManifestAsync(blockId, ct);
            var map = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
            FlattenModels(manifest, map);
            return map;
        }

        /// <summary>
        /// Recursively collects model → [blockIds] from the manifest tree.
        /// Mirrors flattenModels() from adapt-optimize.ts.
        /// </summary>
        private static void FlattenModels(BlockDependencyManifest manifest, Dictionary<string, List<string>> map)
        {
            if (!string.IsNullOrEmpty(manifest.Model))
            {
                if (!map.TryGetValue(manifest.Model, out var list))
                {
                    list = new List<string>();
                    map[manifest.Model] = list;
                }
                if (!list.Contains(manifest.BlockId))
                    list.Add(manifest.BlockId);
            }

            if (!string.IsNullOrEmpty(manifest.PlanningModel))
            {
                if (!map.TryGetValue(manifest.PlanningModel, out var list))
                {
                    list = new List<string>();
                    map[manifest.PlanningModel] = list;
                }
                var planningLabel = manifest.BlockId + " (planning)";
                if (!list.Contains(planningLabel))
                    list.Add(planningLabel);
            }

            foreach (var child in manifest.Children)
            {
                FlattenModels(child, map);
            }
        }

        // ── ValidateAsync ─────────────────────────────────────────────

        public async Task<DependencyValidationResult> ValidateAsync(string blockId, CancellationToken ct = default)
        {
            var manifest = await GetManifestAsync(blockId, ct);
            var missingBlocks = new List<MissingDependency>();
            var circularRefs = new List<string>();

            CollectValidationIssues(manifest, blockId, "root", missingBlocks, circularRefs);

            return new DependencyValidationResult(
                IsValid: missingBlocks.Count == 0 && circularRefs.Count == 0,
                MissingBlocks: missingBlocks,
                CircularReferences: circularRefs
            );
        }

        /// <summary>
        /// Walks the already-built manifest tree and collects nodes marked
        /// "unresolved" (missing blocks) or "circular-ref" (cycles).
        /// </summary>
        private static void CollectValidationIssues(
            BlockDependencyManifest manifest,
            string parentBlockId,
            string nodeId,
            List<MissingDependency> missingBlocks,
            List<string> circularRefs)
        {
            if (manifest.BlockType == "unresolved")
            {
                missingBlocks.Add(new MissingDependency(
                    BlockRef: manifest.BlockId,
                    ReferencedBy: parentBlockId,
                    NodeId: nodeId
                ));
            }

            if (manifest.BlockType == "circular-ref")
            {
                var refLabel = $"{parentBlockId} -> {manifest.BlockId}";
                if (!circularRefs.Contains(refLabel))
                    circularRefs.Add(refLabel);
            }

            foreach (var child in manifest.Children)
            {
                CollectValidationIssues(child, manifest.BlockId, child.BlockId, missingBlocks, circularRefs);
            }
        }

        // ── GetDependentsAsync ────────────────────────────────────────

        public async Task<List<string>> GetDependentsAsync(string blockId, CancellationToken ct = default)
        {
            var allBlocks = await _discovery.DiscoverAllAsync(ct);
            var dependents = new List<string>();

            foreach (var block in allBlocks)
            {
                // Only check composite blocks (those with config.nodes)
                if (block.Config == null || !block.Config.TryGetValue("nodes", out var nodesObj))
                    continue;

                var nodeElements = GetJsonElementArray(nodesObj);
                if (nodeElements == null)
                    continue;

                if (NodesReferenceBlock(nodeElements, blockId))
                {
                    if (!dependents.Contains(block.Id))
                        dependents.Add(block.Id);
                }
            }

            return dependents;
        }

        /// <summary>
        /// Checks whether any node in the array references the given blockId.
        /// Only checks first-level nodes (direct children), not recursively.
        /// </summary>
        private static bool NodesReferenceBlock(IEnumerable<JsonElement> nodes, string targetBlockId)
        {
            foreach (var node in nodes)
            {
                var blockRef = GetStringProperty(node, "blockRef");
                if (!string.IsNullOrEmpty(blockRef))
                {
                    var normalizedRef = NormalizeBlockRef(blockRef);
                    if (string.Equals(normalizedRef, targetBlockId, StringComparison.OrdinalIgnoreCase))
                        return true;
                }
            }
            return false;
        }

        // ── Helpers ───────────────────────────────────────────────────

        /// <summary>
        /// Extracts a string value from a config dictionary. Handles both string and JsonElement values.
        /// </summary>
        private static string? GetConfigString(Dictionary<string, object>? config, string key)
        {
            if (config == null) return null;
            if (!config.TryGetValue(key, out var value)) return null;

            if (value is string s) return s;
            if (value is JsonElement je && je.ValueKind == JsonValueKind.String) return je.GetString();
            return null;
        }

        /// <summary>
        /// Extracts a string property from a JsonElement object.
        /// </summary>
        private static string? GetStringProperty(JsonElement element, string propertyName)
        {
            if (element.ValueKind != JsonValueKind.Object) return null;
            if (!element.TryGetProperty(propertyName, out var prop)) return null;
            if (prop.ValueKind == JsonValueKind.String) return prop.GetString();
            return null;
        }

        /// <summary>
        /// Converts a config dictionary value to an enumerable of JsonElement (config.nodes).
        /// Handles the fact that config values can be JsonElement objects.
        /// </summary>
        private static IEnumerable<JsonElement>? GetJsonElementArray(object? value)
        {
            if (value is JsonElement je && je.ValueKind == JsonValueKind.Array)
                return je.EnumerateArray().ToList(); // materialize to avoid enumeration issues

            return null;
        }

        /// <summary>
        /// Normalizes a blockRef (e.g. "category/block-id" → "block-id").
        /// Matches the pattern used in BlocksController.GetBlockChildrenAsync.
        /// </summary>
        private static string NormalizeBlockRef(string blockRef)
        {
            if (blockRef.Contains('/'))
                return blockRef.Split('/').Last();
            return blockRef;
        }
    }
}
