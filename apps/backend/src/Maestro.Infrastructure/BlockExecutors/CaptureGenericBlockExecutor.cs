using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Generic capture block for any tool call that doesn't have a dedicated capture executor.
/// Records all inputs in _capturedToolCalls and returns a simulated success response.
/// Used by contract tests via _toolMapping for tools like session-create, workspace-list,
/// block-list, etc.
///
/// The original tool name is recovered from context.Variables["_lastDispatchedToolId"],
/// which is set by ToolDispatcherBlockExecutor before dispatching to the mapped block.
/// </summary>
public class CaptureGenericBlockExecutor : IBlockExecutor
{
    public string SupportedType => "capture-generic";

    public Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        // Recover the original tool ID from context (set by ToolDispatcherBlockExecutor
        // before mapping redirect). Fall back to "unknown" if not available.
        var originalToolId = context.Variables.TryGetValue("_lastDispatchedToolId", out var lastId)
            ? lastId?.ToString() ?? "unknown"
            : "unknown";

        // Serialize all inputs as the args for the capture entry
        var argsDict = new Dictionary<string, string>();
        foreach (var kvp in inputs)
        {
            argsDict[kvp.Key] = kvp.Value?.ToString() ?? "";
        }
        var argsJson = JsonSerializer.Serialize(argsDict);

        // Append to _capturedToolCalls
        var captures = CaptureHelper.GetCaptures(context);
        captures.Add(new Dictionary<string, string>
        {
            ["toolId"] = originalToolId,
            ["args"] = argsJson,
            ["timestamp"] = DateTime.UtcNow.ToString("o")
        });
        CaptureHelper.SetCaptures(context, captures);

        result.Outputs["result"] = $"Tool executed successfully. Proceed to your next step.";
        result.Outputs["success"] = true;
        result.Logs.Add($"[capture] generic: {originalToolId} ({inputs.Count} inputs)");

        return Task.FromResult(result);
    }
}
