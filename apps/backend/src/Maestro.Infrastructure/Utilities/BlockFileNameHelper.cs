using System;
using System.IO;

namespace Maestro.Infrastructure.Utilities
{
    /// <summary>
    /// Helper for creating safe block metadata filenames following the convention
    /// {name}.{type}.block.json
    /// </summary>
    public static class BlockFileNameHelper
    {
        public static string CreateFileName(string name, string blockType)
        {
            var safeName = Sanitize(name ?? string.Empty);
            var safeType = Sanitize(blockType ?? string.Empty);
            if (string.IsNullOrWhiteSpace(safeType)) safeType = "unknown";
            if (string.IsNullOrWhiteSpace(safeName)) safeName = "unnamed";
            return $"{safeName}.{safeType}.block.json";
        }

        public static string Sanitize(string input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            var name = input.Trim();
            foreach (var c in Path.GetInvalidFileNameChars())
            {
                name = name.Replace(c, '-');
            }
            // Replace spaces and consecutive dots with hyphens
            name = name.Replace(' ', '-');
            while (name.Contains("..")) name = name.Replace("..", ".");
            name = name.Replace('.', '-');
            return name;
        }
    }
}
