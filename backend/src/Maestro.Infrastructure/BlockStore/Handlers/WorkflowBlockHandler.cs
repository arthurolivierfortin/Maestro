using System;
using System.IO;
using System.Text.Json;
using System.Collections.Generic;
using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.BlockStore.Handlers
{
    public class WorkflowBlockHandler : IBlockTypeHandler
    {
        public BlockDefinition? Load(string folderPath)
        {
            var file = Path.Combine(folderPath, "block.json");
            if (!File.Exists(file)) return null;

            var txt = File.ReadAllText(file);
            using var doc = JsonDocument.Parse(txt);
            var root = doc.RootElement;

            var id = root.TryGetProperty("id", out var idEl) ? idEl.GetString() : Path.GetFileName(folderPath);
            var name = root.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : id;
            var blockType = root.TryGetProperty("blockType", out var btEl) ? btEl.GetString() : "workflow";

            var def = BlockDefinition.Create(id ?? Guid.NewGuid().ToString(), name ?? id ?? "block", blockType ?? "workflow");

            var dict = new Dictionary<string, object>();
            var nodesPath = Path.Combine(folderPath, "nodes.json");
            if (File.Exists(nodesPath)) dict["nodes"] = JsonSerializer.Deserialize<object>(File.ReadAllText(nodesPath)) ?? new object();

            var connPath = Path.Combine(folderPath, "connections.json");
            if (File.Exists(connPath)) dict["connections"] = JsonSerializer.Deserialize<object>(File.ReadAllText(connPath)) ?? new object();

            def.UpdateConfig(dict);

            var meta = new Dictionary<string, object>();
            if (root.TryGetProperty("metadata", out var m))
            {
                foreach (var p in m.EnumerateObject()) meta[p.Name] = p.Value.ToString();
            }
            def.UpdateMetadata(meta);

            return def;
        }
    }
}
