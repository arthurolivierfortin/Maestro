using Maestro.Application.Interfaces;
using System.Text.RegularExpressions;

namespace Maestro.Infrastructure.Cli;

/// <summary>
/// Parses CLI command strings into structured ParsedCommand objects.
/// </summary>
public static class CliParser
{
    /// <summary>
    /// Parses a command string into a ParsedCommand.
    /// </summary>
    /// <example>
    /// "run fitness-calculator --input modelId=test --verbose"
    /// => Verb: "run", Target: "fitness-calculator", Arguments: { "input": "modelId=test" }, Flags: { "verbose" }
    ///
    /// "list-tools"
    /// => Verb: "list-tools", Target: null
    ///
    /// "data read experiments --id exp-123"
    /// => Verb: "data", Target: "read", PositionalArgs: ["experiments"], Arguments: { "id": "exp-123" }
    /// </example>
    public static ParsedCommand Parse(string command)
    {
        if (string.IsNullOrWhiteSpace(command))
        {
            return new ParsedCommand { RawCommand = command ?? string.Empty };
        }

        var tokens = Tokenize(command.Trim());
        if (tokens.Count == 0)
        {
            return new ParsedCommand { RawCommand = command };
        }

        var verb = tokens[0];
        string? target = null;
        var arguments = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var positionalArgs = new List<string>();
        var flags = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var i = 1;

        // Second token is the target (if not a flag/argument)
        if (i < tokens.Count && !tokens[i].StartsWith("-"))
        {
            target = tokens[i];
            i++;
        }

        // Parse remaining tokens
        while (i < tokens.Count)
        {
            var token = tokens[i];

            if (token.StartsWith("--"))
            {
                var key = token.Substring(2);

                // Check if next token is a value (not another flag)
                if (i + 1 < tokens.Count && !tokens[i + 1].StartsWith("-"))
                {
                    arguments[key] = tokens[i + 1];
                    i += 2;
                }
                else
                {
                    // It's a flag without value
                    flags.Add(key);
                    i++;
                }
            }
            else if (token.StartsWith("-") && token.Length == 2)
            {
                // Short flag like -v
                var key = token.Substring(1);

                if (i + 1 < tokens.Count && !tokens[i + 1].StartsWith("-"))
                {
                    arguments[key] = tokens[i + 1];
                    i += 2;
                }
                else
                {
                    flags.Add(key);
                    i++;
                }
            }
            else
            {
                // Positional argument
                positionalArgs.Add(token);
                i++;
            }
        }

        return new ParsedCommand
        {
            Verb = verb,
            Target = target,
            Arguments = arguments,
            PositionalArgs = positionalArgs,
            Flags = flags,
            RawCommand = command
        };
    }

    /// <summary>
    /// Tokenizes a command string, respecting quoted strings.
    /// </summary>
    private static List<string> Tokenize(string input)
    {
        var tokens = new List<string>();
        var current = new System.Text.StringBuilder();
        var inQuotes = false;
        var quoteChar = '\0';

        for (var i = 0; i < input.Length; i++)
        {
            var c = input[i];

            if (inQuotes)
            {
                if (c == quoteChar)
                {
                    inQuotes = false;
                    // Don't add quote char to token
                }
                else
                {
                    current.Append(c);
                }
            }
            else
            {
                if (c == '"' || c == '\'')
                {
                    inQuotes = true;
                    quoteChar = c;
                }
                else if (char.IsWhiteSpace(c))
                {
                    if (current.Length > 0)
                    {
                        tokens.Add(current.ToString());
                        current.Clear();
                    }
                }
                else
                {
                    current.Append(c);
                }
            }
        }

        if (current.Length > 0)
        {
            tokens.Add(current.ToString());
        }

        return tokens;
    }

    /// <summary>
    /// Gets a named argument value, with optional default.
    /// </summary>
    public static string? GetArgument(this ParsedCommand cmd, string name, string? defaultValue = null)
    {
        return cmd.Arguments.TryGetValue(name, out var value) ? value : defaultValue;
    }

    /// <summary>
    /// Checks if a flag is set.
    /// </summary>
    public static bool HasFlag(this ParsedCommand cmd, string name)
    {
        return cmd.Flags.Contains(name);
    }

    /// <summary>
    /// Parses a JSON argument value.
    /// </summary>
    public static T? GetJsonArgument<T>(this ParsedCommand cmd, string name) where T : class
    {
        var value = cmd.GetArgument(name);
        if (string.IsNullOrEmpty(value))
        {
            return null;
        }

        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<T>(value);
        }
        catch
        {
            return null;
        }
    }
}
