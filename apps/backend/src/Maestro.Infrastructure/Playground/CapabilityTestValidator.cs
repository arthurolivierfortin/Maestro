using System.Text.Json;

namespace Maestro.Infrastructure.Playground;

/// <summary>
/// Validates capability test responses against expected criteria.
/// Each method returns (passed, details).
/// </summary>
public static class CapabilityTestValidator
{
    /// <summary>
    /// Validate that the response is valid JSON and contains all required fields.
    /// </summary>
    public static (bool Passed, string Details) ValidateJson(string response, string[] requiredFields)
    {
        var trimmed = response.Trim();

        // Try to extract JSON from markdown code blocks if present
        if (trimmed.StartsWith("```"))
        {
            var lines = trimmed.Split('\n');
            var jsonLines = new List<string>();
            var inBlock = false;
            foreach (var line in lines)
            {
                if (line.TrimStart().StartsWith("```") && !inBlock)
                {
                    inBlock = true;
                    continue;
                }
                if (line.TrimStart().StartsWith("```") && inBlock)
                    break;
                if (inBlock)
                    jsonLines.Add(line);
            }
            if (jsonLines.Count > 0)
                trimmed = string.Join('\n', jsonLines).Trim();
        }

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(trimmed);
        }
        catch (JsonException ex)
        {
            return (false, $"Invalid JSON: {ex.Message}");
        }

        if (doc.RootElement.ValueKind != JsonValueKind.Object)
        {
            return (false, $"Expected JSON object, got {doc.RootElement.ValueKind}.");
        }

        var missing = new List<string>();
        foreach (var field in requiredFields)
        {
            if (!doc.RootElement.TryGetProperty(field, out _))
                missing.Add(field);
        }

        if (missing.Count > 0)
        {
            return (false, $"Valid JSON but missing required fields: {string.Join(", ", missing)}.");
        }

        return (true, $"Valid JSON. All required fields present: {string.Join(", ", requiredFields)}.");
    }

    /// <summary>
    /// Validate that the response contains all expected text fragments.
    /// </summary>
    public static (bool Passed, string Details) ValidateContains(string response, string[] expectedTexts)
    {
        var missing = new List<string>();
        foreach (var text in expectedTexts)
        {
            if (!response.Contains(text, StringComparison.OrdinalIgnoreCase))
                missing.Add(text);
        }

        if (missing.Count > 0)
        {
            return (false, $"Missing expected content: {string.Join(", ", missing.Select(m => $"\"{m}\""))}.");
        }

        return (true, $"All expected content found: {string.Join(", ", expectedTexts.Select(t => $"\"{t}\""))}.");
    }

    /// <summary>
    /// Validate that the response is a valid JSON tool call with "tool" and "args" keys.
    /// </summary>
    public static (bool Passed, string Details) ValidateToolCall(string response)
    {
        var trimmed = response.Trim();

        // Try to extract JSON from markdown code blocks if present
        if (trimmed.StartsWith("```"))
        {
            var lines = trimmed.Split('\n');
            var jsonLines = new List<string>();
            var inBlock = false;
            foreach (var line in lines)
            {
                if (line.TrimStart().StartsWith("```") && !inBlock)
                {
                    inBlock = true;
                    continue;
                }
                if (line.TrimStart().StartsWith("```") && inBlock)
                    break;
                if (inBlock)
                    jsonLines.Add(line);
            }
            if (jsonLines.Count > 0)
                trimmed = string.Join('\n', jsonLines).Trim();
        }

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(trimmed);
        }
        catch (JsonException ex)
        {
            return (false, $"Response is not valid JSON: {ex.Message}");
        }

        if (doc.RootElement.ValueKind != JsonValueKind.Object)
        {
            return (false, $"Expected JSON object, got {doc.RootElement.ValueKind}.");
        }

        var hasTool = doc.RootElement.TryGetProperty("tool", out _);
        var hasArgs = doc.RootElement.TryGetProperty("args", out _);

        if (!hasTool && !hasArgs)
        {
            return (false, "JSON object missing both \"tool\" and \"args\" keys.");
        }
        if (!hasTool)
        {
            return (false, "JSON object missing \"tool\" key.");
        }
        if (!hasArgs)
        {
            return (false, "JSON object missing \"args\" key.");
        }

        return (true, "Valid tool call with \"tool\" and \"args\" keys.");
    }

    /// <summary>
    /// Validate that the response has exactly the expected number of lines with the given prefix.
    /// </summary>
    public static (bool Passed, string Details) ValidateLineCount(string response, int expectedCount, string linePrefix)
    {
        var lines = response
            .Split('\n')
            .Select(l => l.Trim())
            .Where(l => !string.IsNullOrEmpty(l))
            .ToList();

        var matchingLines = lines
            .Where(l => l.StartsWith(linePrefix))
            .ToList();

        if (matchingLines.Count == expectedCount)
        {
            return (true, $"Found exactly {expectedCount} lines starting with \"{linePrefix}\".");
        }

        return (false, $"Expected {expectedCount} lines starting with \"{linePrefix}\", found {matchingLines.Count}. Total non-empty lines: {lines.Count}.");
    }

    /// <summary>
    /// Validate that the response contains at least one of the given words.
    /// </summary>
    public static (bool Passed, string Details) ValidateContainsAny(string response, string[] words)
    {
        var found = new List<string>();
        foreach (var word in words)
        {
            // Use word boundary check for short words to avoid false positives
            if (response.Contains(word, StringComparison.Ordinal))
                found.Add(word);
        }

        if (found.Count == 0)
        {
            return (false, $"None of the expected words found: {string.Join(", ", words.Select(w => $"\"{w}\""))}.");
        }

        return (true, $"Found {found.Count} matching word(s): {string.Join(", ", found.Select(w => $"\"{w}\""))}.");
    }

    /// <summary>
    /// Dispatches validation based on test definition type.
    /// </summary>
    public static (bool Passed, string Details) Validate(CapabilityTestDefinition test, string response)
    {
        return test.ValidatorType switch
        {
            ValidatorType.Json => ValidateJson(response,
                (test.ValidatorConfig as JsonValidatorConfig)?.RequiredFields ?? Array.Empty<string>()),

            ValidatorType.Contains => ValidateContains(response,
                (test.ValidatorConfig as ContainsValidatorConfig)?.ExpectedTexts ?? Array.Empty<string>()),

            ValidatorType.ToolCall => ValidateToolCall(response),

            ValidatorType.LineCount => ValidateLineCount(response,
                (test.ValidatorConfig as LineCountValidatorConfig)?.ExpectedCount ?? 0,
                (test.ValidatorConfig as LineCountValidatorConfig)?.LinePrefix ?? ""),

            ValidatorType.ContainsAny => ValidateContainsAny(response,
                (test.ValidatorConfig as ContainsAnyValidatorConfig)?.Words ?? Array.Empty<string>()),

            _ => (false, $"Unknown validator type: {test.ValidatorType}")
        };
    }
}
