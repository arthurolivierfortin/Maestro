using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.DTOs;

namespace Maestro.Application.Interfaces
{
    /// <summary>
    /// Service for analyzing block dependency trees: manifest extraction,
    /// model requirements, validation, and reverse-dependency lookup.
    /// </summary>
    public interface IBlockDependencyService
    {
        /// <summary>
        /// Recursively extracts the full dependency manifest for a block,
        /// walking config.nodes to resolve blockRefs and inline model overrides.
        /// </summary>
        Task<BlockDependencyManifest> GetManifestAsync(string blockId, CancellationToken ct = default);

        /// <summary>
        /// Returns a flat map of model → list of blockIds that require that model.
        /// Includes both config.model and config.planningModel references.
        /// </summary>
        Task<Dictionary<string, List<string>>> GetRequiredModelsAsync(string blockId, CancellationToken ct = default);

        /// <summary>
        /// Validates a block's dependency tree: checks for missing blocks and circular references.
        /// </summary>
        Task<DependencyValidationResult> ValidateAsync(string blockId, CancellationToken ct = default);

        /// <summary>
        /// Returns the IDs of all blocks that reference the given blockId in their config.nodes.
        /// (Reverse dependency / "who uses this block?")
        /// </summary>
        Task<List<string>> GetDependentsAsync(string blockId, CancellationToken ct = default);
    }
}
