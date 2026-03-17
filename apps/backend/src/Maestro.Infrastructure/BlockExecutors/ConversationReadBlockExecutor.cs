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

        var allMessages = _conversationManager.GetMessages(conversationId);

        // Apply keepLastN from context config if available
        var keepLastN = 0;
        if (inputs.TryGetValue("keepLastN", out var keepObj) && keepObj != null)
        {
            int.TryParse(keepObj.ToString(), out keepLastN);
        }
        else if (context.Variables.TryGetValue("_contextKeepLastN", out var ctxKeep) && ctxKeep != null)
        {
            int.TryParse(ctxKeep.ToString(), out keepLastN);
        }

        var messages = allMessages;
        if (keepLastN > 0 && allMessages.Count > keepLastN + 1)
        {
            // Always keep the system message (first) + last N messages
            var systemMessages = allMessages.Where(m => m.Role.Equals("system", StringComparison.OrdinalIgnoreCase)).ToList();
            var nonSystemMessages = allMessages.Where(m => !m.Role.Equals("system", StringComparison.OrdinalIgnoreCase)).ToList();
            var truncated = nonSystemMessages.Skip(Math.Max(0, nonSystemMessages.Count - keepLastN)).ToList();
            messages = systemMessages.Concat(truncated).ToList();

            _logger?.LogInformation(
                "ConversationRead '{ConversationId}': truncated {Total} → {Kept} messages (keepLastN={KeepLastN})",
                conversationId, allMessages.Count, messages.Count, keepLastN);
        }
        else
        {
            _logger?.LogInformation(
                "ConversationRead '{ConversationId}': {Count} messages. Roles: [{Roles}]",
                conversationId, messages.Count,
                string.Join(", ", messages.Select(m => m.Role)));
        }

        result.Outputs["messages"] = messages;
        result.Outputs["messageCount"] = messages.Count;
        result.Logs.Add($"Read {messages.Count} messages from conversation '{conversationId}'");

        return result;
    }
}
