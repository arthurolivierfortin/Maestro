namespace Maestro.Application.Interfaces;

/// <summary>
/// Executes CLI commands with permission enforcement.
/// </summary>
public interface ICliExecutor
{
    /// <summary>
    /// Executes a CLI command within a given context.
    /// </summary>
    Task<CliResult> ExecuteAsync(string command, CliExecutionContext context, CancellationToken ct = default);
}

/// <summary>
/// Result of a CLI command execution.
/// </summary>
public record CliResult
{
    public bool Success { get; init; }
    public object? Output { get; init; }
    public string? Error { get; init; }
    public int ExitCode { get; init; }

    public static CliResult Ok(object? output = null) => new()
    {
        Success = true,
        Output = output,
        ExitCode = 0
    };

    public static CliResult Failure(string error, int exitCode = 1) => new()
    {
        Success = false,
        Error = error,
        ExitCode = exitCode
    };

    public static CliResult PermissionDenied(string message) => new()
    {
        Success = false,
        Error = message,
        ExitCode = 403
    };
}

/// <summary>
/// Context for CLI command execution.
/// </summary>
public record CliExecutionContext
{
    public string? WorkspaceId { get; init; }
    public string? SessionId { get; init; }
    public string? AgentId { get; init; }
}
