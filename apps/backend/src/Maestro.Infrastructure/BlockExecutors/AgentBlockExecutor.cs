using System.IO;
using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
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
/// - Conversation setup from workflow-provided history (PrepareExecutionAsync)
/// - I/O contract: prompt/messages in → text out (ExtractResultAsync)
///
/// Conversation persistence is managed by the CALLING WORKFLOW via blocks
/// ("everything is a block" principle). The agent receives conversationHistory
/// as input and creates a fresh conversation for its agentic loop.
///
/// All agent behavior (agentic loop, tool dispatch, response parsing) is defined
/// in config.nodes of the agent's block.json, executed by the base class.
/// </summary>
public class AgentBlockExecutor : MultiNodeBlockExecutor
{
    private readonly IConversationManager _conversationManager;
    private readonly ILogger<AgentBlockExecutor>? _logger;

    public AgentBlockExecutor(IServiceProvider serviceProvider)
        : base(serviceProvider)
    {
        _conversationManager = serviceProvider.GetRequiredService<IConversationManager>();
        _logger = serviceProvider.GetService<ILogger<AgentBlockExecutor>>();
    }

    public override string SupportedType => "agent";

    // ===== MultiNodeBlockExecutor abstract method implementations =====

    protected override async Task<Dictionary<string, object>> PrepareExecutionAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct)
    {
        // Phase 59-B: Clear agent state from any previous execution.
        // Without this, a second agent in a workflow sees _agentDone="true" from the first
        // agent and exits its while loop immediately. With child sessions (59-A) this is
        // less critical since the child starts empty, but it's a safety net for:
        // - Cases where the child session somehow inherits state
        // - Any agent that re-executes in the same session (e.g., retry scenarios)
        context.Variables.Remove("_agentDone");
        context.Variables.Remove("_agentResult");
        context.Variables.Remove("_agentIteration");

        var systemPrompt = await LoadSystemPrompt(block, ct) ?? "";

        // Fresh conversation for this invocation, seeded with workflow history.
        // Conversation persistence is the workflow's responsibility via blocks.
        var conversationId = _conversationManager.CreateConversation(systemPrompt);

        if (!inputs.TryGetValue("conversationHistory", out var histObj) || histObj == null
            || string.IsNullOrEmpty(histObj.ToString()))
        {
            throw new InvalidOperationException(
                $"Agent '{block.Id}' requires conversationHistory input. " +
                "Agents must be called through a workflow that manages conversation persistence via blocks.");
        }

        var histStr = histObj.ToString()!;
        var messages = JsonSerializer.Deserialize<List<ChatMessage>>(histStr,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (messages != null)
        {
            foreach (var msg in messages)
            {
                if (!string.Equals(msg.Role, "system", StringComparison.OrdinalIgnoreCase))
                    _conversationManager.AddMessage(conversationId, msg.Role, msg.Content);
            }
        }

        _logger?.LogInformation(
            "Agent '{BlockId}' conversation '{ConversationId}': seeded with {Count} history messages",
            block.Id, conversationId, messages?.Count ?? 0);

        inputs["_conversationId"] = conversationId;
        return inputs;
    }

    protected override Task<BlockExecutionResult> ExtractResultAsync(
        BlockDefinition block, ExecutionContext context, CancellationToken ct)
    {
        var agentResult = context.Variables.ContainsKey("_agentResult")
            ? context.Variables["_agentResult"]?.ToString() ?? ""
            : "";

        var (cost, promptTokens, completionTokens) = GetAccumulatedCosts(context);

        var outputs = new Dictionary<string, object>
        {
            ["content"] = agentResult,
            ["_agentResult"] = agentResult
        };

        // Forward structured outputs from step-complete (stored by set-variable
        // nodes in the agent's config.nodes step-complete branch as _agent* vars).
        // Convention: _agentBlockId → blockId, _agentFitness → fitness, etc.
        // This allows workflows to read e.g. {{_nodeResult_call-agent.blockId}}.
        foreach (var (key, val) in context.Variables)
        {
            if (key.StartsWith("_agent") && key.Length > 6
                && key != "_agentDone" && key != "_agentResult"
                && val != null)
            {
                var outputKey = char.ToLower(key[6]) + key.Substring(7);
                var strVal = val.ToString() ?? "";
                if (!string.IsNullOrEmpty(strVal))
                    outputs[outputKey] = strVal;
            }
        }

        return Task.FromResult(new BlockExecutionResult
        {
            Success = true,
            EstimatedCostUsd = cost,
            PromptTokens = promptTokens,
            CompletionTokens = completionTokens,
            TotalTokens = promptTokens + completionTokens,
            Outputs = outputs
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
