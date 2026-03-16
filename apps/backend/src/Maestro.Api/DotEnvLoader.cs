namespace Maestro.Api;

/// <summary>
/// Loads environment variables from a .env file.
/// Existing env vars are NOT overridden (explicit env vars take priority over .env).
/// </summary>
public static class DotEnvLoader
{
    public static void Load(string? filePath = null)
    {
        // If no explicit path, try MAESTRO_ROOT/.env then current dir/.env
        if (filePath == null)
        {
            var maestroRoot = Environment.GetEnvironmentVariable("MAESTRO_ROOT");
            if (!string.IsNullOrEmpty(maestroRoot))
            {
                var candidate = Path.Combine(maestroRoot, ".env");
                if (File.Exists(candidate))
                {
                    filePath = candidate;
                }
            }

            filePath ??= Path.Combine(Directory.GetCurrentDirectory(), ".env");
        }

        if (!File.Exists(filePath))
        {
            return;
        }

        var count = 0;
        foreach (var rawLine in File.ReadLines(filePath))
        {
            var line = rawLine.Trim();

            // Skip empty lines and comments
            if (string.IsNullOrEmpty(line) || line.StartsWith('#'))
            {
                continue;
            }

            // Split on first '='
            var eqIndex = line.IndexOf('=');
            if (eqIndex <= 0)
            {
                continue;
            }

            var key = line[..eqIndex].Trim();
            var value = line[(eqIndex + 1)..].Trim();

            // Remove surrounding quotes (single or double)
            if (value.Length >= 2)
            {
                if ((value[0] == '"' && value[^1] == '"') ||
                    (value[0] == '\'' && value[^1] == '\''))
                {
                    value = value[1..^1];
                }
            }

            // ONLY set if not already defined — existing env vars take priority
            if (Environment.GetEnvironmentVariable(key) == null)
            {
                Environment.SetEnvironmentVariable(key, value, EnvironmentVariableTarget.Process);
                count++;
            }
        }

        if (count > 0)
        {
            Console.WriteLine($"[DotEnvLoader] Loaded {count} variables from {filePath}");
        }
    }
}
