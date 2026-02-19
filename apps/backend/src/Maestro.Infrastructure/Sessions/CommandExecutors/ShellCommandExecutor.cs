using System.Diagnostics;
using System.Text;
using Maestro.Application.Interfaces;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Sessions.CommandExecutors;

/// <summary>
/// Executes shell commands (ls, cd, cat, git, npm, etc.) within a session context.
/// </summary>
public class ShellCommandExecutor : ICommandExecutor
{
    private readonly ILogger<ShellCommandExecutor> _logger;

    // Commands that are always allowed
    private static readonly HashSet<string> SafeReadCommands = new(StringComparer.OrdinalIgnoreCase)
    {
        "ls", "dir", "pwd", "cat", "head", "tail", "less", "more",
        "find", "grep", "rg", "ag", "fd",
        "git status", "git diff", "git log", "git branch", "git show", "git remote",
        "echo", "type", "tree"
    };

    // Commands that are always denied
    private static readonly HashSet<string> DangerousCommands = new(StringComparer.OrdinalIgnoreCase)
    {
        "rm -rf /", "rm -rf /*", "del /s /q c:\\*",
        "shutdown", "reboot", "halt", "poweroff",
        "format", "fdisk", "mkfs",
        ":(){:|:&};:" // fork bomb
    };

    public ShellCommandExecutor(ILogger<ShellCommandExecutor> logger)
    {
        _logger = logger;
    }

    public bool CanHandle(SessionCommand command) =>
        command.Type == SessionCommandType.Shell;

    public async Task<CommandResult> ExecuteAsync(
        SessionCommand command,
        ISessionContext context,
        CancellationToken ct = default)
    {
        // Check for dangerous commands
        if (IsDangerousCommand(command.Command))
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = "This command is not allowed for security reasons."
            };
        }

        // Check access level
        if (context.AccessLevel == AccessLevel.ReadOnly && !IsReadOnlyCommand(command.Command))
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = "Session has read-only access. This command requires write permissions."
            };
        }

        // Handle cd command specially - it changes the working directory
        if (command.Command.Trim().StartsWith("cd ", StringComparison.OrdinalIgnoreCase))
        {
            return HandleCdCommand(command, context);
        }

        // Handle pwd command
        if (command.Command.Trim().Equals("pwd", StringComparison.OrdinalIgnoreCase))
        {
            return new CommandResult
            {
                Command = command,
                Success = true,
                Output = context.WorkingDirectory,
                ExitCode = 0
            };
        }

        // Execute the command
        try
        {
            var result = await ExecuteShellCommandAsync(
                context.WorkingDirectory,
                command.Command,
                ct);

            return new CommandResult
            {
                Command = command,
                Success = result.ExitCode == 0,
                Output = result.StandardOutput,
                Error = result.ExitCode != 0 ? result.StandardError : null,
                ExitCode = result.ExitCode
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Shell command execution failed: {Command}", command.Command);
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = ex.Message,
                ExitCode = -1
            };
        }
    }

    private CommandResult HandleCdCommand(SessionCommand command, ISessionContext context)
    {
        var path = command.Command.Trim().Substring(3).Trim();

        // Handle special paths
        if (path == "~" || string.IsNullOrEmpty(path))
        {
            path = context.ProjectPath ?? Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        }
        else if (path == "-")
        {
            // Go to previous directory - not implemented, just stay in current
            path = context.WorkingDirectory;
        }
        else if (!Path.IsPathRooted(path))
        {
            // Relative path - resolve against current working directory
            path = Path.GetFullPath(Path.Combine(context.WorkingDirectory, path));
        }

        // Validate path is within project (for security)
        if (context.ProjectPath != null)
        {
            var normalizedProjectPath = Path.GetFullPath(context.ProjectPath);
            var normalizedTargetPath = Path.GetFullPath(path);

            if (!normalizedTargetPath.StartsWith(normalizedProjectPath, StringComparison.OrdinalIgnoreCase))
            {
                return new CommandResult
                {
                    Command = command,
                    Success = false,
                    Error = $"Cannot navigate outside project directory: {context.ProjectPath}",
                    ExitCode = 1
                };
            }
        }

        // Check if directory exists
        if (!Directory.Exists(path))
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = $"cd: no such file or directory: {path}",
                ExitCode = 1
            };
        }

        // Change directory
        context.SetWorkingDirectory(path);

        return new CommandResult
        {
            Command = command,
            Success = true,
            Output = path,
            ExitCode = 0
        };
    }

    private static bool IsDangerousCommand(string command)
    {
        var normalizedCommand = command.Trim().ToLowerInvariant();

        foreach (var dangerous in DangerousCommands)
        {
            if (normalizedCommand.Contains(dangerous, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    private static bool IsReadOnlyCommand(string command)
    {
        var firstWord = command.Trim().Split(' ')[0].ToLowerInvariant();
        var firstTwoWords = string.Join(" ", command.Trim().Split(' ').Take(2)).ToLowerInvariant();

        return SafeReadCommands.Contains(firstWord) || SafeReadCommands.Contains(firstTwoWords);
    }

    private async Task<ShellResult> ExecuteShellCommandAsync(
        string workingDirectory,
        string command,
        CancellationToken ct)
    {
        var isWindows = OperatingSystem.IsWindows();
        var shell = isWindows ? "cmd.exe" : "/bin/bash";
        var shellArgs = isWindows ? $"/c {command}" : $"-c \"{command.Replace("\"", "\\\"")}\"";

        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = shell,
                Arguments = shellArgs,
                WorkingDirectory = workingDirectory,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };

        var stdout = new StringBuilder();
        var stderr = new StringBuilder();

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data != null) stdout.AppendLine(e.Data);
        };
        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data != null) stderr.AppendLine(e.Data);
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        try
        {
            await process.WaitForExitAsync(ct);
        }
        catch (OperationCanceledException)
        {
            process.Kill(true);
            throw;
        }

        return new ShellResult
        {
            ExitCode = process.ExitCode,
            StandardOutput = stdout.ToString().TrimEnd(),
            StandardError = stderr.ToString().TrimEnd()
        };
    }

    private record ShellResult
    {
        public int ExitCode { get; init; }
        public string StandardOutput { get; init; } = string.Empty;
        public string StandardError { get; init; } = string.Empty;
    }
}
