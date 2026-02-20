namespace Maestro.Application.Interfaces;

/// <summary>
/// Assembles the final context for an LLM call.
/// Reads messages from a conversation (via IConversationManager),
/// applies context processing strategies (via IContextProcessor),
/// and returns optimized messages ready for the LLM.
///
/// Future: will also integrate memory sources (Phase 35).
/// </summary>
public interface IContextAssembler
{
    /// <summary>
    /// Assembles optimized context from a conversation.
    /// </summary>
    /// <param name="conversationId">The conversation to read messages from.</param>
    /// <param name="config">Context processing configuration (strategy, token limits).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Optimized messages ready for LLM consumption.</returns>
    Task<ContextResult> AssembleAsync(
        string conversationId,
        ContextConfig config,
        CancellationToken ct = default);
}
