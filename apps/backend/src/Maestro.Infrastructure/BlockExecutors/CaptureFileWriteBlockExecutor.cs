using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Phase 62-A: Captures file-write calls without writing to disk.
/// Used by contract tests via _toolMapping to verify what agents write.
/// Stores captures in context.Variables["_capturedToolCalls"] as a JSON array.
/// </summary>
public class CaptureFileWriteBlockExecutor : IBlockExecutor
{
    public string SupportedType => "capture-file-write";

    public Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();

        var path = inputs.TryGetValue("path", out var pathObj) ? pathObj?.ToString() ?? "" : "";
        var content = inputs.TryGetValue("content", out var contentObj) ? contentObj?.ToString() ?? "" : "";

        if (string.IsNullOrEmpty(path))
        {
            result.Success = false;
            result.Outputs["error"] = "Missing required input: path";
            return Task.FromResult(result);
        }

        // Append to _capturedToolCalls
        var captures = CaptureHelper.GetCaptures(context);
        captures.Add(new Dictionary<string, string>
        {
            ["toolId"] = "file-write",
            ["path"] = path,
            ["content"] = content,
            ["timestamp"] = DateTime.UtcNow.ToString("o")
        });
        CaptureHelper.SetCaptures(context, captures);

        result.Outputs["result"] = $"File written: {path} ({content.Length} chars)";
        result.Outputs["path"] = path;
        result.Outputs["size"] = content.Length;
        result.Logs.Add($"[capture] file-write: {path} ({content.Length} chars)");

        return Task.FromResult(result);
    }
}
