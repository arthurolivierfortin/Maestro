using System.Collections.Generic;
using System.Text.Json;

namespace Maestro.Application.DTOs
{
    /// <summary>
    /// Request for updating an existing block.
    /// </summary>
    public record UpdateBlockRequest
    {
        public string? Name { get; init; }
        public string? Description { get; init; }
        public List<string>? Tags { get; init; }
        public List<string>? Capabilities { get; init; }
        public JsonDocument? Config { get; init; }
        public JsonDocument? Metadata { get; init; }
    }
}
