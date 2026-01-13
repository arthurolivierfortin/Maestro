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

        public JsonSchemaBlockValidator()
        {
            // Load schema from repository docs path if present
            var schemaPath = Path.Combine(Directory.GetCurrentDirectory(), "docs", "schemas", "block.schema.json");
            if (!File.Exists(schemaPath)) throw new FileNotFoundException("Block schema not found", schemaPath);

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
    }
}

