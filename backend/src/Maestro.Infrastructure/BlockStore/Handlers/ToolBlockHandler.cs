using System.IO;
using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.BlockStore.Handlers
{
    public class ToolBlockHandler : IBlockTypeHandler
    {
        public BlockDefinition? Load(string folderPath)
        {
            var file = Path.Combine(folderPath, "block.json");
            if (!File.Exists(file)) return null;
            return null;
        }
    }
}
