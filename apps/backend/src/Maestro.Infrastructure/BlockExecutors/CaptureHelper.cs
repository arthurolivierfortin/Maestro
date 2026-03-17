using System.Text.Json;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Phase 62-A: Shared helper for capture block executors.
/// Manages the _capturedToolCalls variable in the execution context.
/// </summary>
internal static class CaptureHelper
{
    private const string CapturedToolCallsKey = "_capturedToolCalls";

    /// <summary>
    /// Get the current list of captured tool calls from the execution context.
    /// Returns an empty list if none exist yet.
    /// </summary>
    public static List<Dictionary<string, string>> GetCaptures(ExecutionContext context)
    {
        if (context.Variables.TryGetValue(CapturedToolCallsKey, out var existing) && existing != null)
        {
            var str = existing.ToString();
            if (!string.IsNullOrWhiteSpace(str))
            {
                try
                {
                    return JsonSerializer.Deserialize<List<Dictionary<string, string>>>(str)
                           ?? new List<Dictionary<string, string>>();
                }
                catch
                {
                    // Corrupted data — start fresh
                }
            }
        }
        return new List<Dictionary<string, string>>();
    }

    /// <summary>
    /// Write the list of captured tool calls back to the execution context.
    /// </summary>
    public static void SetCaptures(ExecutionContext context, List<Dictionary<string, string>> captures)
    {
        context.Variables[CapturedToolCallsKey] = JsonSerializer.Serialize(captures);
    }
}
