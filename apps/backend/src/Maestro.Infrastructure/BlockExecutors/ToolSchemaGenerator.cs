using System.Text;
using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Phase 62-C: Generates the "Available Tools" markdown section for an agent's system prompt.
/// Reads tool descriptions and input schemas from their block.json files on disk.
/// Only includes tools that are in the AllowedBlocks list from session permissions.
///
/// Architecture decisions:
/// - step-complete is EXCLUDED (it stays static in each agent's system-prompt.md because its args vary per agent)
/// - When _toolMapping is present, schemas are generated from the ORIGINAL tool names (file-write, not capture-file-write)
/// - Internal plumbing blocks (conversation-read, conversation-append, tool-dispatcher, response-parser, inference, message-builder) are excluded
/// - If a block.json has no "inputs" field, a minimal entry (name + description, no args) is generated
/// </summary>
public class ToolSchemaGenerator
{
    private readonly IBlockDiscoveryService _blockDiscovery;
    private readonly ILogger<ToolSchemaGenerator>? _logger;

    /// <summary>
    /// Block types that are internal agent infrastructure plumbing.
    /// These should never appear in an agent's tool list — they are used in config.nodes, not called by the agent.
    /// </summary>
    private static readonly HashSet<string> InternalBlockTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "conversation-read", "conversation-append", "tool-dispatcher", "response-parser",
        "inference", "message-builder", "prompt"
    };

    /// <summary>
    /// Block IDs that are internal infrastructure and should never be listed as agent tools.
    /// </summary>
    private static readonly HashSet<string> InternalBlockIds = new(StringComparer.OrdinalIgnoreCase)
    {
        "conversation-read", "conversation-append", "tool-dispatcher", "response-parser",
        "inference", "message-builder", "step-complete"
    };

    public ToolSchemaGenerator(IBlockDiscoveryService blockDiscovery, ILogger<ToolSchemaGenerator>? logger = null)
    {
        _blockDiscovery = blockDiscovery ?? throw new ArgumentNullException(nameof(blockDiscovery));
        _logger = logger;
    }

    /// <summary>
    /// Generates the "Available Tools" markdown section for injection into an agent's system prompt.
    /// </summary>
    /// <param name="allowedBlocks">List of allowed block IDs from session permissions, or ["*"] for all</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Markdown string with tool schemas ready for prompt injection</returns>
    public async Task<string> GenerateToolsSectionAsync(
        List<string> allowedBlocks,
        CancellationToken ct = default)
    {
        var toolBlocks = await ResolveToolBlocks(allowedBlocks, ct);

        if (toolBlocks.Count == 0)
        {
            _logger?.LogWarning("ToolSchemaGenerator: No tool blocks found for allowed blocks: [{Blocks}]",
                string.Join(", ", allowedBlocks));
            return "No tools available.";
        }

        var sb = new StringBuilder();
        sb.AppendLine("You have access to these tools. Call ONE tool per response.");
        sb.AppendLine();

        foreach (var block in toolBlocks)
        {
            var schema = GenerateToolEntry(block);
            if (schema != null)
            {
                sb.AppendLine(schema);
                sb.AppendLine();
            }
        }

        return sb.ToString().TrimEnd();
    }

    /// <summary>
    /// Resolves the list of tool blocks based on allowed block IDs.
    /// If allowedBlocks contains "*", discovers all tool-type blocks.
    /// Otherwise, fetches each allowed block by ID.
    /// Filters out internal infrastructure blocks and step-complete.
    /// </summary>
    private async Task<List<BlockDefinition>> ResolveToolBlocks(
        List<string> allowedBlocks, CancellationToken ct)
    {
        var toolBlocks = new List<BlockDefinition>();

        if (allowedBlocks.Contains("*"))
        {
            // Wildcard: discover all blocks and filter to agent-facing tools
            var allBlocks = await _blockDiscovery.DiscoverAllAsync(ct);
            foreach (var block in allBlocks)
            {
                if (IsAgentFacingTool(block))
                    toolBlocks.Add(block);
            }
        }
        else
        {
            // Restricted list: fetch each allowed block by ID
            foreach (var blockId in allowedBlocks)
            {
                if (InternalBlockIds.Contains(blockId))
                    continue;

                var block = await _blockDiscovery.GetByIdAsync(blockId, ct);
                if (block == null)
                {
                    _logger?.LogDebug("ToolSchemaGenerator: Allowed block '{BlockId}' not found, skipping", blockId);
                    continue;
                }

                if (IsAgentFacingTool(block))
                    toolBlocks.Add(block);
            }
        }

        return toolBlocks;
    }

    /// <summary>
    /// Determines if a block is an agent-facing tool (something an agent can call via tool-dispatcher).
    /// Excludes internal plumbing blocks and capture blocks.
    /// </summary>
    private static bool IsAgentFacingTool(BlockDefinition block)
    {
        // Exclude by ID
        if (InternalBlockIds.Contains(block.Id))
            return false;

        // Exclude internal block types
        if (InternalBlockTypes.Contains(block.BlockType))
            return false;

        // Exclude capture blocks (these are mock implementations, not agent-facing)
        if (block.Id.StartsWith("capture-", StringComparison.OrdinalIgnoreCase))
            return false;

        // Exclude agents and workflows — they are not tools
        if (string.Equals(block.BlockType, "agent", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(block.BlockType, "workflow", StringComparison.OrdinalIgnoreCase))
            return false;

        return true;
    }

    /// <summary>
    /// Generates a single tool's markdown entry by reading its block.json from disk for the "inputs" field.
    /// </summary>
    private string? GenerateToolEntry(BlockDefinition block)
    {
        var blockPath = LLMBlockExecutorBase.GetBlockPath(block);
        List<ToolInput>? inputs = null;

        if (blockPath != null)
        {
            inputs = ReadInputsFromBlockJson(blockPath, block.Id);
        }

        // If no path or no inputs from disk, try to use the block's description only
        var description = block.Description ?? $"Tool: {block.Id}";

        var sb = new StringBuilder();
        sb.AppendLine($"### {block.Id}");
        sb.AppendLine(description);

        // Build the JSON schema args
        var argParts = new List<string>();
        if (inputs != null && inputs.Count > 0)
        {
            foreach (var input in inputs)
            {
                // Skip internal args that agents don't set (like workingDir, encoding, createDirectories, mode)
                // These are set by infrastructure, not by the agent
                if (IsInternalArg(input.Id))
                    continue;

                var typeStr = input.Type ?? "string";
                var reqStr = input.Required ? ", required" : "";
                var desc = input.Description ?? input.Id;
                argParts.Add($"\"{input.Id}\": \"<{typeStr}{reqStr}> {desc}\"");
            }
        }

        sb.AppendLine("```json");
        if (argParts.Count > 0)
        {
            sb.AppendLine($"{{\"tool\": \"{block.Id}\", \"args\": {{{string.Join(", ", argParts)}}}}}");
        }
        else
        {
            sb.AppendLine($"{{\"tool\": \"{block.Id}\", \"args\": {{}}}}");
        }
        sb.Append("```");

        return sb.ToString();
    }

    /// <summary>
    /// Returns true for tool arguments that are set by infrastructure, not by agents.
    /// Agents should not see these in their tool schemas.
    /// </summary>
    private static bool IsInternalArg(string argId)
    {
        return argId switch
        {
            "workingDir" => true,
            "encoding" => true,
            "createDirectories" => true,
            "mode" => true,
            "env" => true,
            "replace_all" => true,
            _ => false
        };
    }

    /// <summary>
    /// Reads the "inputs" array from the block.json file on disk.
    /// Returns null if the file doesn't exist or has no "inputs" field.
    /// This reads the raw JSON because BlockDefinition does not load the inputs field.
    /// </summary>
    private List<ToolInput>? ReadInputsFromBlockJson(string blockFolderPath, string blockId)
    {
        // block.json could be in the folder directly or named {id}.*.block.json
        string? blockJsonPath = null;

        // Check for files matching *.block.json in the folder
        if (Directory.Exists(blockFolderPath))
        {
            var candidates = Directory.GetFiles(blockFolderPath, "*.block.json");
            if (candidates.Length > 0)
                blockJsonPath = candidates[0];
        }

        // Some tool blocks are flat files (not in a folder), like file-write.tool.block.json
        // In that case blockFolderPath is actually the parent directory
        if (blockJsonPath == null)
        {
            // Try parent directory for flat block files
            var parentDir = Path.GetDirectoryName(blockFolderPath);
            if (parentDir != null && Directory.Exists(parentDir))
            {
                var flatCandidates = Directory.GetFiles(parentDir, $"{blockId}*.block.json");
                if (flatCandidates.Length > 0)
                    blockJsonPath = flatCandidates[0];
            }
        }

        if (blockJsonPath == null || !File.Exists(blockJsonPath))
        {
            _logger?.LogDebug("ToolSchemaGenerator: No block.json found for '{BlockId}' at '{Path}'",
                blockId, blockFolderPath);
            return null;
        }

        try
        {
            var json = File.ReadAllText(blockJsonPath);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("inputs", out var inputsElement) ||
                inputsElement.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            var inputs = new List<ToolInput>();
            foreach (var inputEl in inputsElement.EnumerateArray())
            {
                var input = new ToolInput
                {
                    Id = inputEl.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "" : "",
                    Type = inputEl.TryGetProperty("type", out var typeProp) ? typeProp.GetString() ?? "string" : "string",
                    Required = inputEl.TryGetProperty("required", out var reqProp) && reqProp.GetBoolean(),
                    Description = inputEl.TryGetProperty("description", out var descProp) ? descProp.GetString() ?? "" : ""
                };
                inputs.Add(input);
            }

            return inputs;
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "ToolSchemaGenerator: Failed to parse block.json for '{BlockId}'", blockId);
            return null;
        }
    }

    private class ToolInput
    {
        public string Id { get; set; } = "";
        public string Type { get; set; } = "string";
        public bool Required { get; set; }
        public string Description { get; set; } = "";
    }
}
