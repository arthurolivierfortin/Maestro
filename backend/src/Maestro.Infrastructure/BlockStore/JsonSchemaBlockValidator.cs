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

                        // Additional validation: ensure connections reference valid node ids and ports
                        try
                        {
                            using var connDoc = System.Text.Json.JsonDocument.Parse(connText);
                            var connRoot = connDoc.RootElement;
                            var connections = connRoot.TryGetProperty("connections", out var conns) ? conns.EnumerateArray() : Enumerable.Empty<System.Text.Json.JsonElement>().GetEnumerator();

                            // load nodes to know available ids and ports
                            HashSet<string> nodeIds = new();
                            Dictionary<string, HashSet<string>> nodePorts = new();
                            if (File.Exists(nodesPath))
                            {
                                var nodesText2 = await File.ReadAllTextAsync(nodesPath, ct);
                                using var nDoc = System.Text.Json.JsonDocument.Parse(nodesText2);
                                var nRoot = nDoc.RootElement;
                                if (nRoot.TryGetProperty("nodes", out var nodesArr))
                                {
                                    foreach (var n in nodesArr.EnumerateArray())
                                    {
                                        if (n.TryGetProperty("id", out var nidEl))
                                        {
                                            var nid = nidEl.GetString();
                                            if (!string.IsNullOrEmpty(nid))
                                            {
                                                nodeIds.Add(nid);
                                                var ports = new HashSet<string>();
                                                if (n.TryGetProperty("ports", out var portsEl) && portsEl.ValueKind == System.Text.Json.JsonValueKind.Array)
                                                {
                                                    foreach (var p in portsEl.EnumerateArray())
                                                    {
                                                        if (p.TryGetProperty("id", out var pidEl))
                                                        {
                                                            var pid = pidEl.GetString();
                                                            if (!string.IsNullOrEmpty(pid)) ports.Add(pid);
                                                        }
                                                    }
                                                }
                                                nodePorts[nid] = ports;
                                            }
                                        }
                                    }
                                }
                            }

                            if (connections.MoveNext())
                            {
                                do
                                {
                                    var c = connections.Current;
                                    if (c.TryGetProperty("from", out var from) && c.TryGetProperty("to", out var to))
                                    {
                                        var fromNode = from.GetProperty("nodeId").GetString();
                                        var fromPort = from.GetProperty("portId").GetString();
                                        var toNode = to.GetProperty("nodeId").GetString();
                                        var toPort = to.GetProperty("portId").GetString();

                                        if (string.IsNullOrEmpty(fromNode) || !nodeIds.Contains(fromNode)) errors.Add($"connections.json: unknown from.nodeId '{fromNode}'");
                                        if (string.IsNullOrEmpty(toNode) || !nodeIds.Contains(toNode)) errors.Add($"connections.json: unknown to.nodeId '{toNode}'");

                                        if (!string.IsNullOrEmpty(fromNode) && !string.IsNullOrEmpty(fromPort))
                                        {
                                            if (!nodePorts.TryGetValue(fromNode, out var fpSet) || !fpSet.Contains(fromPort)) errors.Add($"connections.json: unknown from.portId '{fromPort}' for node '{fromNode}'");
                                        }
                                        if (!string.IsNullOrEmpty(toNode) && !string.IsNullOrEmpty(toPort))
                                        {
                                            if (!nodePorts.TryGetValue(toNode, out var tpSet) || !tpSet.Contains(toPort)) errors.Add($"connections.json: unknown to.portId '{toPort}' for node '{toNode}'");
                                        }
                                    }
                                } while (connections.MoveNext());
                            }
                        }
                        catch (System.Text.Json.JsonException je)
                        {
                            errors.Add($"connections.json: invalid json - {je.Message}");
                        }
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

