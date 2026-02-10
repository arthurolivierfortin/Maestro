using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Domain.Entities;

namespace Maestro.Application.Interfaces
{
    public interface IBlockDiscoveryService
    {
        Task<IEnumerable<BlockDefinition>> DiscoverAllAsync(CancellationToken ct = default);
        Task<IEnumerable<BlockDefinition>> DiscoverByTypeAsync(string type, CancellationToken ct = default);
        Task<BlockDefinition?> GetByIdAsync(string blockId, CancellationToken ct = default);
        /// <summary>
        /// Resolves a block by ID, also searching additional paths (e.g. session-specific block search paths).
        /// Falls back to the global cache if not found in additional paths.
        /// </summary>
        Task<BlockDefinition?> GetByIdAsync(string blockId, IReadOnlyList<string> additionalSearchPaths, CancellationToken ct = default);
        Task<BlockDefinition?> GetByPathAsync(string folderPath, CancellationToken ct = default);
        Task WatchForChangesAsync(System.Action<BlockChangeEvent> onChange, CancellationToken ct = default);
    }

    public class BlockChangeEvent
    {
        public string BlockId { get; set; } = string.Empty;
        public string Path { get; set; } = string.Empty;
        public BlockChangeType ChangeType { get; set; }
    }

    public enum BlockChangeType
    {
        Added,
        Modified,
        Deleted
    }
}
