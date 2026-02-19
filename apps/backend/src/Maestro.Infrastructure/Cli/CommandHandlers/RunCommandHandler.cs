using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Maestro.Infrastructure.BlockExecutors;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Cli.CommandHandlers;

/// <summary>
/// Handles the 'run' command to execute blocks.
/// Usage: run <block-id> [--input key=value] [--input-json {...}]
/// </summary>
public class RunCommandHandler : ICommandHandler
{
    private readonly IWorkspaceBlockResolver _blockResolver;
    private readonly IBlockRepository _blockRepository;
    private readonly BlockExecutorRegistry _executorRegistry;
    private readonly ILogger<RunCommandHandler> _logger;

    public string Verb => "run";

    public RunCommandHandler(
        IWorkspaceBlockResolver blockResolver,
        IBlockRepository blockRepository,
        BlockExecutorRegistry executorRegistry,
        ILogger<RunCommandHandler> logger)
    {
        _blockResolver = blockResolver;
        _blockRepository = blockRepository;
        _executorRegistry = executorRegistry;
        _logger = logger;
    }

    public async Task<CliResult> HandleAsync(
        ParsedCommand command,
        CliExecutionContext context,
        ContextPermissions permissions,
        CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(command.Target))
        {
            return CliResult.Failure("Usage: run <block-id> [--input key=value]");
        }

        var blockId = command.Target;

        // Load block with workspace-first resolution
        var block = await _blockResolver.ResolveAsync(blockId, context.WorkspaceId, ct);
        if (block == null)
        {
            // Fallback to direct repository lookup for backwards compatibility
            block = await _blockRepository.GetByIdAsync(blockId, ct);
        }
        if (block == null)
        {
            return CliResult.Failure($"Block not found: {blockId}");
        }

        // Log if using workspace override
        if (block.Metadata?.ContainsKey("_isWorkspaceBlock") == true)
        {
            _logger.LogInformation(
                "Using workspace-local block {BlockId} from workspace {WorkspaceId}",
                blockId, context.WorkspaceId);
        }

        // Parse inputs
        var inputs = new Dictionary<string, object>();

        // Handle --input key=value arguments
        foreach (var arg in command.Arguments)
        {
            if (arg.Key.Equals("input", StringComparison.OrdinalIgnoreCase))
            {
                var parts = arg.Value.Split('=', 2);
                if (parts.Length == 2)
                {
                    inputs[parts[0]] = parts[1];
                }
            }
            else if (arg.Key.Equals("input-json", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    // Sanitize JSON: escape literal newlines inside string values
                    // (LLMs often produce JSON with unescaped newlines in strings)
                    var sanitized = SanitizeJsonNewlines(arg.Value);
                    var jsonInputs = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(sanitized);
                    if (jsonInputs != null)
                    {
                        foreach (var kv in jsonInputs)
                        {
                            inputs[kv.Key] = kv.Value;
                        }
                    }
                }
                catch (Exception ex)
                {
                    return CliResult.Failure($"Invalid JSON input: {ex.Message}");
                }
            }
        }

        _logger.LogInformation(
            "Run command for block {BlockId} (type={BlockType}) with {InputCount} inputs",
            blockId, block.BlockType, inputs.Count);

        // Find the appropriate executor for this block type
        var executor = _executorRegistry.Get(block.BlockType);
        if (executor == null)
        {
            return CliResult.Failure($"No executor found for block type '{block.BlockType}'. Block '{blockId}' cannot be executed.");
        }

        // Build execution context
        var execContext = new Maestro.Domain.Entities.ExecutionContext();
        if (!string.IsNullOrEmpty(context.WorkspaceId))
            execContext.Variables["workspaceId"] = context.WorkspaceId;
        if (!string.IsNullOrEmpty(context.SessionId))
            execContext.Variables["sessionId"] = context.SessionId;
        if (!string.IsNullOrEmpty(context.AgentId))
            execContext.Variables["agentId"] = context.AgentId;

        // Execute the block synchronously
        try
        {
            var result = await executor.ExecuteAsync(block, execContext, inputs, ct);

            if (result.Success)
            {
                // Return outputs directly for agent consumption
                return CliResult.Ok(result.Outputs.Count > 0 ? (object)result.Outputs : new { status = "done", message = "Block executed successfully" });
            }
            else
            {
                // Include log messages for better agent feedback
                var errorMsg = result.Outputs.TryGetValue("error", out var err) ? err?.ToString() : null;
                if (string.IsNullOrEmpty(errorMsg) && result.Logs.Count > 0)
                    errorMsg = string.Join("; ", result.Logs);
                return CliResult.Failure(errorMsg ?? "Block execution failed");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Block execution failed: {BlockId}", blockId);
            return CliResult.Failure($"Block execution error: {ex.Message}");
        }
    }

    /// <summary>
    /// Sanitize JSON that may contain literal newlines inside string values.
    /// LLMs often produce JSON like {"content":"line1\nline2"} with actual newline characters
    /// instead of escaped \\n. This walks the string and escapes newlines found inside quotes.
    /// </summary>
    private static string SanitizeJsonNewlines(string json)
    {
        if (string.IsNullOrEmpty(json) || (!json.Contains('\n') && !json.Contains('\r')))
            return json;

        var sb = new System.Text.StringBuilder(json.Length + 64);
        var inString = false;
        var escaped = false;

        for (int i = 0; i < json.Length; i++)
        {
            var c = json[i];

            if (escaped)
            {
                sb.Append(c);
                escaped = false;
                continue;
            }

            if (c == '\\' && inString)
            {
                sb.Append(c);
                escaped = true;
                continue;
            }

            if (c == '"')
            {
                inString = !inString;
                sb.Append(c);
                continue;
            }

            if (inString && (c == '\n' || c == '\r'))
            {
                // Replace literal newline with escaped version
                if (c == '\r' && i + 1 < json.Length && json[i + 1] == '\n')
                {
                    sb.Append("\\n");
                    i++; // skip the \n after \r
                }
                else if (c == '\n')
                {
                    sb.Append("\\n");
                }
                else
                {
                    sb.Append("\\r");
                }
                continue;
            }

            sb.Append(c);
        }

        return sb.ToString();
    }
}
