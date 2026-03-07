using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Microsoft.Extensions.Logging;
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
    private readonly ILogger<ConversationReadBlockExecutor>? _logger;

    public string SupportedType => "conversation-read";

    public ConversationReadBlockExecutor(
        IConversationManager conversationManager,
        IContextAssembler contextAssembler,
        ILogger<ConversationReadBlockExecutor>? logger = null)
    {
        _conversationManager = conversationManager;
        _contextAssembler = contextAssembler;
        _logger = logger;
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

        // Diagnostic logging for conversation persistence debugging
        _logger?.LogInformation(
            "ConversationRead '{ConversationId}': {Count} messages. Roles: [{Roles}]",
            conversationId, messages.Count,
            string.Join(", ", messages.Select(m => m.Role)));

        result.Outputs["messages"] = messages;
        result.Outputs["messageCount"] = messages.Count;
        result.Logs.Add($"Read {messages.Count} messages from conversation '{conversationId}'");

        return result;
    }
}
