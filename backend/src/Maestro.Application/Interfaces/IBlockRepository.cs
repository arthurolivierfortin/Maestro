using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Domain.Entities;

namespace Maestro.Application.Interfaces
{
    public interface IBlockRepository
    {
        Task<BlockDefinition?> GetByIdAsync(string id, CancellationToken ct = default);
        Task<IEnumerable<BlockDefinition>> GetAllAsync(CancellationToken ct = default);
        Task SaveAsync(BlockDefinition block, CancellationToken ct = default);
        Task SaveAsync(BlockDefinition block, string targetFolder, CancellationToken ct = default);
        Task DeleteAsync(string id, CancellationToken ct = default);
        Task<string?> GetBlockPathAsync(string id, CancellationToken ct = default);
    }
}
