using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Executor for memory blocks.
/// Wraps IMemoryProvider as a composable block.
/// Supports operations: create-store, add-entry, search, get-relevant, remove-entry, delete-store.
/// </summary>
public class MemoryBlockExecutor : IBlockExecutor
{
    private readonly IMemoryProvider _memoryProvider;

    public MemoryBlockExecutor(IMemoryProvider memoryProvider)
    {
        _memoryProvider = memoryProvider;
    }

    public string SupportedType => "memory";

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block,
        ExecutionContext context,
        Dictionary<string, object> inputs,
        CancellationToken ct = default)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var result = new BlockExecutionResult();

        try
        {
            var operation = GetString(inputs, "operation", "get-relevant");

            switch (operation)
            {
                case "create-store":
                    await ExecuteCreateStore(inputs, result, ct);
                    break;

                case "add-entry":
                    await ExecuteAddEntry(inputs, result, ct);
                    break;

                case "search":
                    await ExecuteSearch(inputs, result, ct);
                    break;

                case "get-relevant":
                    await ExecuteGetRelevant(inputs, result, ct);
                    break;

                case "remove-entry":
                    await ExecuteRemoveEntry(inputs, result, ct);
                    break;

                case "delete-store":
                    await ExecuteDeleteStore(inputs, result, ct);
                    break;

                default:
                    result.Success = false;
                    result.Logs.Add($"Unknown memory operation: {operation}");
                    break;
            }
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Outputs["error"] = ex.Message;
            result.Logs.Add($"Memory operation failed: {ex.Message}");
        }

        result.DurationMs = sw.ElapsedMilliseconds;
        return result;
    }

    private async Task ExecuteCreateStore(
        Dictionary<string, object> inputs, BlockExecutionResult result, CancellationToken ct)
    {
        var id = GetString(inputs, "storeId", null)
            ?? throw new ArgumentException("storeId is required for create-store");
        var name = GetString(inputs, "name", id)!;
        var category = GetString(inputs, "category", "general")!;
        var blockId = GetString(inputs, "blockId", null);
        var sessionId = GetString(inputs, "sessionId", null);

        var store = await _memoryProvider.CreateStoreAsync(id, name, category, blockId, sessionId, ct);

        result.Outputs["storeId"] = store.Id;
        result.Outputs["name"] = store.Name;
        result.Outputs["category"] = store.Category;
        result.Success = true;
        result.Logs.Add($"Memory store created: {id} ({category})");
    }

    private async Task ExecuteAddEntry(
        Dictionary<string, object> inputs, BlockExecutionResult result, CancellationToken ct)
    {
        var storeId = GetString(inputs, "storeId", null)
            ?? throw new ArgumentException("storeId is required for add-entry");
        var key = GetString(inputs, "key", null)
            ?? throw new ArgumentException("key is required for add-entry");
        var content = GetString(inputs, "content", null)
            ?? throw new ArgumentException("content is required for add-entry");

        var confidence = GetDouble(inputs, "confidence", 0.5);
        var source = GetString(inputs, "source", null);
        var tags = GetStringList(inputs, "tags");

        var entry = new MemoryEntry
        {
            Key = key,
            Content = content,
            Confidence = confidence,
            Source = source,
            Tags = tags,
            CreatedAt = DateTimeOffset.UtcNow,
            LastUsedAt = DateTimeOffset.UtcNow
        };

        await _memoryProvider.AddEntryAsync(storeId, entry, ct);

        result.Outputs["storeId"] = storeId;
        result.Outputs["key"] = key;
        result.Success = true;
        result.Logs.Add($"Entry added to {storeId}: {key}");
    }

    private async Task ExecuteSearch(
        Dictionary<string, object> inputs, BlockExecutionResult result, CancellationToken ct)
    {
        var query = GetString(inputs, "query", null)
            ?? throw new ArgumentException("query is required for search");
        var category = GetString(inputs, "category", null);
        var maxResults = GetInt(inputs, "maxResults", 20);

        var results = await _memoryProvider.SearchAsync(query, category, maxResults, ct);

        var entries = results.Select(r => new Dictionary<string, object>
        {
            ["storeId"] = r.StoreId,
            ["key"] = r.Entry.Key,
            ["content"] = r.Entry.Content,
            ["confidence"] = r.Entry.Confidence,
            ["tags"] = r.Entry.Tags
        }).ToList();

        result.Outputs["entries"] = entries;
        result.Outputs["count"] = entries.Count;
        result.Success = true;
        result.Logs.Add($"Search '{query}': {entries.Count} results");
    }

    private async Task ExecuteGetRelevant(
        Dictionary<string, object> inputs, BlockExecutionResult result, CancellationToken ct)
    {
        var category = GetString(inputs, "category", null);
        var blockId = GetString(inputs, "blockId", null);
        var tags = GetStringList(inputs, "tags");
        var maxEntries = GetInt(inputs, "maxEntries", 10);

        var entries = await _memoryProvider.GetRelevantEntriesAsync(
            category, blockId, tags.Count > 0 ? tags : null, maxEntries, ct);

        var serialized = entries.Select(e => new Dictionary<string, object>
        {
            ["key"] = e.Key,
            ["content"] = e.Content,
            ["confidence"] = e.Confidence,
            ["tags"] = e.Tags,
            ["useCount"] = e.UseCount
        }).ToList();

        result.Outputs["entries"] = serialized;
        result.Outputs["count"] = serialized.Count;
        result.Success = true;
        result.Logs.Add($"Relevant entries: {serialized.Count} (category={category ?? "all"})");
    }

    private async Task ExecuteRemoveEntry(
        Dictionary<string, object> inputs, BlockExecutionResult result, CancellationToken ct)
    {
        var storeId = GetString(inputs, "storeId", null)
            ?? throw new ArgumentException("storeId is required for remove-entry");
        var key = GetString(inputs, "key", null)
            ?? throw new ArgumentException("key is required for remove-entry");

        await _memoryProvider.RemoveEntryAsync(storeId, key, ct);

        result.Outputs["storeId"] = storeId;
        result.Outputs["key"] = key;
        result.Success = true;
        result.Logs.Add($"Entry removed from {storeId}: {key}");
    }

    private async Task ExecuteDeleteStore(
        Dictionary<string, object> inputs, BlockExecutionResult result, CancellationToken ct)
    {
        var storeId = GetString(inputs, "storeId", null)
            ?? throw new ArgumentException("storeId is required for delete-store");

        await _memoryProvider.DeleteStoreAsync(storeId, ct);

        result.Outputs["storeId"] = storeId;
        result.Success = true;
        result.Logs.Add($"Memory store deleted: {storeId}");
    }

    private static string? GetString(Dictionary<string, object> inputs, string key, string? defaultValue)
    {
        if (inputs.TryGetValue(key, out var val) && val != null)
        {
            if (val is JsonElement je) return je.GetString();
            return val.ToString();
        }
        return defaultValue;
    }

    private static double GetDouble(Dictionary<string, object> inputs, string key, double defaultValue)
    {
        if (inputs.TryGetValue(key, out var val) && val != null)
        {
            if (val is JsonElement je) return je.GetDouble();
            if (val is double d) return d;
            if (double.TryParse(val.ToString(), out var parsed)) return parsed;
        }
        return defaultValue;
    }

    private static int GetInt(Dictionary<string, object> inputs, string key, int defaultValue)
    {
        if (inputs.TryGetValue(key, out var val) && val != null)
        {
            if (val is JsonElement je) return je.GetInt32();
            if (val is int i) return i;
            if (int.TryParse(val.ToString(), out var parsed)) return parsed;
        }
        return defaultValue;
    }

    private static List<string> GetStringList(Dictionary<string, object> inputs, string key)
    {
        if (!inputs.TryGetValue(key, out var val) || val == null)
            return new List<string>();

        if (val is JsonElement je && je.ValueKind == JsonValueKind.Array)
            return je.EnumerateArray().Select(e => e.GetString() ?? "").ToList();

        if (val is IEnumerable<object> list)
            return list.Select(o => o.ToString() ?? "").ToList();

        if (val is string s && !string.IsNullOrEmpty(s))
            return s.Split(',').Select(t => t.Trim()).ToList();

        return new List<string>();
    }
}
