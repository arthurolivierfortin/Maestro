using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Appends a message to a conversation via IConversationManager.
///
/// Phase 53-C: Atomic block executor.
/// </summary>
public class ConversationAppendBlockExecutor : IBlockExecutor
{
    private readonly IConversationManager _conversationManager;

    public string SupportedType => "conversation-append";

    public ConversationAppendBlockExecutor(IConversationManager conversationManager)
    {
        _conversationManager = conversationManager;
    }

    public Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        if (!inputs.TryGetValue("conversationId", out var convIdObj) || convIdObj == null)
        {
            result.Success = false;
            result.Outputs["error"] = "Missing required input: conversationId";
            return Task.FromResult(result);
        }

        var conversationId = convIdObj.ToString() ?? "";

        var role = inputs.TryGetValue("role", out var roleObj) ? roleObj?.ToString() ?? "user" : "user";
        var content = inputs.TryGetValue("content", out var contentObj) ? contentObj?.ToString() ?? "" : "";

        _conversationManager.AddMessage(conversationId, role, content);

        var messages = _conversationManager.GetMessages(conversationId);
        result.Outputs["messageCount"] = messages.Count;
        result.Logs.Add($"Appended {role} message to conversation '{conversationId}' (now {messages.Count} messages)");

        return Task.FromResult(result);
    }
}
