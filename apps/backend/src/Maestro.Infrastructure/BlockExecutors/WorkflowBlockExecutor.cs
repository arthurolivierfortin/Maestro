using Maestro.Application.DTOs;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Executor for workflow blocks: pass-through inputs → execute config.nodes → return variables.
/// Workflows always have config.nodes — no legacy fallback needed.
///
/// ARCHITECTURE (Phase 53-B): Workflows are the simplest multi-node block.
/// PrepareExecutionAsync passes inputs through. ExtractResultAsync returns workflow-produced
/// outputs — NOT all session variables (which would leak inputs like conversationHistory).
/// </summary>
public class WorkflowBlockExecutor : MultiNodeBlockExecutor
{
    // Input variables injected by ContractTestRunner or callers — these must NOT appear in outputs
    private static readonly HashSet<string> InputNoiseKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "prompt", "message", "conversationHistory",
        "sessionId", "workingDir", "workspaceId", "agentId", "outputDir",
        "description", "targetModel", "maxIterations"
    };

    public override string SupportedType => "workflow";

    public WorkflowBlockExecutor(IServiceProvider serviceProvider)
        : base(serviceProvider) { }

    protected override Task<Dictionary<string, object>> PrepareExecutionAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct)
    {
        return Task.FromResult(inputs);
    }

    protected override Task<BlockExecutionResult> ExtractResultAsync(
        BlockDefinition block, ExecutionContext context, CancellationToken ct)
    {
        var (cost, promptTokens, completionTokens) = GetAccumulatedCosts(context);

        // Return workflow-produced outputs only, not leaked caller inputs.
        // Include: node results, well-known content keys, and any variable set by set-variable nodes
        // that isn't an input noise key or internal system variable.
        var outputs = new Dictionary<string, object>();

        foreach (var kv in context.Variables)
        {
            if (kv.Value == null) continue;

            // Skip internal system variables (except node results)
            if (kv.Key.StartsWith("_") && !kv.Key.StartsWith("_nodeResult_"))
                continue;

            // Skip known input noise
            if (InputNoiseKeys.Contains(kv.Key))
                continue;

            outputs[kv.Key] = kv.Value;
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
}
