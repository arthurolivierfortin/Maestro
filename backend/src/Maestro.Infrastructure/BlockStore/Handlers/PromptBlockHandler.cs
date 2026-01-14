using System;
using System.IO;
using System.Text.Json;
using System.Collections.Generic;
using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.BlockStore.Handlers
{
    public class PromptBlockHandler : IBlockTypeHandler
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
            var blockType = root.TryGetProperty("blockType", out var btEl) ? btEl.GetString() : "prompt";

            var def = BlockDefinition.Create(id ?? Guid.NewGuid().ToString(), name ?? id ?? "block", blockType ?? "prompt");

            var dict = new Dictionary<string, object>();
            if (root.TryGetProperty("config", out var cfg))
            {
                if (cfg.TryGetProperty("templateFile", out var tf))
                {
                    var templatePath = Path.Combine(folderPath, tf.GetString() ?? "template.md");
                    if (File.Exists(templatePath))
                    {
                        dict["templateFile"] = tf.GetString()!;
                        dict["template"] = File.ReadAllText(templatePath);
                    }
                }
            }

            // Fallback: if template.md exists directly, load it
            var directTemplate = Path.Combine(folderPath, "template.md");
            if (!dict.ContainsKey("template") && File.Exists(directTemplate))
            {
                dict["templateFile"] = "template.md";
                dict["template"] = File.ReadAllText(directTemplate);
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
