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
        var repeatedArguments = new List<KeyValuePair<string, string>>();
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
                    var value = tokens[i + 1];
                    arguments[key] = value; // Last value wins for dict
                    repeatedArguments.Add(new KeyValuePair<string, string>(key, value));
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
                    var value = tokens[i + 1];
                    arguments[key] = value;
                    repeatedArguments.Add(new KeyValuePair<string, string>(key, value));
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
            RepeatedArguments = repeatedArguments,
            PositionalArgs = positionalArgs,
            Flags = flags,
            RawCommand = command
        };
    }

    /// <summary>
    /// Tokenizes a command string, respecting quoted strings and JSON blocks.
    /// JSON blocks (starting with { or [) are captured as single tokens with content preserved.
    /// </summary>
    private static List<string> Tokenize(string input)
    {
        var tokens = new List<string>();
        var current = new System.Text.StringBuilder();
        var inQuotes = false;
        var quoteChar = '\0';
        var braceDepth = 0;
        var bracketDepth = 0;
        var inJsonBlock = false;

        for (var i = 0; i < input.Length; i++)
        {
            var c = input[i];

            // Inside a JSON block: capture everything including quotes and whitespace
            if (inJsonBlock)
            {
                current.Append(c);

                if (c == '"')
                {
                    // Track quotes to avoid counting braces inside strings
                    if (!inQuotes)
                    {
                        inQuotes = true;
                        quoteChar = '"';
                    }
                    else if (quoteChar == '"')
                    {
                        // Check if escaped
                        int backslashes = 0;
                        for (int j = i - 1; j >= 0 && input[j] == '\\'; j--)
                            backslashes++;
                        if (backslashes % 2 == 0)
                            inQuotes = false;
                    }
                }
                else if (!inQuotes)
                {
                    if (c == '{') braceDepth++;
                    else if (c == '}') braceDepth--;
                    else if (c == '[') bracketDepth++;
                    else if (c == ']') bracketDepth--;

                    if (braceDepth == 0 && bracketDepth == 0)
                    {
                        // End of JSON block
                        tokens.Add(current.ToString());
                        current.Clear();
                        inJsonBlock = false;
                        inQuotes = false;
                    }
                }
                continue;
            }

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
                if (c == '{' || c == '[')
                {
                    // Start of a JSON block — flush any prefix (e.g., nothing, or partial token)
                    // and start capturing the JSON block as-is
                    if (current.Length > 0)
                    {
                        // Check if current token is a prefix like --input-json that attaches to JSON
                        // In that case, keep them separate by flushing first
                        tokens.Add(current.ToString());
                        current.Clear();
                    }
                    inJsonBlock = true;
                    braceDepth = c == '{' ? 1 : 0;
                    bracketDepth = c == '[' ? 1 : 0;
                    current.Append(c);
                }
                else if (c == '"' || c == '\'')
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
