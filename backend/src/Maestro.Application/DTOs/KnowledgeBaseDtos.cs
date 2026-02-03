using System.Text.Json;
using System.Text.Json.Serialization;

namespace Maestro.Application.DTOs;

/// <summary>
/// Wrapper for documents stored in the Knowledge Base.
/// Contains metadata about the document and its storage.
/// </summary>
public class DocumentEnvelope
{
    /// <summary>
    /// Unique document identifier within its collection.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Collection this document belongs to.
    /// </summary>
    public string Collection { get; set; } = string.Empty;

    /// <summary>
    /// Document title for display purposes.
    /// </summary>
    public string? Title { get; set; }

    /// <summary>
    /// When the document was first stored.
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// When the document was last updated.
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Optional run ID this document is linked to.
    /// </summary>
    public string? LinkedRunId { get; set; }

    /// <summary>
    /// Schema this document should validate against.
    /// </summary>
    public string? SchemaRef { get; set; }

    /// <summary>
    /// Document version for tracking changes.
    /// </summary>
    public int Version { get; set; } = 1;

    /// <summary>
    /// Tags for categorization and search.
    /// </summary>
    public List<string> Tags { get; set; } = new();

    /// <summary>
    /// Documentation generation status.
    /// Values: pending, generated, outdated, error, skipped
    /// </summary>
    public string DocStatus { get; set; } = "pending";

    /// <summary>
    /// Path to generated Markdown documentation (relative to docs/).
    /// </summary>
    public string? DocPath { get; set; }

    /// <summary>
    /// When documentation was last generated.
    /// </summary>
    public DateTime? DocGeneratedAt { get; set; }

    /// <summary>
    /// Version of documentation generator used.
    /// </summary>
    public string? DocGeneratorVersion { get; set; }

    /// <summary>
    /// The actual document content.
    /// </summary>
    public JsonElement Document { get; set; }
}

/// <summary>
/// Result of storing a document.
/// </summary>
public class DocumentStorageResult
{
    public bool Success { get; set; }
    public string DocumentId { get; set; } = string.Empty;
    public string Collection { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public DateTime StoredAt { get; set; }
    public string? Error { get; set; }
}

/// <summary>
/// Index of a collection, containing metadata about all documents.
/// </summary>
public class CollectionIndex
{
    public string Collection { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Count { get; set; }
    public DateTime LastUpdated { get; set; }
    public List<DocumentIndexEntry> Documents { get; set; } = new();
}

/// <summary>
/// Entry in a collection index.
/// </summary>
public class DocumentIndexEntry
{
    public string Id { get; set; } = string.Empty;
    public string? Title { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string? LinkedRunId { get; set; }
    public List<string> Tags { get; set; } = new();

    /// <summary>
    /// Documentation generation status.
    /// </summary>
    public string DocStatus { get; set; } = "pending";

    /// <summary>
    /// Path to generated Markdown documentation.
    /// </summary>
    public string? DocPath { get; set; }

    /// <summary>
    /// Preview/summary data extracted from the document.
    /// </summary>
    public Dictionary<string, object?> Preview { get; set; } = new();
}

/// <summary>
/// Result of a document search.
/// </summary>
public class DocumentSearchResult
{
    public string Collection { get; set; } = string.Empty;
    public string DocumentId { get; set; } = string.Empty;
    public string? Title { get; set; }
    public double Score { get; set; }
    public string? Snippet { get; set; }
    public List<string> MatchedFields { get; set; } = new();
}

/// <summary>
/// Information about a collection.
/// </summary>
public class CollectionInfo
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DocumentCount { get; set; }
    public DateTime LastUpdated { get; set; }
    public string? SchemaRef { get; set; }
}

/// <summary>
/// Request to store a document.
/// </summary>
public class StoreDocumentRequest
{
    public string Collection { get; set; } = string.Empty;
    public string? DocumentId { get; set; }
    public string? Title { get; set; }
    public string? LinkedRunId { get; set; }
    public List<string>? Tags { get; set; }

    [JsonExtensionData]
    public Dictionary<string, JsonElement>? Document { get; set; }
}

/// <summary>
/// Configuration for how workflow outputs should be persisted.
/// </summary>
public class OutputPersistConfig
{
    /// <summary>
    /// Whether this output should be persisted to the Knowledge Base.
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Collection to store in.
    /// </summary>
    public string Collection { get; set; } = string.Empty;

    /// <summary>
    /// JSON path to extract document ID from the output.
    /// </summary>
    public string? KeyField { get; set; }

    /// <summary>
    /// JSON path to extract title from the output.
    /// </summary>
    public string? TitleField { get; set; }

    /// <summary>
    /// Schema to validate against.
    /// </summary>
    public string? SchemaRef { get; set; }

    /// <summary>
    /// Fields to extract for the index preview.
    /// </summary>
    public List<string>? PreviewFields { get; set; }
}
