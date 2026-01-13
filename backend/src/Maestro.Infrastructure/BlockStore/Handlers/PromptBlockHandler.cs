using System.IO;
using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.BlockStore.Handlers
{
    public class PromptBlockHandler : IBlockTypeHandler
    {
        public BlockDefinition? Load(string folderPath)
        {
            var file = Path.Combine(folderPath, "block.json");
            if (!File.Exists(file)) return null;
            // Basic load - domain model should be enriched
            var txt = File.ReadAllText(file);
            // For now reuse discovery parsing in FileSystemBlockDiscoveryService
            return null;
        }
    }
}
