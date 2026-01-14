using System;
using System.IO;
using System.Text.Json;
using System.Collections.Generic;
using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.BlockStore.Handlers
{
    public class InferenceBlockHandler : IBlockTypeHandler
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
            var blockType = root.TryGetProperty("blockType", out var btEl) ? btEl.GetString() : "inference";

            var def = BlockDefinition.Create(id ?? Guid.NewGuid().ToString(), name ?? id ?? "block", blockType ?? "inference");

            var dict = new Dictionary<string, object>();
            // load prompts/ directory if present
            var promptsDir = Path.Combine(folderPath, "prompts");
            if (Directory.Exists(promptsDir))
            {
                var prompts = new Dictionary<string, string>();
                foreach (var f in Directory.GetFiles(promptsDir, "*.md"))
                {
                    prompts[Path.GetFileName(f)] = File.ReadAllText(f);
                }
                dict["prompts"] = prompts;
            }

            // load output schema if present
            var outSchema = Path.Combine(folderPath, "output-schema.json");
            if (File.Exists(outSchema)) dict["outputSchema"] = File.ReadAllText(outSchema);

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
