using Maestro.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Cli;

/// <summary>
/// Executes CLI commands with permission enforcement.
/// Routes commands to appropriate handlers after permission checks.
/// </summary>
public class CliExecutor : ICliExecutor
{
    private readonly IPermissionChecker _permissionChecker;
    private readonly Dictionary<string, ICommandHandler> _handlers;
    private readonly ILogger<CliExecutor> _logger;

    public CliExecutor(
        IPermissionChecker permissionChecker,
        IEnumerable<ICommandHandler> handlers,
        ILogger<CliExecutor> logger)
    {
        _permissionChecker = permissionChecker;
        _handlers = handlers.ToDictionary(h => h.Verb, StringComparer.OrdinalIgnoreCase);
        _logger = logger;

        _logger.LogInformation(
            "CLI Executor initialized with {Count} handlers: {Verbs}",
            _handlers.Count,
            string.Join(", ", _handlers.Keys));
    }

    public async Task<CliResult> ExecuteAsync(
        string command,
        CliExecutionContext context,
        CancellationToken ct = default)
    {
        _logger.LogDebug(
            "Executing command: {Command} in context: WorkspaceId={WorkspaceId}, SessionId={SessionId}",
            command, context.WorkspaceId, context.SessionId);

        // 1. Parse command
        var parsed = CliParser.Parse(command);
        if (string.IsNullOrEmpty(parsed.Verb))
        {
            return CliResult.Failure("Empty command");
        }

        // 2. Load context permissions
        var permissions = await _permissionChecker.GetPermissionsAsync(context, ct);

        // 3. Check command permission
        if (!permissions.HasCommand(parsed.Verb))
        {
            _logger.LogWarning(
                "Permission denied for command '{Verb}' in context WorkspaceId={WorkspaceId}, SessionId={SessionId}",
                parsed.Verb, context.WorkspaceId, context.SessionId);
            return CliResult.PermissionDenied($"Command '{parsed.Verb}' not allowed in this context");
        }

        // 4. For 'run' command, also check target permission
        if (parsed.Verb.Equals("run", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(parsed.Target))
        {
            var target = parsed.Target;

            // Check if it's a tool or block
            var hasToolAccess = permissions.HasTool(target);
            var hasBlockAccess = permissions.HasBlock(target);

            if (!hasToolAccess && !hasBlockAccess)
            {
                _logger.LogWarning(
                    "Permission denied for target '{Target}' in context WorkspaceId={WorkspaceId}, SessionId={SessionId}",
                    target, context.WorkspaceId, context.SessionId);
                return CliResult.PermissionDenied($"Access denied to '{target}'");
            }
        }

        // 5. Route to handler
        if (!_handlers.TryGetValue(parsed.Verb, out var handler))
        {
            _logger.LogWarning("Unknown command verb: {Verb}", parsed.Verb);
            return CliResult.Failure($"Unknown command: {parsed.Verb}. Use 'help' to see available commands.");
        }

        // 6. Execute handler
        try
        {
            var result = await handler.HandleAsync(parsed, context, permissions, ct);

            _logger.LogDebug(
                "Command '{Verb}' completed with success={Success}",
                parsed.Verb, result.Success);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing command '{Verb}'", parsed.Verb);
            return CliResult.Failure($"Command failed: {ex.Message}");
        }
    }
}
