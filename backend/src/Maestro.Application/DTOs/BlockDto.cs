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
        public bool IsAtomic { get; init; } = true;
        public List<string> Tags { get; init; } = new();
        public List<string> Capabilities { get; init; } = new();
        public Dictionary<string, object?>? Config { get; init; }
        public Dictionary<string, object?>? Metadata { get; init; }
        public DateTime CreatedAt { get; init; }
        public DateTime UpdatedAt { get; init; }
        public string? SourcePath { get; init; }

        // System block properties
        public bool IsSystem { get; init; }
        public string? OverridesBlockId { get; init; }
        public string? Category { get; init; }

        public static BlockDto FromDomain(Domain.Entities.BlockDefinition block, string? sourcePath = null)
        {
            return new BlockDto
            {
                Id = block.Id,
                Name = block.Name,
                BlockType = block.BlockType,
                Description = block.Description,
                Version = block.Version,
                IsAtomic = block.IsAtomic,
                Capabilities = block.Capabilities,
                Config = block.Config != null ? ConvertDictionary(block.Config) : null,
                Metadata = block.Metadata != null ? ConvertDictionary(block.Metadata) : null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                SourcePath = sourcePath ?? block.SourcePath,
                IsSystem = block.IsSystem,
                OverridesBlockId = block.OverridesBlockId,
                Category = block.Category
            };
        }

        /// <summary>
        /// Converts a dictionary potentially containing JsonElements to a dictionary with native values.
        /// </summary>
        private static Dictionary<string, object?> ConvertDictionary(Dictionary<string, object?> source)
        {
            var result = new Dictionary<string, object?>();
            foreach (var kvp in source)
            {
                result[kvp.Key] = ConvertValue(kvp.Value);
            }
            return result;
        }

        /// <summary>
        /// Converts JsonElement values to native .NET types.
        /// </summary>
        private static object? ConvertValue(object? value)
        {
            if (value == null) return null;

            if (value is JsonElement jsonElement)
            {
                return ConvertJsonElement(jsonElement);
            }

            if (value is Dictionary<string, object?> dict)
            {
                return ConvertDictionary(dict);
            }

            return value;
        }

        /// <summary>
        /// Converts a JsonElement to native .NET types.
        /// </summary>
        private static object? ConvertJsonElement(JsonElement element)
        {
            return element.ValueKind switch
            {
                JsonValueKind.Null => null,
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDouble(),
                JsonValueKind.String => element.GetString(),
                JsonValueKind.Array => ConvertJsonArray(element),
                JsonValueKind.Object => ConvertJsonObject(element),
                _ => element.GetRawText()
            };
        }

        private static List<object?> ConvertJsonArray(JsonElement element)
        {
            var list = new List<object?>();
            foreach (var item in element.EnumerateArray())
            {
                list.Add(ConvertJsonElement(item));
            }
            return list;
        }

        private static Dictionary<string, object?> ConvertJsonObject(JsonElement element)
        {
            var dict = new Dictionary<string, object?>();
            foreach (var property in element.EnumerateObject())
            {
                dict[property.Name] = ConvertJsonElement(property.Value);
            }
            return dict;
        }
    }
}
