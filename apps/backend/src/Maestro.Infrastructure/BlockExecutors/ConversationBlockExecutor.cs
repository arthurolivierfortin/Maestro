using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Executor for conversation blocks.
/// Wraps IConversationManager as a composable block.
/// Supports operations: create, add-message, get-state, cleanup.
/// </summary>
public class ConversationBlockExecutor : IBlockExecutor
{
    private readonly IConversationManager _conversationManager;

    public ConversationBlockExecutor(IConversationManager conversationManager)
    {
        _conversationManager = conversationManager;
    }

    public string SupportedType => "conversation";

    public Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block,
        ExecutionContext context,
        Dictionary<string, object> inputs,
        CancellationToken ct = default)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var result = new BlockExecutionResult();

        try
        {
            var operation = GetString(inputs, "operation", "create");

            switch (operation)
            {
                case "create":
                    ExecuteCreate(inputs, result);
                    break;

                case "add-message":
                    ExecuteAddMessage(inputs, result);
                    break;

                case "get-state":
                    ExecuteGetState(inputs, result);
                    break;

                case "get-messages":
                    ExecuteGetMessages(inputs, result);
                    break;

                case "cleanup":
                    ExecuteCleanup(inputs, result);
                    break;

                default:
                    result.Success = false;
                    result.Logs.Add($"Unknown conversation operation: {operation}");
                    break;
            }
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Outputs["error"] = ex.Message;
            result.Logs.Add($"Conversation operation failed: {ex.Message}");
        }

        result.DurationMs = sw.ElapsedMilliseconds;
        return Task.FromResult(result);
    }

    private void ExecuteCreate(Dictionary<string, object> inputs, BlockExecutionResult result)
    {
        var systemPrompt = GetString(inputs, "systemPrompt", null);
        var conversationId = _conversationManager.CreateConversation(systemPrompt);

        result.Outputs["conversationId"] = conversationId;
        result.Outputs["state"] = SerializeState(_conversationManager.GetState(conversationId));
        result.Success = true;
        result.Logs.Add($"Conversation created: {conversationId}");
    }

    private void ExecuteAddMessage(Dictionary<string, object> inputs, BlockExecutionResult result)
    {
        var conversationId = GetString(inputs, "conversationId", null)
            ?? throw new ArgumentException("conversationId is required for add-message");
        var role = GetString(inputs, "role", "user");
        var content = GetString(inputs, "content", "")
            ?? throw new ArgumentException("content is required for add-message");

        _conversationManager.AddMessage(conversationId, role, content);

        result.Outputs["conversationId"] = conversationId;
        result.Outputs["state"] = SerializeState(_conversationManager.GetState(conversationId));
        result.Success = true;
        result.Logs.Add($"Message added: {role} ({content.Length} chars)");
    }

    private void ExecuteGetState(Dictionary<string, object> inputs, BlockExecutionResult result)
    {
        var conversationId = GetString(inputs, "conversationId", null)
            ?? throw new ArgumentException("conversationId is required for get-state");

        var state = _conversationManager.GetState(conversationId);
        if (state == null)
        {
            result.Success = false;
            result.Logs.Add($"Conversation not found: {conversationId}");
            return;
        }

        result.Outputs["conversationId"] = conversationId;
        result.Outputs["state"] = SerializeState(state);
        result.Outputs["messageCount"] = state.TotalMessageCount;
        result.Outputs["estimatedTokens"] = state.EstimatedTotalTokens;
        result.Success = true;
    }

    private void ExecuteGetMessages(Dictionary<string, object> inputs, BlockExecutionResult result)
    {
        var conversationId = GetString(inputs, "conversationId", null)
            ?? throw new ArgumentException("conversationId is required for get-messages");

        var messages = _conversationManager.GetMessages(conversationId);

        result.Outputs["conversationId"] = conversationId;
        result.Outputs["messages"] = messages;
        result.Outputs["messageCount"] = messages.Count;
        result.Success = true;
    }

    private void ExecuteCleanup(Dictionary<string, object> inputs, BlockExecutionResult result)
    {
        var conversationId = GetString(inputs, "conversationId", null)
            ?? throw new ArgumentException("conversationId is required for cleanup");

        _conversationManager.CleanupConversation(conversationId);

        result.Outputs["conversationId"] = conversationId;
        result.Success = true;
        result.Logs.Add($"Conversation cleaned up: {conversationId}");
    }

    private static Dictionary<string, object> SerializeState(ConversationState? state)
    {
        if (state == null) return new Dictionary<string, object>();

        return new Dictionary<string, object>
        {
            ["conversationId"] = state.ConversationId,
            ["systemMessageCount"] = state.SystemMessageCount,
            ["historyMessageCount"] = state.HistoryMessageCount,
            ["totalMessageCount"] = state.TotalMessageCount,
            ["estimatedSystemTokens"] = state.EstimatedSystemTokens,
            ["estimatedHistoryTokens"] = state.EstimatedHistoryTokens,
            ["estimatedTotalTokens"] = state.EstimatedTotalTokens,
            ["createdAt"] = state.CreatedAt.ToString("o"),
            ["lastUpdatedAt"] = state.LastUpdatedAt.ToString("o")
        };
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
}
