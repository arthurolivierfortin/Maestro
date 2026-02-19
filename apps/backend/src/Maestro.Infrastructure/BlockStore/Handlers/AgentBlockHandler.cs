using System;
using System.IO;
using System.Text.Json;
using System.Collections.Generic;
using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.BlockStore.Handlers
{
    public class AgentBlockHandler : IBlockTypeHandler
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
            var blockType = root.TryGetProperty("blockType", out var btEl) ? btEl.GetString() : "agent";

            var def = BlockDefinition.Create(id ?? Guid.NewGuid().ToString(), name ?? id ?? "block", blockType ?? "agent");

            var dict = new Dictionary<string, object>();
            // load system-prompt.md (tools are described IN the system prompt, not in a separate file)
            var promptPath = Path.Combine(folderPath, "system-prompt.md");
            if (File.Exists(promptPath)) dict["systemPrompt"] = File.ReadAllText(promptPath);

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
