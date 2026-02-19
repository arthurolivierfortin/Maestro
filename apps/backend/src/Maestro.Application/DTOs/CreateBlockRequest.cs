using System.Collections.Generic;
using System.Text.Json;

namespace Maestro.Application.DTOs
{
    /// <summary>
    /// Request for creating a new block.
    /// </summary>
    public record CreateBlockRequest
    {
        public string Name { get; init; } = string.Empty;
        public string BlockType { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
        public List<string> Tags { get; init; } = new();
        public List<string> Capabilities { get; init; } = new();
        public JsonDocument? Config { get; init; }
        public string? TargetLocation { get; init; } // project/user/global
    }
}
