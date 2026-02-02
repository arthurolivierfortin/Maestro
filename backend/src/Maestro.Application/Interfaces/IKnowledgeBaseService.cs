using Maestro.Application.DTOs;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Service for managing the Maestro Knowledge Base.
/// Handles document persistence, indexing, and retrieval.
/// </summary>
public interface IKnowledgeBaseService
{
    /// <summary>
    /// Store a document in a collection.
    /// </summary>
    /// <param name="collection">Collection name (e.g., "models", "runs")</param>
    /// <param name="documentId">Unique document identifier</param>
    /// <param name="document">Document content</param>
    /// <param name="linkedRunId">Optional run ID this document is linked to</param>
    /// <returns>Storage result with path and metadata</returns>
    Task<DocumentStorageResult> StoreDocumentAsync(
        string collection,
        string documentId,
        object document,
        string? linkedRunId = null);

    /// <summary>
    /// Retrieve a document from a collection.
    /// </summary>
    Task<DocumentEnvelope?> GetDocumentAsync(string collection, string documentId);

    /// <summary>
    /// List all documents in a collection.
    /// </summary>
    Task<CollectionIndex> ListCollectionAsync(string collection);

    /// <summary>
    /// Search documents across collections.
    /// </summary>
    Task<List<DocumentSearchResult>> SearchAsync(string query, string? collection = null);

    /// <summary>
    /// Delete a document from a collection.
    /// </summary>
    Task<bool> DeleteDocumentAsync(string collection, string documentId);

    /// <summary>
    /// Get all available collections.
    /// </summary>
    Task<List<CollectionInfo>> GetCollectionsAsync();

    /// <summary>
    /// Update the index for a collection.
    /// </summary>
    Task RebuildIndexAsync(string collection);
}
