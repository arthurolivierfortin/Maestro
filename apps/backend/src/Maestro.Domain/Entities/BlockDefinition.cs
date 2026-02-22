using System;
using System.Collections.Generic;
using System.Text.Json;
using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities
{
    public class BlockDefinition
    {
        public string Id { get; private set; }
        public string Name { get; private set; }
        public string BlockType { get; private set; }
        public string Version { get; private set; }
        public bool IsAtomic { get; private set; }
        public string Description { get; private set; }
        public Dictionary<string, object> Config { get; private set; } = new();
        public Dictionary<string, object> Metadata { get; private set; } = new();
        public List<string> Capabilities { get; private set; } = new();

        /// <summary>
        /// Indicates whether this is a system block (provided by Maestro).
        /// System blocks are loaded from the blocks/system directory.
        /// </summary>
        public bool IsSystem { get; private set; }

        /// <summary>
        /// Indicates whether this system block can be overridden by user blocks.
        /// Only applicable when IsSystem is true.
        /// </summary>
        public bool Overridable { get; private set; } = true;

        /// <summary>
        /// If this block is a user override of a system block, this holds the original system block ID.
        /// </summary>
        public string? OverridesSystemBlock { get; private set; }

        // ── Computed properties from Metadata ──

        /// <summary>
        /// Functional designation: "agent", "tool", or null (regular block).
        /// A block designated as "agent" is an enriched inference block.
        /// A block designated as "tool" is a promoted tool with I/O schema.
        /// </summary>
        public string? Designation => GetMetadataString("designation");

        /// <summary>
        /// Functional category for grouping (git, code, analysis, etc.).
        /// </summary>
        public string? Category => GetMetadataString("category");

        /// <summary>
        /// Author/creator of the block.
        /// </summary>
        public string? Author => GetMetadataString("author");

        /// <summary>
        /// Tags for search and filtering. Extracted from metadata.
        /// </summary>
        public List<string>? Tags => GetMetadataList("tags");

        /// <summary>
        /// Documentation companion files. Maps doc names to relative paths.
        /// Extracted from metadata["docs"]. Example: {"readme": "docs/README.md", "research": "docs/RESEARCH.md"}
        /// </summary>
        public Dictionary<string, string>? Docs => GetMetadataDocs("docs");

        private BlockDefinition() { }

        public static BlockDefinition Create(string id, string name, string blockType)
        {
            if (string.IsNullOrWhiteSpace(id)) throw new ArgumentException("id");
            if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("name");
            if (string.IsNullOrWhiteSpace(blockType)) throw new ArgumentException("blockType");

            return new BlockDefinition
            {
                Id = id,
                Name = name,
                BlockType = blockType,
                Version = "1.0.0",
                IsAtomic = true,
                IsSystem = false,
                Overridable = true
            };
        }

        public static BlockDefinition CreateSystem(string id, string name, string blockType, bool overridable = true)
        {
            var block = Create(id, name, blockType);
            block.IsSystem = true;
            block.Overridable = overridable;
            return block;
        }

        public void UpdateMetadata(Dictionary<string, object> metadata)
        {
            Metadata = metadata ?? new();
        }

        public void UpdateConfig(Dictionary<string, object> config)
        {
            Config = config ?? new();
        }

        public void SetIsAtomic(bool isAtomic)
        {
            IsAtomic = isAtomic;
        }

        public void SetDescription(string description)
        {
            Description = description ?? string.Empty;
        }

        public void SetVersion(string version)
        {
            Version = version ?? "1.0.0";
        }

        public void AddCapabilities(IEnumerable<string> capabilities)
        {
            if (capabilities != null)
            {
                Capabilities.AddRange(capabilities);
            }
        }

        public void SetIsSystem(bool isSystem)
        {
            IsSystem = isSystem;
        }

        public void SetOverridable(bool overridable)
        {
            Overridable = overridable;
        }

        public void SetOverridesSystemBlock(string? systemBlockId)
        {
            OverridesSystemBlock = systemBlockId;
        }

        // ── Designation & Category setters ──

        public void SetDesignation(string? designation)
        {
            SetMetadataValue("designation", designation);
        }

        public void SetCategory(string? category)
        {
            SetMetadataValue("category", category);
        }

        public void SetAuthor(string? author)
        {
            SetMetadataValue("author", author);
        }

        public void SetTags(List<string>? tags)
        {
            if (tags != null)
                Metadata["tags"] = tags;
            else
                Metadata.Remove("tags");
        }

        public void SetDocs(Dictionary<string, string>? docs)
        {
            if (docs != null && docs.Count > 0)
                Metadata["docs"] = docs;
            else
                Metadata.Remove("docs");
        }

        // ── Metrics ──

        /// <summary>
        /// Get aggregated metrics from metadata, or null if none recorded.
        /// </summary>
        public AggregatedBlockMetrics? GetAggregatedMetrics()
        {
            if (!Metadata.ContainsKey("metrics")) return null;

            var raw = Metadata["metrics"];

            if (raw is AggregatedBlockMetrics metrics)
                return metrics;

            // Handle deserialized JSON (comes as JsonElement from file)
            if (raw is JsonElement jsonEl)
            {
                try
                {
                    return JsonSerializer.Deserialize<AggregatedBlockMetrics>(
                        jsonEl.GetRawText(),
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                }
                catch
                {
                    return null;
                }
            }

            return null;
        }

        /// <summary>
        /// Set aggregated metrics in metadata.
        /// </summary>
        public void SetAggregatedMetrics(AggregatedBlockMetrics metrics)
        {
            Metadata["metrics"] = metrics;
        }

        /// <summary>
        /// Record a run and update aggregated metrics.
        /// Creates metrics if none exist yet.
        /// </summary>
        public void RecordRun(bool success, long executionTimeMs, int tokenCost, double score)
        {
            var metrics = GetAggregatedMetrics() ?? new AggregatedBlockMetrics();
            metrics.RecordRun(success, executionTimeMs, tokenCost, score);
            SetAggregatedMetrics(metrics);
        }

        // ── Private helpers ──

        private string? GetMetadataString(string key)
        {
            if (!Metadata.ContainsKey(key)) return null;
            var val = Metadata[key];
            if (val is string s) return s;
            if (val is JsonElement je && je.ValueKind == JsonValueKind.String) return je.GetString();
            return val?.ToString();
        }

        private List<string>? GetMetadataList(string key)
        {
            if (!Metadata.ContainsKey(key)) return null;
            var val = Metadata[key];
            if (val is List<string> list) return list;
            if (val is JsonElement je && je.ValueKind == JsonValueKind.Array)
            {
                var result = new List<string>();
                foreach (var item in je.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.String)
                        result.Add(item.GetString()!);
                }
                return result;
            }
            if (val is List<object> objList)
            {
                var result = new List<string>();
                foreach (var item in objList)
                {
                    if (item is string str) result.Add(str);
                    else if (item is JsonElement itemJe && itemJe.ValueKind == JsonValueKind.String)
                        result.Add(itemJe.GetString()!);
                    else if (item != null) result.Add(item.ToString()!);
                }
                return result;
            }
            return null;
        }

        private Dictionary<string, string>? GetMetadataDocs(string key)
        {
            if (!Metadata.ContainsKey(key)) return null;
            var val = Metadata[key];

            if (val is Dictionary<string, string> dict) return dict;

            if (val is Dictionary<string, object> objDict)
            {
                var result = new Dictionary<string, string>();
                foreach (var kvp in objDict)
                {
                    if (kvp.Value is string s) result[kvp.Key] = s;
                    else if (kvp.Value != null) result[kvp.Key] = kvp.Value.ToString()!;
                }
                return result.Count > 0 ? result : null;
            }

            if (val is JsonElement je && je.ValueKind == JsonValueKind.Object)
            {
                var result = new Dictionary<string, string>();
                foreach (var prop in je.EnumerateObject())
                {
                    if (prop.Value.ValueKind == JsonValueKind.String)
                        result[prop.Name] = prop.Value.GetString()!;
                }
                return result.Count > 0 ? result : null;
            }

            return null;
        }

        private void SetMetadataValue(string key, object? value)
        {
            if (value != null)
                Metadata[key] = value;
            else
                Metadata.Remove(key);
        }
    }
}
