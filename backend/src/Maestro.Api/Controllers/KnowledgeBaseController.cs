using Microsoft.AspNetCore.Mvc;
using Maestro.Application.Interfaces;
using Maestro.Application.DTOs;
using System.Text.Json;

namespace Maestro.Api.Controllers;

/// <summary>
/// API controller for the Maestro Knowledge Base.
/// Provides CRUD operations for documents and collections.
/// </summary>
[ApiController]
[Route("api/knowledge-base")]
public class KnowledgeBaseController : ControllerBase
{
    private readonly IKnowledgeBaseService _knowledgeBase;
    private readonly ILogger<KnowledgeBaseController> _logger;

    public KnowledgeBaseController(
        IKnowledgeBaseService knowledgeBase,
        ILogger<KnowledgeBaseController> logger)
    {
        _knowledgeBase = knowledgeBase;
        _logger = logger;
    }

    /// <summary>
    /// Get all collections in the Knowledge Base.
    /// </summary>
    [HttpGet("collections")]
    public async Task<IActionResult> GetCollections()
    {
        var collections = await _knowledgeBase.GetCollectionsAsync();
        return Ok(collections);
    }

    /// <summary>
    /// Get all documents in a collection.
    /// </summary>
    [HttpGet("collections/{collection}")]
    public async Task<IActionResult> GetCollection(string collection)
    {
        var index = await _knowledgeBase.ListCollectionAsync(collection);
        return Ok(index);
    }

    /// <summary>
    /// Get a specific document.
    /// </summary>
    [HttpGet("collections/{collection}/{documentId}")]
    public async Task<IActionResult> GetDocument(string collection, string documentId)
    {
        var document = await _knowledgeBase.GetDocumentAsync(collection, documentId);

        if (document == null)
        {
            return NotFound(new { error = $"Document '{documentId}' not found in collection '{collection}'" });
        }

        return Ok(document);
    }

    /// <summary>
    /// Store a document in a collection.
    /// </summary>
    [HttpPost("collections/{collection}")]
    public async Task<IActionResult> StoreDocument(
        string collection,
        [FromBody] JsonElement document,
        [FromQuery] string? documentId = null,
        [FromQuery] string? linkedRunId = null)
    {
        // Generate document ID if not provided
        if (string.IsNullOrEmpty(documentId))
        {
            documentId = TryExtractDocumentId(document) ?? Guid.NewGuid().ToString("N")[..8];
        }

        var result = await _knowledgeBase.StoreDocumentAsync(
            collection,
            documentId,
            document,
            linkedRunId);

        if (!result.Success)
        {
            return BadRequest(new { error = result.Error });
        }

        return CreatedAtAction(
            nameof(GetDocument),
            new { collection, documentId = result.DocumentId },
            result);
    }

    /// <summary>
    /// Update a document in a collection.
    /// </summary>
    [HttpPut("collections/{collection}/{documentId}")]
    public async Task<IActionResult> UpdateDocument(
        string collection,
        string documentId,
        [FromBody] JsonElement document,
        [FromQuery] string? linkedRunId = null)
    {
        var result = await _knowledgeBase.StoreDocumentAsync(
            collection,
            documentId,
            document,
            linkedRunId);

        if (!result.Success)
        {
            return BadRequest(new { error = result.Error });
        }

        return Ok(result);
    }

    /// <summary>
    /// Delete a document from a collection.
    /// </summary>
    [HttpDelete("collections/{collection}/{documentId}")]
    public async Task<IActionResult> DeleteDocument(string collection, string documentId)
    {
        var deleted = await _knowledgeBase.DeleteDocumentAsync(collection, documentId);

        if (!deleted)
        {
            return NotFound(new { error = $"Document '{documentId}' not found in collection '{collection}'" });
        }

        return NoContent();
    }

    /// <summary>
    /// Search documents across collections.
    /// </summary>
    [HttpGet("search")]
    public async Task<IActionResult> Search(
        [FromQuery] string q,
        [FromQuery] string? collection = null)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return BadRequest(new { error = "Query parameter 'q' is required" });
        }

        var results = await _knowledgeBase.SearchAsync(q, collection);
        return Ok(new { query = q, collection, results });
    }

    /// <summary>
    /// Rebuild the index for a collection.
    /// </summary>
    [HttpPost("collections/{collection}/rebuild-index")]
    public async Task<IActionResult> RebuildIndex(string collection)
    {
        await _knowledgeBase.RebuildIndexAsync(collection);
        var index = await _knowledgeBase.ListCollectionAsync(collection);
        return Ok(new { message = "Index rebuilt", index });
    }

    /// <summary>
    /// Store model test results (convenience endpoint).
    /// </summary>
    [HttpPost("models/{modelId}/test-results")]
    public async Task<IActionResult> StoreModelTestResults(
        string modelId,
        [FromBody] JsonElement testResults,
        [FromQuery] string? linkedRunId = null)
    {
        var result = await _knowledgeBase.StoreDocumentAsync(
            "models",
            modelId,
            testResults,
            linkedRunId);

        if (!result.Success)
        {
            return BadRequest(new { error = result.Error });
        }

        return CreatedAtAction(
            nameof(GetDocument),
            new { collection = "models", documentId = modelId },
            result);
    }

    /// <summary>
    /// Get model test results (convenience endpoint).
    /// </summary>
    [HttpGet("models/{modelId}/test-results")]
    public async Task<IActionResult> GetModelTestResults(string modelId)
    {
        var document = await _knowledgeBase.GetDocumentAsync("models", modelId);

        if (document == null)
        {
            return NotFound(new { error = $"No test results found for model '{modelId}'" });
        }

        return Ok(document);
    }

    /// <summary>
    /// List all model test results (convenience endpoint).
    /// </summary>
    [HttpGet("models")]
    public async Task<IActionResult> ListModelTestResults()
    {
        var index = await _knowledgeBase.ListCollectionAsync("models");
        return Ok(index);
    }

    /// <summary>
    /// Get all test runs for a specific model.
    /// </summary>
    [HttpGet("models/{modelId}/runs")]
    public async Task<IActionResult> GetModelTestRuns(string modelId)
    {
        var index = await _knowledgeBase.ListCollectionAsync("model-test-runs");

        // Filter runs for this model (documentId starts with modelId)
        var sanitizedModelId = modelId.Replace("/", "-").ToLowerInvariant();
        var modelRuns = index.Documents
            .Where(d => d.Id.StartsWith(sanitizedModelId, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(d => d.CreatedAt)
            .ToList();

        // Calculate average scores if there are runs
        object? averages = null;
        if (modelRuns.Count > 0)
        {
            var scores = new List<double>();
            var classifications = new Dictionary<string, int>();

            foreach (var run in modelRuns)
            {
                if (run.Preview.TryGetValue("summary.totalScore", out var scoreObj) && scoreObj is double score)
                {
                    scores.Add(score);
                }
                if (run.Preview.TryGetValue("summary.classification", out var classObj) && classObj is string classification)
                {
                    classifications[classification] = classifications.GetValueOrDefault(classification) + 1;
                }
            }

            averages = new
            {
                avgScore = scores.Count > 0 ? scores.Average() : 0,
                totalRuns = modelRuns.Count,
                classificationDistribution = classifications
            };
        }

        return Ok(new
        {
            modelId,
            totalRuns = modelRuns.Count,
            averages,
            runs = modelRuns.Select(r => new
            {
                runId = r.Id,
                timestamp = r.CreatedAt,
                preview = r.Preview
            })
        });
    }

    /// <summary>
    /// Get a specific test run.
    /// </summary>
    [HttpGet("models/{modelId}/runs/{runId}")]
    public async Task<IActionResult> GetModelTestRun(string modelId, string runId)
    {
        var document = await _knowledgeBase.GetDocumentAsync("model-test-runs", runId);

        if (document == null)
        {
            return NotFound(new { error = $"Test run '{runId}' not found" });
        }

        return Ok(document);
    }

    #region Private Methods

    private string? TryExtractDocumentId(JsonElement document)
    {
        // Try common ID fields
        var idPaths = new[] { "id", "documentId", "model.id", "meta.testId" };

        foreach (var path in idPaths)
        {
            if (TryGetJsonPath(document, path, out var value) && value is string s)
            {
                return s;
            }
        }

        return null;
    }

    private bool TryGetJsonPath(JsonElement element, string path, out object? value)
    {
        value = null;
        try
        {
            var parts = path.Split('.');
            var current = element;

            foreach (var part in parts)
            {
                if (current.ValueKind != JsonValueKind.Object)
                    return false;

                if (!current.TryGetProperty(part, out current))
                    return false;
            }

            value = current.ValueKind switch
            {
                JsonValueKind.String => current.GetString(),
                JsonValueKind.Number => current.GetDouble(),
                _ => current.ToString()
            };

            return value != null;
        }
        catch
        {
            return false;
        }
    }

    #endregion
}
