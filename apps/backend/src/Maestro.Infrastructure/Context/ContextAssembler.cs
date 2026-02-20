using Maestro.Application.Interfaces;

namespace Maestro.Infrastructure.Context;

/// <summary>
/// Default implementation of IContextAssembler.
/// Reads messages from IConversationManager, delegates to IContextProcessor
/// (sliding-window, passthrough) for optimization, returns ContextResult.
///
/// This is the bridge between conversations (message storage) and
/// context processors (optimization strategies).
///
/// Future (Phase 35): will also read from IMemoryManager to inject
/// persistent knowledge into the context.
/// </summary>
public class ContextAssembler : IContextAssembler
{
    private readonly IConversationManager _conversationManager;
    private readonly ContextProcessorFactory _processorFactory;

    public ContextAssembler(
        IConversationManager conversationManager,
        ContextProcessorFactory processorFactory)
    {
        _conversationManager = conversationManager;
        _processorFactory = processorFactory;
    }

    /// <inheritdoc />
    public async Task<ContextResult> AssembleAsync(
        string conversationId,
        ContextConfig config,
        CancellationToken ct = default)
    {
        // 1. Read all messages from conversation
        var allMessages = _conversationManager.GetMessages(conversationId);

        // 2. Separate system prompt from history
        var systemPrompt = allMessages
            .Where(m => m.Role == "system")
            .Select(m => m.Content)
            .FirstOrDefault();

        var historyMessages = allMessages
            .Where(m => m.Role != "system")
            .ToList();

        // 3. Build context input
        var contextInput = new ContextInput
        {
            Messages = historyMessages,
            SystemPrompt = systemPrompt,
            Config = config
        };

        // 4. Delegate to the appropriate context processor strategy
        var processor = _processorFactory.Create(config.Strategy);
        var result = await processor.ProcessAsync(contextInput, ct);

        return result;
    }
}
