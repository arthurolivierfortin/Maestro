using System.Collections.Generic;

namespace Maestro.Application.DTOs
{
    /// <summary>
    /// Recursive dependency-tree node representing a block and its child dependencies.
    /// Named "BlockDependencyManifest" to avoid collision with the publish-time BlockManifest
    /// in Maestro.Application.Interfaces.IBlockPublisher.
    /// </summary>
    public record BlockDependencyManifest(
        string BlockId,
        string BlockType,
        string? Model,
        string? PlanningModel,
        bool IsAtomic,
        List<BlockDependencyManifest> Children
    );

    /// <summary>
    /// Result of validating a block's dependency tree.
    /// </summary>
    public record DependencyValidationResult(
        bool IsValid,
        List<MissingDependency> MissingBlocks,
        List<string> CircularReferences
    );

    /// <summary>
    /// Represents a blockRef that could not be resolved.
    /// </summary>
    public record MissingDependency(
        string BlockRef,
        string ReferencedBy,
        string NodeId
    );
}
