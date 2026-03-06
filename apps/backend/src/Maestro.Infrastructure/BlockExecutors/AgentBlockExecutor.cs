using System.IO;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Context;
using Microsoft.Extensions.DependencyInjection;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

// === ARCHITECTURE RULE (ADR-AGENT-AS-WORKFLOW, 2026-03-05) ===
// AgentBlockExecutor MUST NOT contain tool dispatch, response parsing,
// or agentic loop logic. These are defined as config.nodes in the
// agent's block.json and executed by the base class (MultiNodeBlockExecutor).
//
// AgentBlockExecutor only handles:
// - Conversation creation (PrepareExecutionAsync)
// - I/O contract: prompt/messages in → text out (ExtractResultAsync)
//
// If you need to change agent behavior, modify the config.nodes in
// the block.json or the node templates, NOT this executor.
// See: docs/phases/PHASE-53/ADR-AGENT-AS-WORKFLOW.md
// ============================================================

/// <summary>
/// Executor for agent blocks. Thin wrapper around MultiNodeBlockExecutor that handles:
/// - Conversation setup (create/reuse persistent conversation with system prompt)
/// - I/O contract: prompt/messages in → text out (same interface as inference blocks)
///
/// All agent behavior (agentic loop, tool dispatch, response parsing) is defined
/// in config.nodes of the agent's block.json, executed by the base class.
/// </summary>
public class AgentBlockExecutor : MultiNodeBlockExecutor
{
    private readonly IConversationManager _conversationManager;

    public AgentBlockExecutor(IServiceProvider serviceProvider)
        : base(serviceProvider)
    {
        _conversationManager = serviceProvider.GetService<IConversationManager>()
            ?? new InMemoryConversationManager();
    }

    public override string SupportedType => "agent";

    // ===== MultiNodeBlockExecutor abstract method implementations =====

    protected override async Task<Dictionary<string, object>> PrepareExecutionAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct)
    {
        // Conversation setup: create or reuse a persistent conversation
        var sessionId = context.Variables.ContainsKey("sessionId")
            ? context.Variables["sessionId"]?.ToString()
            : null;
        var persistentId = sessionId != null ? $"{sessionId}:{block.Id}" : null;

        string conversationId;
        if (persistentId != null)
        {
            try
            {
                _conversationManager.GetMessages(persistentId);
                conversationId = _conversationManager.CreateOrGetConversation(persistentId,
                    await LoadSystemPrompt(block, ct) ?? "");
            }
            catch (InvalidOperationException)
            {
                conversationId = _conversationManager.CreateOrGetConversation(persistentId,
                    await LoadSystemPrompt(block, ct) ?? "");
            }
        }
        else
        {
            conversationId = _conversationManager.CreateConversation(
                await LoadSystemPrompt(block, ct) ?? "");
        }

        // Add user prompt to conversation
        if (inputs.TryGetValue("prompt", out var prompt) && prompt != null)
            _conversationManager.AddMessage(conversationId, "user", prompt.ToString()!);

        inputs["_conversationId"] = conversationId;
        return inputs;
    }

    protected override Task<BlockExecutionResult> ExtractResultAsync(
        BlockDefinition block, ExecutionContext context, CancellationToken ct)
    {
        var agentResult = context.Variables.ContainsKey("_agentResult")
            ? context.Variables["_agentResult"]?.ToString() ?? ""
            : "";

        return Task.FromResult(new BlockExecutionResult
        {
            Success = true,
            Outputs = new Dictionary<string, object>
            {
                ["content"] = agentResult,
                ["_agentResult"] = agentResult
            }
        });
    }

    /// <summary>
    /// Loads system prompt from file (system-prompt.md) or config (config.systemPrompt).
    /// Returns empty string if neither exists — caller must treat this as an error.
    /// </summary>
    private async Task<string> LoadSystemPrompt(BlockDefinition block, CancellationToken ct)
    {
        var path = LLMBlockExecutorBase.GetBlockPath(block);
        if (path != null)
        {
            var sp = Path.Combine(path, "system-prompt.md");
            if (File.Exists(sp))
                return await File.ReadAllTextAsync(sp, ct);
        }

        if (block.Config != null && block.Config.TryGetValue("systemPrompt", out var sysPromptConfig) && sysPromptConfig != null)
            return sysPromptConfig.ToString() ?? string.Empty;

        return string.Empty;
    }
}
