using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Handles a specific CLI command verb.
/// </summary>
public interface ICommandHandler
{
    /// <summary>
    /// The command verb this handler processes (e.g., "run", "list-tools").
    /// </summary>
    string Verb { get; }

    /// <summary>
    /// Handles the parsed command.
    /// </summary>
    Task<CliResult> HandleAsync(
        ParsedCommand command,
        CliExecutionContext context,
        ContextPermissions permissions,
        CancellationToken ct = default);
}

/// <summary>
/// A parsed CLI command.
/// </summary>
public record ParsedCommand
{
    /// <summary>
    /// The command verb (e.g., "run", "list-tools", "data").
    /// </summary>
    public string Verb { get; init; } = string.Empty;

    /// <summary>
    /// The target of the command (e.g., block ID for "run", subcommand for "data").
    /// </summary>
    public string? Target { get; init; }

    /// <summary>
    /// Named arguments (--key value).
    /// </summary>
    public Dictionary<string, string> Arguments { get; init; } = new();

    /// <summary>
    /// Positional arguments after the target.
    /// </summary>
    public List<string> PositionalArgs { get; init; } = new();

    /// <summary>
    /// Flags (--flag without value).
    /// </summary>
    public HashSet<string> Flags { get; init; } = new();

    /// <summary>
    /// The original raw command string.
    /// </summary>
    public string RawCommand { get; init; } = string.Empty;
}
