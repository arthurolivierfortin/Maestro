using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Writes a block definition (and optional system prompt) to the proper directory structure.
/// Encapsulates the convention: content/system/blocks/{category}/{blockId}/{blockId}.{blockType}.block.json
/// Also writes system-prompt.md if provided.
/// </summary>
public class WriteBlockBlockExecutor : IBlockExecutor
{
    public string SupportedType => "write-block";

    public Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var result = new BlockExecutionResult();
        var blockJson = inputs.TryGetValue("blockJson", out var bj) ? bj?.ToString() ?? "" : "";
        var systemPrompt = inputs.TryGetValue("systemPrompt", out var sp) ? sp?.ToString() ?? "" : "";

        if (string.IsNullOrEmpty(blockJson))
        {
            result.Success = false;
            result.Outputs["error"] = "Missing required input: blockJson";
            return Task.FromResult(result);
        }

        // Strip markdown code fences if present (LLM output often wraps JSON in ```json...```)
        var cleaned = LLMBlockExecutorBase.ExtractJson(blockJson);
        if (cleaned != null)
            blockJson = cleaned;

        // Extract block info from JSON
        string blockId, blockType;
        try
        {
            using var doc = JsonDocument.Parse(blockJson);
            blockId = doc.RootElement.GetProperty("id").GetString() ?? "";
            blockType = doc.RootElement.GetProperty("blockType").GetString() ?? "agent";

            if (string.IsNullOrEmpty(blockId))
            {
                result.Success = false;
                result.Outputs["error"] = "Block JSON missing 'id' field";
                return Task.FromResult(result);
            }
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Outputs["error"] = $"Invalid block JSON: {ex.Message}";
            return Task.FromResult(result);
        }

        // Resolve output directory: content/system/blocks/{type-category}/{blockId}/
        var workingDir = context.Variables.TryGetValue("workingDir", out var wd) ? wd?.ToString() ?? "" : Directory.GetCurrentDirectory();
        var typeCategory = blockType switch
        {
            "agent" => "agents",
            "workflow" => "workflows",
            "tool" or "capture-file-write" or "capture-file-read" or "capture-file-edit"
                or "capture-shell-execute" or "capture-generic"
                or "read-contract" or "write-contract" or "read-test-suite"
                or "write-test-suite" or "write-block" => "tools",
            "inference" => "inference",
            _ => "agents"
        };
        var blockDir = Path.Combine(workingDir, "content", "system", "blocks", typeCategory, blockId);
        Directory.CreateDirectory(blockDir);

        // Write block.json
        var blockJsonPath = Path.Combine(blockDir, $"{blockId}.{blockType}.block.json");
        File.WriteAllText(blockJsonPath, blockJson);

        // Write system-prompt.md if provided
        var promptPath = "";
        if (!string.IsNullOrEmpty(systemPrompt))
        {
            promptPath = Path.Combine(blockDir, "system-prompt.md");
            File.WriteAllText(promptPath, systemPrompt);
        }

        result.Outputs["blockId"] = blockId;
        result.Outputs["blockPath"] = blockDir;
        result.Outputs["result"] = $"Block written: {blockDir}";
        result.Logs.Add($"[write-block] Wrote {blockJsonPath}" + (promptPath != "" ? $" + {promptPath}" : ""));
        return Task.FromResult(result);
    }
}
