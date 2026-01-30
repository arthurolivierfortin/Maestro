using System.Text;
using Maestro.Application.Interfaces;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;

namespace Maestro.Infrastructure.Sessions.CommandExecutors;

/// <summary>
/// Executes control commands within a session:
/// - /pause, /resume, /exit, /stop - Session lifecycle
/// - /status - Show session status
/// - /help - Show available commands
/// </summary>
public class ControlCommandExecutor : ICommandExecutor
{
    public bool CanHandle(SessionCommand command) =>
        command.Type == SessionCommandType.Control;

    public Task<CommandResult> ExecuteAsync(
        SessionCommand command,
        ISessionContext context,
        CancellationToken ct = default)
    {
        // Remove leading slash if present
        var cmd = command.Command.Trim().TrimStart('/').ToLowerInvariant();

        var result = cmd switch
        {
            "pause" => HandlePause(command),
            "resume" => HandleResume(command),
            "exit" or "stop" => HandleExit(command),
            "status" => HandleStatus(command, context),
            "help" => HandleHelp(command),
            _ => new CommandResult
            {
                Command = command,
                Success = false,
                Error = $"Unknown control command: {cmd}. Use /help to see available commands."
            }
        };

        return Task.FromResult(result);
    }

    private static CommandResult HandlePause(SessionCommand command)
    {
        return new CommandResult
        {
            Command = command,
            Success = true,
            Output = "Session pause requested. Use '/resume' to continue.",
            Data = new Dictionary<string, object> { ["action"] = "pause" }
        };
    }

    private static CommandResult HandleResume(SessionCommand command)
    {
        return new CommandResult
        {
            Command = command,
            Success = true,
            Output = "Session resumed.",
            Data = new Dictionary<string, object> { ["action"] = "resume" }
        };
    }

    private static CommandResult HandleExit(SessionCommand command)
    {
        return new CommandResult
        {
            Command = command,
            Success = true,
            Output = "Session exit requested.",
            Data = new Dictionary<string, object> { ["action"] = "exit" }
        };
    }

    private static CommandResult HandleStatus(SessionCommand command, ISessionContext context)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Session Status:");
        sb.AppendLine($"  ID:           {context.SessionId}");
        sb.AppendLine($"  Type:         {context.SessionType}");
        sb.AppendLine($"  Project:      {context.ProjectId ?? "N/A"}");
        sb.AppendLine($"  Working Dir:  {context.WorkingDirectory}");
        sb.AppendLine($"  Access Level: {context.AccessLevel}");
        sb.AppendLine($"  Blocks:       {context.BlockRegistry?.Count ?? 0}");

        return new CommandResult
        {
            Command = command,
            Success = true,
            Output = sb.ToString()
        };
    }

    private static CommandResult HandleHelp(SessionCommand command)
    {
        var help = @"
Session Commands:

SHELL COMMANDS (executed in project directory):
  ls, cd, pwd, cat, grep, find, git ...

MAESTRO COMMANDS:
  blocks list              List available blocks in session
  blocks info <id>         Show block details
  blocks add <id>          Add block to session
  blocks remove <id>       Remove block from session

  agents list              List available agents
  agents run <id> --task   Run an agent with a task
  agents status <exec-id>  Check agent status
  agents stop <exec-id>    Stop a running agent

  monitor                  Watch all session activity
  events [--limit N]       View event history

  permissions show         Show current permissions

  diff                     Show all changes
  test                     Run tests
  lint                     Run linter
  commit --message ""...""   Commit changes

CONTROL COMMANDS (prefix with / for clarity):
  /status                  Show session status
  /help                    Show this help
  /pause                   Pause the session
  /resume                  Resume the session
  /exit                    Exit/stop the session
";

        return new CommandResult
        {
            Command = command,
            Success = true,
            Output = help
        };
    }
}
