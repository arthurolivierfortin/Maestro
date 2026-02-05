using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Cli.CommandHandlers;

/// <summary>
/// Handles the 'help' command.
/// Shows available commands and usage information.
/// </summary>
public class HelpCommandHandler : ICommandHandler
{
    private readonly ILogger<HelpCommandHandler> _logger;

    public string Verb => "help";

    public HelpCommandHandler(ILogger<HelpCommandHandler> logger)
    {
        _logger = logger;
    }

    public Task<CliResult> HandleAsync(
        ParsedCommand command,
        CliExecutionContext context,
        ContextPermissions permissions,
        CancellationToken ct = default)
    {
        var topic = command.Target?.ToLowerInvariant();

        if (!string.IsNullOrEmpty(topic))
        {
            return Task.FromResult(GetTopicHelp(topic, permissions));
        }

        // General help
        var availableCommands = new List<object>();

        if (permissions.HasCommand("run"))
        {
            availableCommands.Add(new
            {
                command = "run",
                usage = "run <block-id> [--input key=value]",
                description = "Execute a block"
            });
        }

        if (permissions.HasCommand("list-tools"))
        {
            availableCommands.Add(new
            {
                command = "list-tools",
                usage = "list-tools",
                description = "List available tools"
            });
        }

        if (permissions.HasCommand("list-blocks"))
        {
            availableCommands.Add(new
            {
                command = "list-blocks",
                usage = "list-blocks [--type <type>]",
                description = "List available blocks"
            });
        }

        if (permissions.HasCommand("describe"))
        {
            availableCommands.Add(new
            {
                command = "describe",
                usage = "describe <block-id>",
                description = "Show block details"
            });
        }

        if (permissions.HasCommand("data"))
        {
            availableCommands.Add(new
            {
                command = "data",
                usage = "data <read|write|list|delete> <collection> [options]",
                description = "Manage workspace data"
            });
        }

        if (permissions.HasCommand("session"))
        {
            availableCommands.Add(new
            {
                command = "session",
                usage = "session <create|list|attach|end|info> [options]",
                description = "Manage sessions"
            });
        }

        availableCommands.Add(new
        {
            command = "help",
            usage = "help [topic]",
            description = "Show help information"
        });

        return Task.FromResult(CliResult.Ok(new
        {
            message = "Maestro CLI - Available commands",
            commands = availableCommands,
            tip = "Use 'help <command>' for detailed usage"
        }));
    }

    private CliResult GetTopicHelp(string topic, ContextPermissions permissions)
    {
        return topic switch
        {
            "run" => CliResult.Ok(new
            {
                command = "run",
                description = "Execute a block",
                usage = new[]
                {
                    "run <block-id>",
                    "run <block-id> --input key=value",
                    "run <block-id> --input-json '{\"key\":\"value\"}'"
                },
                examples = new[]
                {
                    "run fitness-calculator --input modelId=smollm2:1.7b",
                    "run training-loop --input-json '{\"iterations\":10}'"
                }
            }),

            "list-tools" => CliResult.Ok(new
            {
                command = "list-tools",
                description = "List available tools in the current context",
                usage = new[] { "list-tools" }
            }),

            "list-blocks" => CliResult.Ok(new
            {
                command = "list-blocks",
                description = "List available blocks in the current context",
                usage = new[]
                {
                    "list-blocks",
                    "list-blocks --type tool",
                    "list-blocks --type workflow"
                }
            }),

            "describe" => CliResult.Ok(new
            {
                command = "describe",
                description = "Show detailed information about a block",
                usage = new[] { "describe <block-id>" },
                examples = new[]
                {
                    "describe fitness-calculator",
                    "describe system:data-store"
                }
            }),

            "data" => CliResult.Ok(new
            {
                command = "data",
                description = "Manage workspace data collections",
                subcommands = new[]
                {
                    new { name = "read", usage = "data read <collection> --id <id>" },
                    new { name = "write", usage = "data write <collection> --id <id> --data <json>" },
                    new { name = "list", usage = "data list [collection]" },
                    new { name = "delete", usage = "data delete <collection> --id <id>" }
                },
                collections = permissions.DataCollections.ToList()
            }),

            "session" => CliResult.Ok(new
            {
                command = "session",
                description = "Manage execution sessions",
                subcommands = new[]
                {
                    new { name = "create", usage = "session create --type <type> [--name <name>]" },
                    new { name = "list", usage = "session list" },
                    new { name = "attach", usage = "session attach --id <session-id>" },
                    new { name = "end", usage = "session end [--id <session-id>] [--reason <reason>]" },
                    new { name = "info", usage = "session info [--id <session-id>]" }
                }
            }),

            _ => CliResult.Failure($"No help available for: {topic}")
        };
    }
}
