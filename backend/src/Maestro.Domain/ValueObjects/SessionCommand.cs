using Maestro.Domain.Enums;

namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Represents a command executed within a session.
/// </summary>
public sealed class SessionCommand
{
    /// <summary>
    /// Unique identifier for this command execution.
    /// </summary>
    public string Id { get; }

    /// <summary>
    /// Type of command (Shell, Maestro, Control).
    /// </summary>
    public SessionCommandType Type { get; }

    /// <summary>
    /// The raw command string.
    /// </summary>
    public string Command { get; }

    /// <summary>
    /// Parsed arguments from the command.
    /// </summary>
    public IReadOnlyDictionary<string, object> Args { get; }

    /// <summary>
    /// When the command was submitted.
    /// </summary>
    public DateTime SubmittedAt { get; }

    /// <summary>
    /// When the command started executing.
    /// </summary>
    public DateTime? StartedAt { get; private set; }

    /// <summary>
    /// When the command completed.
    /// </summary>
    public DateTime? CompletedAt { get; private set; }

    /// <summary>
    /// Whether the command completed successfully.
    /// </summary>
    public bool? Success { get; private set; }

    /// <summary>
    /// Output from the command execution.
    /// </summary>
    public string? Output { get; private set; }

    /// <summary>
    /// Error message if the command failed.
    /// </summary>
    public string? Error { get; private set; }

    /// <summary>
    /// Exit code for shell commands.
    /// </summary>
    public int? ExitCode { get; private set; }

    private SessionCommand(SessionCommandType type, string command, IDictionary<string, object>? args = null)
    {
        Id = Guid.NewGuid().ToString("N")[..12];
        Type = type;
        Command = command ?? throw new ArgumentNullException(nameof(command));
        Args = args != null ? new Dictionary<string, object>(args) : new Dictionary<string, object>();
        SubmittedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Creates a shell command.
    /// </summary>
    public static SessionCommand Shell(string command) =>
        new(SessionCommandType.Shell, command);

    /// <summary>
    /// Creates a Maestro command.
    /// </summary>
    public static SessionCommand Maestro(string command, IDictionary<string, object>? args = null) =>
        new(SessionCommandType.Maestro, command, args);

    /// <summary>
    /// Creates a control command (pause, resume, exit).
    /// </summary>
    public static SessionCommand Control(string command) =>
        new(SessionCommandType.Control, command);

    /// <summary>
    /// Parses a command string and creates the appropriate SessionCommand.
    /// </summary>
    public static SessionCommand Parse(string input)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(input);

        var trimmed = input.Trim();

        // Control commands (with or without leading /)
        // These are session lifecycle and info commands
        var controlCommands = new[] { "pause", "resume", "exit", "stop", "status", "help" };
        var normalizedCmd = trimmed.TrimStart('/').Split(' ')[0].ToLowerInvariant();

        // Commands starting with / or matching control commands are control commands
        if (controlCommands.Contains(normalizedCmd))
            return Control(trimmed);

        // Maestro commands (start with known prefixes)
        var maestroCommands = new[] { "blocks", "agents", "monitor", "permissions", "diff", "test", "lint", "commit", "draft", "train", "eval", "improve", "metrics", "publish", "events" };
        var firstWord = trimmed.Split(' ')[0].ToLowerInvariant();
        if (maestroCommands.Contains(firstWord))
            return Maestro(trimmed);

        // Everything else is a shell command
        return Shell(trimmed);
    }

    /// <summary>
    /// Marks the command as started.
    /// </summary>
    public void MarkStarted()
    {
        StartedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Marks the command as completed successfully.
    /// </summary>
    public void MarkCompleted(string? output = null, int? exitCode = null)
    {
        CompletedAt = DateTime.UtcNow;
        Success = true;
        Output = output;
        ExitCode = exitCode;
    }

    /// <summary>
    /// Marks the command as failed.
    /// </summary>
    public void MarkFailed(string error, int? exitCode = null)
    {
        CompletedAt = DateTime.UtcNow;
        Success = false;
        Error = error;
        ExitCode = exitCode;
    }

    /// <summary>
    /// Duration of the command execution in milliseconds.
    /// </summary>
    public long? DurationMs => StartedAt.HasValue && CompletedAt.HasValue
        ? (long)(CompletedAt.Value - StartedAt.Value).TotalMilliseconds
        : null;
}
