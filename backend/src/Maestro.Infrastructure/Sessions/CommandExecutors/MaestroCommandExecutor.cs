using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.Enums;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Sessions.CommandExecutors;

/// <summary>
/// Executes Maestro commands (blocks, agents, monitor, permissions, diff, test, commit, etc.).
/// </summary>
public class MaestroCommandExecutor : ICommandExecutor
{
    private readonly IBlockRepository _blockRepository;
    private readonly ILogger<MaestroCommandExecutor> _logger;

    public MaestroCommandExecutor(
        IBlockRepository blockRepository,
        ILogger<MaestroCommandExecutor> logger)
    {
        _blockRepository = blockRepository;
        _logger = logger;
    }

    public bool CanHandle(SessionCommand command) =>
        command.Type == SessionCommandType.Maestro;

    public async Task<CommandResult> ExecuteAsync(
        SessionCommand command,
        ISessionContext context,
        CancellationToken ct = default)
    {
        var parts = command.Command.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0)
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = "Empty command"
            };
        }

        var mainCommand = parts[0].ToLowerInvariant();
        var subCommand = parts.Length > 1 ? parts[1].ToLowerInvariant() : null;
        var args = parts.Skip(2).ToArray();

        try
        {
            return mainCommand switch
            {
                "blocks" => await HandleBlocksCommand(command, context, subCommand, args, ct),
                "agents" => await HandleAgentsCommand(command, context, subCommand, args, ct),
                "monitor" => HandleMonitorCommand(command, context, args),
                "permissions" => HandlePermissionsCommand(command, context, subCommand, args),
                "diff" => await HandleDiffCommand(command, context, args, ct),
                "test" => await HandleTestCommand(command, context, args, ct),
                "lint" => await HandleLintCommand(command, context, args, ct),
                "commit" => await HandleCommitCommand(command, context, args, ct),
                "events" => HandleEventsCommand(command, context, args),
                _ => new CommandResult
                {
                    Command = command,
                    Success = false,
                    Error = $"Unknown Maestro command: {mainCommand}"
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Maestro command execution failed: {Command}", command.Command);
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = ex.Message
            };
        }
    }

    private async Task<CommandResult> HandleBlocksCommand(
        SessionCommand command,
        ISessionContext context,
        string? subCommand,
        string[] args,
        CancellationToken ct)
    {
        return subCommand switch
        {
            "list" => await ListBlocks(command, context, ct),
            "info" when args.Length > 0 => await GetBlockInfo(command, args[0], ct),
            "add" when args.Length > 0 => AddBlock(command, context, args[0]),
            "remove" when args.Length > 0 => RemoveBlock(command, context, args[0]),
            null or "list" => await ListBlocks(command, context, ct),
            _ => new CommandResult
            {
                Command = command,
                Success = false,
                Error = $"Unknown blocks subcommand: {subCommand}. Use: list, info, add, remove"
            }
        };
    }

    private async Task<CommandResult> ListBlocks(
        SessionCommand command,
        ISessionContext context,
        CancellationToken ct)
    {
        var allBlocks = await _blockRepository.GetAllAsync(ct);
        var availableBlockIds = context.BlockRegistry.AvailableBlocks;

        var output = new StringBuilder();
        output.AppendLine($"Available blocks in session ({availableBlockIds.Count} total):");
        output.AppendLine();

        var availableBlocks = allBlocks.Where(b => availableBlockIds.Contains(b.Id)).ToList();
        var groupedByType = availableBlocks.GroupBy(b => b.BlockType).OrderBy(g => g.Key);

        foreach (var group in groupedByType)
        {
            output.AppendLine($"[{group.Key}]");
            foreach (var block in group.OrderBy(b => b.Name))
            {
                output.AppendLine($"  {block.Id,-20} {block.Name}");
            }
            output.AppendLine();
        }

        return new CommandResult
        {
            Command = command,
            Success = true,
            Output = output.ToString().TrimEnd()
        };
    }

    private async Task<CommandResult> GetBlockInfo(
        SessionCommand command,
        string blockId,
        CancellationToken ct)
    {
        var blocks = await _blockRepository.GetAllAsync(ct);
        var block = blocks.FirstOrDefault(b =>
            b.Id.Equals(blockId, StringComparison.OrdinalIgnoreCase) ||
            b.Name.Equals(blockId, StringComparison.OrdinalIgnoreCase));

        if (block == null)
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = $"Block not found: {blockId}"
            };
        }

        var output = new StringBuilder();
        output.AppendLine($"Block: {block.Name}");
        output.AppendLine($"  ID:          {block.Id}");
        output.AppendLine($"  Type:        {block.BlockType}");
        output.AppendLine($"  Description: {block.Description ?? "N/A"}");
        output.AppendLine($"  Atomic:      {block.IsAtomic}");

        if (block.Config.Count > 0)
        {
            output.AppendLine($"  Config:");
            foreach (var kvp in block.Config.Take(5))
            {
                var value = kvp.Value?.ToString() ?? "null";
                if (value.Length > 50) value = value[..50] + "...";
                output.AppendLine($"    {kvp.Key}: {value}");
            }
            if (block.Config.Count > 5)
            {
                output.AppendLine($"    ... and {block.Config.Count - 5} more");
            }
        }

        return new CommandResult
        {
            Command = command,
            Success = true,
            Output = output.ToString().TrimEnd(),
            Data = block
        };
    }

    private CommandResult AddBlock(
        SessionCommand command,
        ISessionContext context,
        string blockId)
    {
        if (context.BlockRegistry.Contains(blockId))
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = $"Block {blockId} is already in the session"
            };
        }

        context.BlockRegistry.Add(blockId);

        return new CommandResult
        {
            Command = command,
            Success = true,
            Output = $"Block {blockId} added to session"
        };
    }

    private CommandResult RemoveBlock(
        SessionCommand command,
        ISessionContext context,
        string blockId)
    {
        if (!context.BlockRegistry.Contains(blockId))
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = $"Block {blockId} is not in the session"
            };
        }

        context.BlockRegistry.Remove(blockId);

        return new CommandResult
        {
            Command = command,
            Success = true,
            Output = $"Block {blockId} removed from session"
        };
    }

    private Task<CommandResult> HandleAgentsCommand(
        SessionCommand command,
        ISessionContext context,
        string? subCommand,
        string[] args,
        CancellationToken ct)
    {
        // Placeholder for agent management - will be expanded
        return Task.FromResult(new CommandResult
        {
            Command = command,
            Success = true,
            Output = $"Agents command: {subCommand} (not yet fully implemented)\nAvailable subcommands: list, run, stop, status"
        });
    }

    private CommandResult HandleMonitorCommand(
        SessionCommand command,
        ISessionContext context,
        string[] args)
    {
        // Monitor command just enables event streaming mode
        return new CommandResult
        {
            Command = command,
            Success = true,
            Output = "Monitoring mode enabled. Events will be streamed to your client.\nPress Ctrl+C or send 'exit' to stop monitoring."
        };
    }

    private CommandResult HandlePermissionsCommand(
        SessionCommand command,
        ISessionContext context,
        string? subCommand,
        string[] args)
    {
        if (subCommand == "show" || subCommand == null)
        {
            var output = new StringBuilder();
            output.AppendLine($"Session Permissions:");
            output.AppendLine($"  Access Level: {context.AccessLevel}");
            output.AppendLine($"  Available Blocks: {context.BlockRegistry.Count}");
            output.AppendLine();
            output.AppendLine("Agent Restrictions:");

            foreach (var kvp in context.BlockRegistry.AgentRestrictedBlocks)
            {
                output.AppendLine($"  {kvp.Key}: {kvp.Value.Count} blocks allowed");
            }

            return new CommandResult
            {
                Command = command,
                Success = true,
                Output = output.ToString().TrimEnd()
            };
        }

        // Handle set command
        if (subCommand == "set")
        {
            return new CommandResult
            {
                Command = command,
                Success = true,
                Output = "Permission set command (not yet fully implemented)\nUsage: permissions set --agent <id> --paths \"path1,path2\" --blocks \"block1,block2\""
            };
        }

        return new CommandResult
        {
            Command = command,
            Success = false,
            Error = $"Unknown permissions subcommand: {subCommand}. Use: show, set"
        };
    }

    private async Task<CommandResult> HandleDiffCommand(
        SessionCommand command,
        ISessionContext context,
        string[] args,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(context.ProjectPath))
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = "No project path configured for this session"
            };
        }

        var specificFile = args.Length > 0 ? args[0] : null;
        var gitCommand = specificFile != null
            ? $"git diff -- \"{specificFile}\""
            : "git diff";

        var result = await ExecuteGitCommandAsync(context.WorkingDirectory, gitCommand, ct);

        if (string.IsNullOrWhiteSpace(result.StandardOutput) && result.ExitCode == 0)
        {
            // Also check for untracked files
            var statusResult = await ExecuteGitCommandAsync(context.WorkingDirectory, "git status --porcelain", ct);
            if (string.IsNullOrWhiteSpace(statusResult.StandardOutput))
            {
                return new CommandResult
                {
                    Command = command,
                    Success = true,
                    Output = "No changes detected"
                };
            }

            return new CommandResult
            {
                Command = command,
                Success = true,
                Output = $"Status:\n{statusResult.StandardOutput}"
            };
        }

        return new CommandResult
        {
            Command = command,
            Success = result.ExitCode == 0,
            Output = result.StandardOutput,
            Error = result.ExitCode != 0 ? result.StandardError : null,
            ExitCode = result.ExitCode
        };
    }

    private async Task<CommandResult> HandleTestCommand(
        SessionCommand command,
        ISessionContext context,
        string[] args,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(context.ProjectPath))
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = "No project path configured for this session"
            };
        }

        // Parse --command option
        var testCommand = DetectTestCommand(context.WorkingDirectory);
        for (int i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == "--command")
            {
                testCommand = args[i + 1];
                break;
            }
        }

        if (string.IsNullOrEmpty(testCommand))
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = "No test command specified and could not auto-detect. Use: test --command \"npm test\""
            };
        }

        context.EmitEvent(SessionEvent.Info(context.SessionId, $"Running tests: {testCommand}"));

        var stopwatch = Stopwatch.StartNew();
        var result = await ExecuteShellCommandAsync(context.WorkingDirectory, testCommand, ct);
        stopwatch.Stop();

        var output = new StringBuilder();
        output.AppendLine($"Test command: {testCommand}");
        output.AppendLine($"Duration: {stopwatch.ElapsedMilliseconds}ms");
        output.AppendLine($"Exit code: {result.ExitCode}");
        output.AppendLine();
        output.AppendLine(result.StandardOutput);
        if (!string.IsNullOrEmpty(result.StandardError))
        {
            output.AppendLine("Errors:");
            output.AppendLine(result.StandardError);
        }

        return new CommandResult
        {
            Command = command,
            Success = result.ExitCode == 0,
            Output = output.ToString().TrimEnd(),
            ExitCode = result.ExitCode
        };
    }

    private async Task<CommandResult> HandleLintCommand(
        SessionCommand command,
        ISessionContext context,
        string[] args,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(context.ProjectPath))
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = "No project path configured for this session"
            };
        }

        // Parse --command option
        var lintCommand = DetectLintCommand(context.WorkingDirectory);
        for (int i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == "--command")
            {
                lintCommand = args[i + 1];
                break;
            }
        }

        if (string.IsNullOrEmpty(lintCommand))
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = "No lint command specified and could not auto-detect. Use: lint --command \"npm run lint\""
            };
        }

        context.EmitEvent(SessionEvent.Info(context.SessionId, $"Running linter: {lintCommand}"));

        var result = await ExecuteShellCommandAsync(context.WorkingDirectory, lintCommand, ct);

        return new CommandResult
        {
            Command = command,
            Success = result.ExitCode == 0,
            Output = result.StandardOutput,
            Error = result.ExitCode != 0 ? result.StandardError : null,
            ExitCode = result.ExitCode
        };
    }

    private async Task<CommandResult> HandleCommitCommand(
        SessionCommand command,
        ISessionContext context,
        string[] args,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(context.ProjectPath))
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = "No project path configured for this session"
            };
        }

        if (context.AccessLevel == AccessLevel.ReadOnly || context.AccessLevel == AccessLevel.Sandbox)
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = $"Cannot commit in {context.AccessLevel} mode"
            };
        }

        // Parse arguments
        string? message = null;
        bool push = false;

        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--message" || args[i] == "-m")
            {
                if (i + 1 < args.Length)
                {
                    message = args[i + 1];
                    i++;
                }
            }
            else if (args[i] == "--push")
            {
                push = true;
            }
        }

        if (string.IsNullOrEmpty(message))
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = "Commit message required. Use: commit --message \"Your message\""
            };
        }

        // Stage all changes
        await ExecuteGitCommandAsync(context.WorkingDirectory, "git add -A", ct);

        // Commit
        var escapedMessage = message.Replace("\"", "\\\"");
        var commitResult = await ExecuteGitCommandAsync(
            context.WorkingDirectory,
            $"git commit -m \"{escapedMessage}\"",
            ct);

        if (commitResult.ExitCode != 0)
        {
            return new CommandResult
            {
                Command = command,
                Success = false,
                Error = $"Commit failed: {commitResult.StandardError}",
                ExitCode = commitResult.ExitCode
            };
        }

        // Get commit hash
        var hashResult = await ExecuteGitCommandAsync(context.WorkingDirectory, "git rev-parse HEAD", ct);
        var commitHash = hashResult.StandardOutput.Trim();

        var output = new StringBuilder();
        output.AppendLine($"Committed: {commitHash[..7]}");
        output.AppendLine($"Message: {message}");

        // Push if requested
        if (push)
        {
            var branchResult = await ExecuteGitCommandAsync(
                context.WorkingDirectory,
                "git rev-parse --abbrev-ref HEAD",
                ct);
            var branch = branchResult.StandardOutput.Trim();

            var pushResult = await ExecuteGitCommandAsync(
                context.WorkingDirectory,
                $"git push -u origin {branch}",
                ct);

            if (pushResult.ExitCode == 0)
            {
                output.AppendLine($"Pushed to origin/{branch}");
            }
            else
            {
                output.AppendLine($"Push failed: {pushResult.StandardError}");
            }
        }

        context.EmitEvent(SessionEvent.Info(context.SessionId, $"Committed: {commitHash[..7]} - {message}"));

        return new CommandResult
        {
            Command = command,
            Success = true,
            Output = output.ToString().TrimEnd()
        };
    }

    private CommandResult HandleEventsCommand(
        SessionCommand command,
        ISessionContext context,
        string[] args)
    {
        return new CommandResult
        {
            Command = command,
            Success = true,
            Output = "Events are streamed via WebSocket. Use 'monitor' command to view real-time events."
        };
    }

    private static string? DetectTestCommand(string projectPath)
    {
        if (File.Exists(Path.Combine(projectPath, "package.json")))
            return "npm test";
        if (File.Exists(Path.Combine(projectPath, "pytest.ini")) ||
            File.Exists(Path.Combine(projectPath, "pyproject.toml")))
            return "pytest";
        if (Directory.GetFiles(projectPath, "*.csproj").Length > 0 ||
            Directory.GetFiles(projectPath, "*.sln").Length > 0)
            return "dotnet test";
        if (File.Exists(Path.Combine(projectPath, "pom.xml")))
            return "mvn test";
        if (File.Exists(Path.Combine(projectPath, "build.gradle")))
            return "gradle test";
        return null;
    }

    private static string? DetectLintCommand(string projectPath)
    {
        if (File.Exists(Path.Combine(projectPath, "package.json")))
            return "npm run lint";
        if (File.Exists(Path.Combine(projectPath, "pyproject.toml")))
            return "ruff check .";
        if (Directory.GetFiles(projectPath, "*.csproj").Length > 0)
            return "dotnet format --verify-no-changes";
        return null;
    }

    private async Task<ShellResult> ExecuteGitCommandAsync(
        string workingDirectory,
        string command,
        CancellationToken ct)
    {
        return await ExecuteShellCommandAsync(workingDirectory, command, ct);
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
