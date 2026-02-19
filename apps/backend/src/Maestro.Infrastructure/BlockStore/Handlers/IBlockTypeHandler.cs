using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.BlockStore.Handlers
{
    public interface IBlockTypeHandler
    {
        BlockDefinition? Load(string folderPath);
    }
}
