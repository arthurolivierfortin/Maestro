using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using NJsonSchema;

namespace Maestro.Infrastructure.BlockStore
{
    public class JsonSchemaBlockValidator : IBlockValidator
    {
        private readonly JsonSchema _schema;
        private readonly string _schemaFolder;

        public JsonSchemaBlockValidator()
        {
            // Try to find docs/schemas/block.schema.json by walking upwards from current directory
            var cur = new DirectoryInfo(Directory.GetCurrentDirectory());
            string? found = null;
            for (var i = 0; i < 8 && cur != null; i++)
            {
                var tryPath = Path.Combine(cur.FullName, "docs", "schemas", "block.schema.json");
                if (File.Exists(tryPath))
                {
                    found = Path.Combine(cur.FullName, "docs", "schemas");
                    break;
                }
                cur = cur.Parent;
            }

            if (found == null)
            {
                // As a last resort, look relative to the assembly base directory
                var baseDir = AppContext.BaseDirectory;
                var tryPath = Path.Combine(baseDir, "..", "..", "..", "docs", "schemas", "block.schema.json");
                tryPath = Path.GetFullPath(tryPath);
                if (File.Exists(tryPath)) found = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "docs", "schemas"));
            }

            if (found == null) throw new FileNotFoundException("Block schema not found");

            _schemaFolder = found;
            var schemaPath = Path.Combine(_schemaFolder, "block.schema.json");
            _schema = JsonSchema.FromFileAsync(schemaPath).GetAwaiter().GetResult();
        }

        public async Task<BlockValidationResult> ValidateAsync(string blockJson, CancellationToken ct = default)
        {
            try
            {
                var errors = _schema.Validate(blockJson);
                if (errors == null || !errors.Any()) return new BlockValidationResult { IsValid = true };

                var messages = errors.Select(e => $"{e.Path}: {e.Kind} - {e.ToString()}").ToArray();
                return new BlockValidationResult { IsValid = false, Errors = messages };
            }
            catch (Exception ex)
            {
                return new BlockValidationResult { IsValid = false, Errors = new[] { ex.Message } };
            }
        }

        public async Task<BlockValidationResult> ValidateFolderAsync(string folderPath, CancellationToken ct = default)
        {
            try
            {
                var blockFile = Path.Combine(folderPath, "block.json");
                if (!File.Exists(blockFile)) return new BlockValidationResult { IsValid = false, Errors = new[] { "block.json not found" } };

                var blockJson = await File.ReadAllTextAsync(blockFile, ct);
                var result = await ValidateAsync(blockJson, ct);
                if (!result.IsValid) return result;

                // If this is a workflow block, validate nodes and connections if present
                using var doc = System.Text.Json.JsonDocument.Parse(blockJson);
                var root = doc.RootElement;
                var blockType = root.TryGetProperty("blockType", out var btEl) ? btEl.GetString() : null;
                var errors = new List<string>();

                if (string.Equals(blockType, "workflow", StringComparison.OrdinalIgnoreCase))
                {
                    // nodes.json
                    var nodesPath = Path.Combine(folderPath, "nodes.json");
                    var nodesSchemaPath = Path.Combine(_schemaFolder, "workflow-nodes.schema.json");
                    if (File.Exists(nodesPath) && File.Exists(nodesSchemaPath))
                    {
                        var nodesText = await File.ReadAllTextAsync(nodesPath, ct);
                        var nodesSchema = JsonSchema.FromFileAsync(nodesSchemaPath).GetAwaiter().GetResult();
                        var nErrors = nodesSchema.Validate(nodesText);
                        if (nErrors != null && nErrors.Any()) errors.AddRange(nErrors.Select(e => $"nodes.json: {e.Path}: {e.Kind} - {e.ToString()}"));
                    }

                    // connections.json
                    var connPath = Path.Combine(folderPath, "connections.json");
                    var connSchemaPath = Path.Combine(_schemaFolder, "connections.schema.json");
                    if (File.Exists(connPath) && File.Exists(connSchemaPath))
                    {
                        var connText = await File.ReadAllTextAsync(connPath, ct);
                        var connSchema = JsonSchema.FromFileAsync(connSchemaPath).GetAwaiter().GetResult();
                        var cErrors = connSchema.Validate(connText);
                        if (cErrors != null && cErrors.Any()) errors.AddRange(cErrors.Select(e => $"connections.json: {e.Path}: {e.Kind} - {e.ToString()}"));
                    }
                }

                if (errors.Any()) return new BlockValidationResult { IsValid = false, Errors = errors.ToArray() };
                return new BlockValidationResult { IsValid = true };
            }
            catch (Exception ex)
            {
                return new BlockValidationResult { IsValid = false, Errors = new[] { ex.Message } };
            }
        }
    }
}

