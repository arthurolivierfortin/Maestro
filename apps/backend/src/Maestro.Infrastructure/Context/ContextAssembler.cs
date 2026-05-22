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
/// Phase 36-C: Also reads from IMemoryProvider to inject persistent
/// knowledge entries into the system prompt context.
/// </summary>
public class ContextAssembler : IContextAssembler
{
    private readonly IConversationManager _conversationManager;
    private readonly ContextProcessorFactory _processorFactory;
    private readonly IMemoryProvider? _memoryProvider;

    public ContextAssembler(
        IConversationManager conversationManager,
        ContextProcessorFactory processorFactory,
        IMemoryProvider? memoryProvider = null)
    {
        _conversationManager = conversationManager;
        _processorFactory = processorFactory;
        _memoryProvider = memoryProvider;
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

        // 3. Inject memory entries into system prompt if available
        if (_memoryProvider != null)
        {
            var memoryEntries = await _memoryProvider.GetRelevantEntriesAsync(
                maxEntries: 5, ct: ct);

            if (memoryEntries.Count > 0)
            {
                var memorySection = FormatMemoryEntries(memoryEntries);
                systemPrompt = string.IsNullOrEmpty(systemPrompt)
                    ? memorySection
                    : $"{systemPrompt}\n\n{memorySection}";
            }
        }

        // 4. Build context input
        var contextInput = new ContextInput
        {
            Messages = historyMessages,
            SystemPrompt = systemPrompt,
            Config = config
        };

        // 5. Delegate to the appropriate context processor strategy
        var processor = _processorFactory.Create(config.Strategy);
        var result = await processor.ProcessAsync(contextInput, ct);

        return result;
    }

    private static string FormatMemoryEntries(IReadOnlyList<Domain.Entities.MemoryEntry> entries)
    {
        var lines = new List<string> { "## Relevant Knowledge (from memory)" };

        foreach (var entry in entries)
        {
            var tags = entry.Tags.Count > 0 ? $" [{string.Join(", ", entry.Tags)}]" : "";
            lines.Add($"- **{entry.Key}**{tags}: {entry.Content}");
        }

        return string.Join("\n", lines);
    }
}
