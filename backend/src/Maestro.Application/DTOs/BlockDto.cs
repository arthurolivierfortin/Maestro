using System;
using System.Collections.Generic;
using System.Text.Json;

namespace Maestro.Application.DTOs
{
    /// <summary>
    /// Data Transfer Object for Block Definition.
    /// Used for API responses.
    /// </summary>
    public record BlockDto
    {
        public string Id { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string BlockType { get; init; } = string.Empty;
        public string Description { get; init; } = string.Empty;
        public string Version { get; init; } = "1.0.0";
        public List<string> Tags { get; init; } = new();
        public List<string> Capabilities { get; init; } = new();
        public JsonDocument? Config { get; init; }
        public JsonDocument? Metadata { get; init; }
        public DateTime CreatedAt { get; init; }
        public DateTime UpdatedAt { get; init; }
        public string? SourcePath { get; init; }

        public static BlockDto FromDomain(Domain.Entities.BlockDefinition block, string? sourcePath = null)
        {
            return new BlockDto
            {
                Id = block.Id,
                Name = block.Name,
                BlockType = block.BlockType,
                Description = block.Description,
                Version = block.Version,
                Capabilities = block.Capabilities,
                Config = block.Config != null ? JsonDocument.Parse(JsonSerializer.Serialize(block.Config)) : null,
                Metadata = block.Metadata != null ? JsonDocument.Parse(JsonSerializer.Serialize(block.Metadata)) : null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                SourcePath = sourcePath
            };
        }
    }
}
