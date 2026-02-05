using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Context;
using Newtonsoft.Json.Linq;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Executor for context blocks.
/// Manages conversation context, applies strategies (sliding-window, summarize, etc.).
/// </summary>
public class ContextBlockExecutor : IBlockExecutor
{
    private readonly ContextProcessorFactory _processorFactory;

    public ContextBlockExecutor()
    {
        _processorFactory = new ContextProcessorFactory();
    }

    public string SupportedType => "context";

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
            // Extract inputs
            var messages = ExtractMessages(inputs);
            var systemPrompt = inputs.TryGetValue("systemPrompt", out var sp) ? sp?.ToString() : null;
            var newMessageContent = inputs.TryGetValue("newMessage", out var nm) ? nm?.ToString() : null;

            // Build config from block config
            var config = BuildConfig(block.Config);

            // Create new message if provided
            ChatMessage? newMessage = null;
            if (!string.IsNullOrEmpty(newMessageContent))
            {
                var role = inputs.TryGetValue("newMessageRole", out var r) ? r?.ToString() ?? "user" : "user";
                newMessage = new ChatMessage { Role = role, Content = newMessageContent };
            }

            // Create processor based on strategy
            var processor = _processorFactory.Create(config.Strategy);

            // Process context
            var contextInput = new ContextInput
            {
                Messages = messages,
                NewMessage = newMessage,
                SystemPrompt = systemPrompt,
                Config = config
            };

            var contextResult = await processor.ProcessAsync(contextInput, ct);

            // Set outputs
            result.Outputs["messages"] = contextResult.Messages;
            result.Outputs["messageCount"] = contextResult.Messages.Count;
            result.Outputs["estimatedTokens"] = contextResult.EstimatedTokens;
            result.Outputs["wasTruncated"] = contextResult.WasTruncated;
            result.Outputs["messagesRemoved"] = contextResult.MessagesRemoved;
            result.Outputs["originalCount"] = contextResult.OriginalMessageCount;

            if (contextResult.Summary != null)
            {
                result.Outputs["summary"] = contextResult.Summary;
            }

            result.Logs.Add($"Context processed: {contextResult.OriginalMessageCount} -> {contextResult.Messages.Count} messages");
            result.Logs.Add($"Estimated tokens: {contextResult.EstimatedTokens}");
            if (contextResult.WasTruncated)
            {
                result.Logs.Add($"Truncated: {contextResult.MessagesRemoved} messages removed");
            }

            result.Success = true;
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Outputs["error"] = ex.Message;
            result.Logs.Add($"Context processing failed: {ex.Message}");
        }

        result.DurationMs = sw.ElapsedMilliseconds;
        return result;
    }

    private List<ChatMessage> ExtractMessages(Dictionary<string, object> inputs)
    {
        if (!inputs.TryGetValue("messages", out var messagesObj) || messagesObj == null)
        {
            return new List<ChatMessage>();
        }

        // Handle different input formats
        if (messagesObj is List<ChatMessage> chatMessages)
        {
            return chatMessages;
        }

        // Handle Newtonsoft.Json JArray (from API deserialization)
        if (messagesObj is JArray jArray)
        {
            return ParseMessagesFromJArray(jArray);
        }

        if (messagesObj is JsonElement jsonElement)
        {
            return ParseMessagesFromJson(jsonElement);
        }

        if (messagesObj is string jsonString)
        {
            var doc = JsonDocument.Parse(jsonString);
            return ParseMessagesFromJson(doc.RootElement);
        }

        return new List<ChatMessage>();
    }

    private List<ChatMessage> ParseMessagesFromJArray(JArray jArray)
    {
        var messages = new List<ChatMessage>();

        foreach (var item in jArray)
        {
            if (item is JObject jObj)
            {
                var role = jObj["role"]?.ToString() ?? "user";
                var content = jObj["content"]?.ToString() ?? "";
                messages.Add(new ChatMessage { Role = role, Content = content });
            }
        }

        return messages;
    }

    private List<ChatMessage> ParseMessagesFromJson(JsonElement element)
    {
        var messages = new List<ChatMessage>();

        if (element.ValueKind != JsonValueKind.Array)
            return messages;

        foreach (var item in element.EnumerateArray())
        {
            var role = item.TryGetProperty("role", out var r) ? r.GetString() ?? "user" : "user";
            var content = item.TryGetProperty("content", out var c) ? c.GetString() ?? "" : "";
            messages.Add(new ChatMessage { Role = role, Content = content });
        }

        return messages;
    }

    private ContextConfig BuildConfig(Dictionary<string, object>? blockConfig)
    {
        var config = new ContextConfig();

        if (blockConfig == null)
            return config;

        return new ContextConfig
        {
            Strategy = GetConfigString(blockConfig, "strategy", "sliding-window"),
            MaxTokens = GetConfigInt(blockConfig, "maxTokens", 4096),
            ReserveForResponse = GetConfigInt(blockConfig, "reserveForResponse", 512),
            KeepSystemPrompt = GetConfigBool(blockConfig, "keepSystemPrompt", true),
            KeepLastN = GetConfigInt(blockConfig, "keepLastN", 10),
            SummaryModel = GetConfigString(blockConfig, "summaryModel", null),
            ContextBlockRef = GetConfigString(blockConfig, "contextBlockRef", null)
        };
    }

    private static string GetConfigString(Dictionary<string, object> config, string key, string? defaultValue)
    {
        if (config.TryGetValue(key, out var value) && value != null)
        {
            return value.ToString() ?? defaultValue ?? "";
        }
        return defaultValue ?? "";
    }

    private static int GetConfigInt(Dictionary<string, object> config, string key, int defaultValue)
    {
        if (config.TryGetValue(key, out var value))
        {
            if (value is int i) return i;
            if (value is long l) return (int)l;
            if (value is JsonElement je && je.ValueKind == JsonValueKind.Number)
                return je.GetInt32();
            if (int.TryParse(value?.ToString(), out var parsed))
                return parsed;
        }
        return defaultValue;
    }

    private static bool GetConfigBool(Dictionary<string, object> config, string key, bool defaultValue)
    {
        if (config.TryGetValue(key, out var value))
        {
            if (value is bool b) return b;
            if (value is JsonElement je && je.ValueKind == JsonValueKind.True) return true;
            if (value is JsonElement je2 && je2.ValueKind == JsonValueKind.False) return false;
            if (bool.TryParse(value?.ToString(), out var parsed))
                return parsed;
        }
        return defaultValue;
    }
}
