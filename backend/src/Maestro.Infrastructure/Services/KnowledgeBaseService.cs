using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;

namespace Maestro.Infrastructure.Services;

/// <summary>
/// File-based implementation of the Knowledge Base service.
/// Stores documents as JSON files with automatic indexing.
/// </summary>
public class KnowledgeBaseService : IKnowledgeBaseService
{
    private readonly ILogger<KnowledgeBaseService> _logger;
    private readonly string _basePath;
    private readonly JsonSerializerOptions _jsonOptions;

    // Predefined collections with their configurations
    private static readonly Dictionary<string, CollectionConfig> CollectionConfigs = new()
    {
        ["models"] = new CollectionConfig
        {
            Description = "Model capability test results",
            SchemaRef = "_schemas/model-test-result.schema.json",
            PreviewFields = new[] { "summary.totalScore", "summary.classification", "model.displayName" }
        },
        ["model-test-runs"] = new CollectionConfig
        {
            Description = "Individual model capability test runs",
            SchemaRef = "_schemas/model-test-result.schema.json",
            PreviewFields = new[] { "model.id", "summary.totalScore", "summary.maxScore", "summary.percentage", "summary.classification", "summary.passedTests", "summary.failedTests", "meta.timestamp", "meta.runId" }
        },
        ["runs"] = new CollectionConfig
        {
            Description = "Workflow and agent run logs",
            SchemaRef = "_schemas/run-log.schema.json",
            PreviewFields = new[] { "status", "duration", "blockId" }
        },
        ["agents"] = new CollectionConfig
        {
            Description = "Agent documentation and configurations",
            PreviewFields = new[] { "description", "capabilities" }
        },
        ["architecture"] = new CollectionConfig
        {
            Description = "Architecture documentation and design decisions",
            PreviewFields = new[] { "title", "category" }
        }
    };

    public KnowledgeBaseService(ILogger<KnowledgeBaseService> logger)
    {
        _logger = logger;

        // Base path relative to the project root
        var projectRoot = FindProjectRoot();
        _basePath = Path.Combine(projectRoot, "docs", "knowledge-base");

        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        // Ensure base structure exists
        EnsureStructureExists();
    }

    public async Task<DocumentStorageResult> StoreDocumentAsync(
        string collection,
        string documentId,
        object document,
        string? linkedRunId = null)
    {
        try
        {
            // Sanitize inputs
            collection = SanitizeName(collection);
            documentId = SanitizeName(documentId);

            var collectionPath = Path.Combine(_basePath, collection);
            Directory.CreateDirectory(collectionPath);

            // Create envelope
            var envelope = new DocumentEnvelope
            {
                Id = documentId,
                Collection = collection,
                Title = ExtractTitle(document, collection),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                LinkedRunId = linkedRunId,
                SchemaRef = CollectionConfigs.GetValueOrDefault(collection)?.SchemaRef,
                Document = JsonSerializer.SerializeToElement(document, _jsonOptions)
            };

            // Check if document exists (for versioning)
            var filePath = Path.Combine(collectionPath, $"{documentId}.json");
            if (File.Exists(filePath))
            {
                var existing = await LoadEnvelopeAsync(filePath);
                if (existing != null)
                {
                    envelope.CreatedAt = existing.CreatedAt;
                    envelope.Version = existing.Version + 1;
                }
            }

            // Save document
            var json = JsonSerializer.Serialize(envelope, _jsonOptions);
            await File.WriteAllTextAsync(filePath, json);

            // Update index
            await UpdateIndexEntryAsync(collection, envelope);

            _logger.LogInformation(
                "Stored document {DocumentId} in collection {Collection}",
                documentId, collection);

            return new DocumentStorageResult
            {
                Success = true,
                DocumentId = documentId,
                Collection = collection,
                FilePath = filePath,
                StoredAt = envelope.UpdatedAt
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to store document {DocumentId} in {Collection}", documentId, collection);
            return new DocumentStorageResult
            {
                Success = false,
                DocumentId = documentId,
                Collection = collection,
                Error = ex.Message
            };
        }
    }

    public async Task<DocumentEnvelope?> GetDocumentAsync(string collection, string documentId)
    {
        collection = SanitizeName(collection);
        documentId = SanitizeName(documentId);

        var filePath = Path.Combine(_basePath, collection, $"{documentId}.json");

        if (!File.Exists(filePath))
        {
            return null;
        }

        return await LoadEnvelopeAsync(filePath);
    }

    public async Task<CollectionIndex> ListCollectionAsync(string collection)
    {
        collection = SanitizeName(collection);
        var indexPath = Path.Combine(_basePath, collection, "_index.json");

        if (File.Exists(indexPath))
        {
            var json = await File.ReadAllTextAsync(indexPath);
            return JsonSerializer.Deserialize<CollectionIndex>(json, _jsonOptions)
                   ?? CreateEmptyIndex(collection);
        }

        // Build index if it doesn't exist
        return await BuildIndexAsync(collection);
    }

    public async Task<List<DocumentSearchResult>> SearchAsync(string query, string? collection = null)
    {
        var results = new List<DocumentSearchResult>();
        var searchTerms = query.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries);

        var collectionsToSearch = collection != null
            ? new[] { collection }
            : Directory.GetDirectories(_basePath)
                .Select(Path.GetFileName)
                .Where(d => d != null && !d.StartsWith("_"))
                .Cast<string>()
                .ToArray();

        foreach (var col in collectionsToSearch)
        {
            var index = await ListCollectionAsync(col);

            foreach (var doc in index.Documents)
            {
                var searchText = $"{doc.Id} {doc.Title} {string.Join(" ", doc.Tags)}".ToLowerInvariant();
                var matchCount = searchTerms.Count(term => searchText.Contains(term));

                if (matchCount > 0)
                {
                    results.Add(new DocumentSearchResult
                    {
                        Collection = col,
                        DocumentId = doc.Id,
                        Title = doc.Title,
                        Score = (double)matchCount / searchTerms.Length,
                        MatchedFields = searchTerms.Where(t => searchText.Contains(t)).ToList()
                    });
                }
            }
        }

        return results.OrderByDescending(r => r.Score).ToList();
    }

    public async Task<bool> DeleteDocumentAsync(string collection, string documentId)
    {
        collection = SanitizeName(collection);
        documentId = SanitizeName(documentId);

        var filePath = Path.Combine(_basePath, collection, $"{documentId}.json");

        if (!File.Exists(filePath))
        {
            return false;
        }

        File.Delete(filePath);
        await RemoveFromIndexAsync(collection, documentId);

        _logger.LogInformation("Deleted document {DocumentId} from {Collection}", documentId, collection);
        return true;
    }

    public Task<List<CollectionInfo>> GetCollectionsAsync()
    {
        var collections = new List<CollectionInfo>();

        if (!Directory.Exists(_basePath))
        {
            return Task.FromResult(collections);
        }

        foreach (var dir in Directory.GetDirectories(_basePath))
        {
            var name = Path.GetFileName(dir);
            if (name == null || name.StartsWith("_")) continue;

            var config = CollectionConfigs.GetValueOrDefault(name);
            var files = Directory.GetFiles(dir, "*.json")
                .Where(f => !Path.GetFileName(f).StartsWith("_"))
                .ToArray();

            collections.Add(new CollectionInfo
            {
                Name = name,
                Description = config?.Description,
                DocumentCount = files.Length,
                LastUpdated = files.Length > 0
                    ? files.Max(f => File.GetLastWriteTimeUtc(f))
                    : DateTime.MinValue,
                SchemaRef = config?.SchemaRef
            });
        }

        return Task.FromResult(collections);
    }

    public async Task RebuildIndexAsync(string collection)
    {
        await BuildIndexAsync(collection);
    }

    #region Private Methods

    private void EnsureStructureExists()
    {
        Directory.CreateDirectory(_basePath);
        Directory.CreateDirectory(Path.Combine(_basePath, "_schemas"));

        foreach (var collection in CollectionConfigs.Keys)
        {
            Directory.CreateDirectory(Path.Combine(_basePath, collection));
        }
    }

    private async Task<CollectionIndex> BuildIndexAsync(string collection)
    {
        var collectionPath = Path.Combine(_basePath, collection);
        var index = CreateEmptyIndex(collection);

        if (!Directory.Exists(collectionPath))
        {
            return index;
        }

        var files = Directory.GetFiles(collectionPath, "*.json")
            .Where(f => !Path.GetFileName(f).StartsWith("_"));

        foreach (var file in files)
        {
            try
            {
                var envelope = await LoadEnvelopeAsync(file);
                if (envelope != null)
                {
                    index.Documents.Add(CreateIndexEntry(envelope, collection));
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to index file {File}", file);
            }
        }

        index.Count = index.Documents.Count;
        index.LastUpdated = DateTime.UtcNow;

        // Save index
        var indexPath = Path.Combine(collectionPath, "_index.json");
        var json = JsonSerializer.Serialize(index, _jsonOptions);
        await File.WriteAllTextAsync(indexPath, json);

        return index;
    }

    private async Task UpdateIndexEntryAsync(string collection, DocumentEnvelope envelope)
    {
        var index = await ListCollectionAsync(collection);

        // Remove existing entry if present
        index.Documents.RemoveAll(d => d.Id == envelope.Id);

        // Add new entry
        index.Documents.Add(CreateIndexEntry(envelope, collection));

        index.Count = index.Documents.Count;
        index.LastUpdated = DateTime.UtcNow;

        // Save index
        var indexPath = Path.Combine(_basePath, collection, "_index.json");
        var json = JsonSerializer.Serialize(index, _jsonOptions);
        await File.WriteAllTextAsync(indexPath, json);
    }

    private async Task RemoveFromIndexAsync(string collection, string documentId)
    {
        var index = await ListCollectionAsync(collection);
        index.Documents.RemoveAll(d => d.Id == documentId);
        index.Count = index.Documents.Count;
        index.LastUpdated = DateTime.UtcNow;

        var indexPath = Path.Combine(_basePath, collection, "_index.json");
        var json = JsonSerializer.Serialize(index, _jsonOptions);
        await File.WriteAllTextAsync(indexPath, json);
    }

    private DocumentIndexEntry CreateIndexEntry(DocumentEnvelope envelope, string collection)
    {
        var entry = new DocumentIndexEntry
        {
            Id = envelope.Id,
            Title = envelope.Title,
            CreatedAt = envelope.CreatedAt,
            UpdatedAt = envelope.UpdatedAt,
            LinkedRunId = envelope.LinkedRunId,
            Tags = envelope.Tags
        };

        // Extract preview fields
        var config = CollectionConfigs.GetValueOrDefault(collection);
        if (config?.PreviewFields != null)
        {
            foreach (var field in config.PreviewFields)
            {
                var value = ExtractJsonPath(envelope.Document, field);
                if (value != null)
                {
                    entry.Preview[field] = value;
                }
            }
        }

        return entry;
    }

    private CollectionIndex CreateEmptyIndex(string collection)
    {
        var config = CollectionConfigs.GetValueOrDefault(collection);
        return new CollectionIndex
        {
            Collection = collection,
            Description = config?.Description,
            Count = 0,
            LastUpdated = DateTime.UtcNow,
            Documents = new List<DocumentIndexEntry>()
        };
    }

    private async Task<DocumentEnvelope?> LoadEnvelopeAsync(string filePath)
    {
        var json = await File.ReadAllTextAsync(filePath);
        return JsonSerializer.Deserialize<DocumentEnvelope>(json, _jsonOptions);
    }

    private string? ExtractTitle(object document, string collection)
    {
        try
        {
            var json = JsonSerializer.SerializeToElement(document, _jsonOptions);

            // Try common title fields
            var titlePaths = new[] { "title", "name", "displayName", "model.displayName", "meta.testId" };

            foreach (var path in titlePaths)
            {
                var value = ExtractJsonPath(json, path);
                if (value is string s && !string.IsNullOrEmpty(s))
                {
                    return s;
                }
            }
        }
        catch { }

        return null;
    }

    private object? ExtractJsonPath(JsonElement element, string path)
    {
        try
        {
            var parts = path.Split('.');
            var current = element;

            foreach (var part in parts)
            {
                if (current.ValueKind != JsonValueKind.Object)
                    return null;

                if (!current.TryGetProperty(part, out current))
                    return null;
            }

            return current.ValueKind switch
            {
                JsonValueKind.String => current.GetString(),
                JsonValueKind.Number => current.GetDouble(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                _ => current.ToString()
            };
        }
        catch
        {
            return null;
        }
    }

    private static string SanitizeName(string name)
    {
        // Remove invalid characters for file names
        var invalid = Path.GetInvalidFileNameChars();
        return string.Join("", name.Split(invalid, StringSplitOptions.RemoveEmptyEntries))
            .Replace(" ", "-")
            .ToLowerInvariant();
    }

    private static string FindProjectRoot()
    {
        var current = Directory.GetCurrentDirectory();

        while (current != null)
        {
            if (File.Exists(Path.Combine(current, "CLAUDE.md")) ||
                Directory.Exists(Path.Combine(current, "blocks")))
            {
                return current;
            }
            current = Directory.GetParent(current)?.FullName;
        }

        // Fallback to current directory
        return Directory.GetCurrentDirectory();
    }

    #endregion

    private class CollectionConfig
    {
        public string? Description { get; set; }
        public string? SchemaRef { get; set; }
        public string[]? PreviewFields { get; set; }
    }
}
