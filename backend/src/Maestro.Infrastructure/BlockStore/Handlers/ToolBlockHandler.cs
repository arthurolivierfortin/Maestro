using System;
using System.IO;
using System.Text.Json;
using System.Collections.Generic;
using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.BlockStore.Handlers
{
    public class ToolBlockHandler : IBlockTypeHandler
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
            var blockType = root.TryGetProperty("blockType", out var btEl) ? btEl.GetString() : "tool";

            var def = BlockDefinition.Create(id ?? Guid.NewGuid().ToString(), name ?? id ?? "block", blockType ?? "tool");

            var dict = new Dictionary<string, object>();
            if (root.TryGetProperty("config", out var cfg))
            {
                if (cfg.TryGetProperty("scriptFile", out var sf))
                {
                    var scriptPath = Path.Combine(folderPath, sf.GetString() ?? "script.sh");
                    if (File.Exists(scriptPath))
                    {
                        dict["scriptFile"] = sf.GetString()!;
                        dict["script"] = File.ReadAllText(scriptPath);
                    }
                }

                if (cfg.TryGetProperty("schemaFile", out var sch))
                {
                    var schemaPath = Path.Combine(folderPath, sch.GetString() ?? "schema.json");
                    if (File.Exists(schemaPath))
                    {
                        dict["schemaFile"] = sch.GetString()!;
                        dict["schema"] = File.ReadAllText(schemaPath);
                    }
                }
            }

            def.UpdateConfig(dict);

            // Metadata
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
