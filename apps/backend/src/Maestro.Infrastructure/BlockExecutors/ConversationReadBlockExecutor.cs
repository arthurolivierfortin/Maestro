using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Reads messages from a conversation via IConversationManager.
/// Optionally truncates via IContextAssembler if context config is provided.
///
/// Phase 53-C: Atomic block executor.
/// </summary>
public class ConversationReadBlockExecutor : IBlockExecutor
{
    private readonly IConversationManager _conversationManager;
    private readonly IContextAssembler _contextAssembler;

    public string SupportedType => "conversation-read";

    public ConversationReadBlockExecutor(
        IConversationManager conversationManager,
        IContextAssembler contextAssembler)
    {
        _conversationManager = conversationManager;
        _contextAssembler = contextAssembler;
    }

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        if (!inputs.TryGetValue("conversationId", out var convIdObj) || convIdObj == null)
        {
            result.Success = false;
            result.Outputs["error"] = "Missing required input: conversationId";
            return result;
        }

        var conversationId = convIdObj.ToString() ?? "";

        var messages = _conversationManager.GetMessages(conversationId);

        result.Outputs["messages"] = messages;
        result.Outputs["messageCount"] = messages.Count;
        result.Logs.Add($"Read {messages.Count} messages from conversation '{conversationId}'");

        return result;
    }
}
