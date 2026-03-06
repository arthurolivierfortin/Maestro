using System.Text.RegularExpressions;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Builds a messages[] array from a prompt and optional system prompt.
/// Logic extracted from InferenceBlockExecutor: loads system prompt from config
/// or system-prompt.md file, resolves templates, builds [system, user] message list.
///
/// Phase 53-C: Atomic block executor.
/// </summary>
public class MessageBuilderBlockExecutor : IBlockExecutor
{
    public string SupportedType => "message-builder";

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        var prompt = inputs.TryGetValue("prompt", out var promptObj) ? promptObj?.ToString() ?? "" : "";
        var systemPrompt = inputs.TryGetValue("systemPrompt", out var spObj) ? spObj?.ToString() : null;
        var systemPromptFile = inputs.TryGetValue("systemPromptFile", out var spfObj) ? spfObj?.ToString() : null;

        // Resolve system prompt: explicit input > config > file
        if (string.IsNullOrEmpty(systemPrompt))
        {
            if (block.Config != null && block.Config.TryGetValue("systemPrompt", out var sp))
                systemPrompt = sp?.ToString();
        }

        if (string.IsNullOrEmpty(systemPrompt))
        {
            // Try loading from file
            var filePath = systemPromptFile;
            if (string.IsNullOrEmpty(filePath))
            {
                var blockPath = LLMBlockExecutorBase.GetBlockPath(block);
                if (blockPath != null)
                    filePath = Path.Combine(blockPath, "system-prompt.md");
            }

            if (!string.IsNullOrEmpty(filePath) && File.Exists(filePath))
                systemPrompt = await File.ReadAllTextAsync(filePath, ct);
        }

        // Resolve templates in prompt
        var resolvedPrompt = LLMBlockExecutorBase.ResolveTemplate(prompt, inputs);
        if (string.IsNullOrEmpty(resolvedPrompt))
        {
            // Build from inputs
            var parts = new List<string>();
            foreach (var kv in inputs)
            {
                if (kv.Key == "systemPrompt" || kv.Key == "systemPromptFile") continue;
                if (kv.Value != null && !string.IsNullOrEmpty(kv.Value.ToString()))
                    parts.Add($"{kv.Key}: {kv.Value}");
            }
            resolvedPrompt = string.Join("\n", parts);
        }

        // Resolve templates in system prompt
        if (!string.IsNullOrEmpty(systemPrompt))
            systemPrompt = LLMBlockExecutorBase.ResolveTemplate(systemPrompt, inputs);

        // Build messages array
        var messages = new List<ChatMessage>();
        if (!string.IsNullOrEmpty(systemPrompt))
            messages.Add(ChatMessage.System(systemPrompt));
        messages.Add(ChatMessage.User(resolvedPrompt));

        result.Outputs["messages"] = messages;
        result.Logs.Add($"Built {messages.Count} messages (system: {!string.IsNullOrEmpty(systemPrompt)}, prompt: {resolvedPrompt.Length} chars)");

        return result;
    }
}
