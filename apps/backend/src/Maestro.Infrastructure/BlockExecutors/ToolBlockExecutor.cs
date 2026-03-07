using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

// === ARCHITECTURE RULE (ADR-AGENT-AS-WORKFLOW, 2026-03-05) ===
// ToolBlockExecutor MUST NOT contain if-chains for different tool types.
// Each tool has its own config.nodes in its block.json.
// ToolBlockExecutor only handles:
// - Input mapping from block.json schema (PrepareExecutionAsync)
// - Output mapping from block.json schema (ExtractResultAsync)
//
// If you need a new tool type, create a new block.json with config.nodes.
// NEVER add "if (toolType == 'xxx')" here.
// See: docs/phases/PHASE-53/ADR-AGENT-AS-WORKFLOW.md
// ============================================================

/// <summary>
/// Executor for tool blocks. Thin wrapper around MultiNodeBlockExecutor that handles:
/// - Input pass-through (already resolved by NodeExecutionEngine)
/// - Output mapping from context variables based on block's output schema
///
/// All tool behavior is defined in config.nodes of the tool's block.json,
/// executed by the base class.
/// </summary>
public class ToolBlockExecutor : MultiNodeBlockExecutor
{
    public override string SupportedType => "tool";

    public ToolBlockExecutor() : base(null) { }

    public ToolBlockExecutor(IServiceProvider serviceProvider)
        : base(serviceProvider) { }

    // ===== MultiNodeBlockExecutor abstract method implementations =====

    protected override Task<Dictionary<string, object>> PrepareExecutionAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct)
    {
        // Tool blocks: pass inputs through (already resolved by NodeExecutionEngine)
        return Task.FromResult(inputs);
    }

    protected override Task<BlockExecutionResult> ExtractResultAsync(
        BlockDefinition block, ExecutionContext context, CancellationToken ct)
    {
        // Map outputs from context variables based on block's output schema
        var outputs = new Dictionary<string, object>();
        if (block.Config != null && block.Config.TryGetValue("outputs", out var outputsDef))
        {
            // Read output names from config schema and pull from context
            if (outputsDef is JsonElement je && je.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in je.EnumerateObject())
                {
                    if (context.Variables.TryGetValue(prop.Name, out var value))
                        outputs[prop.Name] = value;
                }
            }
        }

        // If no schema-based outputs, return all non-internal variables
        if (outputs.Count == 0)
        {
            foreach (var kv in context.Variables.Where(kv => !kv.Key.StartsWith("_")))
                outputs[kv.Key] = kv.Value;
        }

        var (cost, promptTokens, completionTokens) = GetAccumulatedCosts(context);

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
}
