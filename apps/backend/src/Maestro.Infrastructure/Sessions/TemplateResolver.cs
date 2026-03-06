using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace Maestro.Infrastructure.Sessions;

/// <summary>
/// Resolves {{variable}} template references in strings using session variables.
/// Handles sub-path extraction for JSON values (e.g., {{_nodeResult_xxx.key}}).
///
/// ARCHITECTURE (Phase 53-B): Extracted from NodeExecutionEngine — pure static utility.
/// </summary>
public static class TemplateResolver
{
    /// <summary>
    /// Resolves {{variable}} references in a template string using session variables.
    /// Handles {{inputs.xxx}} by looking up session variable "xxx".
    /// Returns the resolved string with all placeholders replaced.
    /// </summary>
    public static string ResolveTemplate(string template, Domain.Entities.ProjectSession session)
    {
        return Regex.Replace(template, @"\{\{([^}]+)\}\}", match =>
        {
            var varPath = match.Groups[1].Value.Trim();
            string? jsonSubPath = null;

            // {{inputs.xxx}} → session variable "xxx"
            if (varPath.StartsWith("inputs."))
                varPath = varPath["inputs.".Length..];

            // {{state.results.xxx}} → session variable "_nodeResult_xxx"
            // {{state.results.xxx.yyy}} → session variable "_nodeResult_xxx", sub-path "yyy"
            if (varPath.StartsWith("state.results."))
            {
                var afterResults = varPath["state.results.".Length..];
                var dotIdx = afterResults.IndexOf('.');
                if (dotIdx >= 0)
                {
                    var nodeId = afterResults[..dotIdx];
                    jsonSubPath = afterResults[(dotIdx + 1)..];
                    varPath = $"_nodeResult_{nodeId}";
                }
                else
                {
                    varPath = $"_nodeResult_{afterResults}";
                }
            }
            // {{state.xxx}} → session variable "_state_xxx" (general state access)
            else if (varPath.StartsWith("state."))
            {
                var statePath = varPath["state.".Length..];
                var stateKey = statePath.Contains('.') ? statePath[..statePath.IndexOf('.')] : statePath;
                varPath = $"_state_{stateKey}";
            }
            // {{_nodeResult_xxx.yyy}} → variable "_nodeResult_xxx", sub-path "yyy"
            else if (varPath.StartsWith("_nodeResult_") && varPath.Contains('.'))
            {
                var dotIdx = varPath.IndexOf('.');
                jsonSubPath = varPath[(dotIdx + 1)..];
                varPath = varPath[..dotIdx];
            }

            var value = session.GetVariable(varPath);
            if (value == null) return "";

            // Phase 32-C: JSON sub-path extraction
            // If a sub-path is specified (e.g., .approved, .score), try to extract from JSON
            if (jsonSubPath != null)
            {
                var extracted = ExtractJsonSubPath(value, jsonSubPath);
                if (extracted != null) return extracted;
            }

            if (value is double d) return d.ToString(CultureInfo.InvariantCulture);
            if (value is int i) return i.ToString(CultureInfo.InvariantCulture);
            if (value is long l) return l.ToString(CultureInfo.InvariantCulture);
            if (value is float f) return f.ToString(CultureInfo.InvariantCulture);

            if (value is JsonElement je)
            {
                return je.ValueKind switch
                {
                    JsonValueKind.Number => je.GetDouble().ToString(CultureInfo.InvariantCulture),
                    JsonValueKind.String => je.GetString() ?? "0",
                    JsonValueKind.True => "true",
                    JsonValueKind.False => "false",
                    _ => je.ToString()
                };
            }

            if (value is JValue jv)
            {
                if (jv.Value is double jd) return jd.ToString(CultureInfo.InvariantCulture);
                return jv.Value?.ToString() ?? "0";
            }

            // Collections (List<object>, Dictionary<string,object>) must be serialized to JSON,
            // not .ToString() which returns the C# type name.
            if (value is System.Collections.IList || value is System.Collections.IDictionary)
            {
                return JsonSerializer.Serialize(value);
            }

            return value.ToString() ?? "0";
        });
    }

    /// <summary>
    /// Extract a field from a JSON value by sub-path (e.g., "approved", "score").
    /// Handles string values that are parseable JSON, JsonElement objects, and JObject/JValue.
    /// </summary>
    public static string? ExtractJsonSubPath(object value, string subPath)
    {
        try
        {
            // If value is a string, try to parse as JSON
            var jsonStr = value as string;
            if (jsonStr == null && value is JsonElement je && je.ValueKind == JsonValueKind.String)
                jsonStr = je.GetString();

            if (jsonStr != null)
            {
                // Strip markdown code fences if present (e.g., ```json ... ```)
                var stripped = jsonStr.Trim();
                var fenceMatch = Regex.Match(
                    stripped, @"```(?:json)?\s*(\{.*\})\s*```", RegexOptions.Singleline);
                if (fenceMatch.Success)
                    stripped = fenceMatch.Groups[1].Value;

                using var doc = JsonDocument.Parse(stripped);
                if (doc.RootElement.TryGetProperty(subPath, out var prop))
                {
                    return FormatJsonProperty(prop);
                }
            }

            // If value is a JsonElement object, navigate directly
            if (value is JsonElement obj && obj.ValueKind == JsonValueKind.Object)
            {
                if (obj.TryGetProperty(subPath, out var prop))
                {
                    return FormatJsonProperty(prop);
                }
            }

            // If value is a JObject (Newtonsoft), navigate
            if (value is JObject jObj)
            {
                var token = jObj[subPath];
                if (token != null) return token.ToString();
            }
        }
        catch
        {
            // Parse failure — fall back to returning null (caller uses full value)
        }

        return null;
    }

    /// <summary>
    /// Serializes a block output value to a string suitable for storage in session variables.
    /// Strings pass through unchanged; complex objects (lists, dicts) get JSON-serialized
    /// so that {{_nodeResult_xxx.key}} sub-path extraction works via ExtractJsonSubPath.
    /// </summary>
    public static string SerializeOutputValue(object? value)
    {
        if (value == null) return "";
        if (value is string s) return s;
        if (value is JsonElement je)
            return je.ValueKind == JsonValueKind.String ? je.GetString() ?? "" : je.GetRawText();

        // For primitive types, just use ToString
        var type = value.GetType();
        if (type.IsPrimitive || type == typeof(decimal))
            return value.ToString() ?? "";

        // For complex types (List<T>, Dictionary, etc.), serialize to JSON
        try
        {
            return JsonSerializer.Serialize(value, new JsonSerializerOptions { WriteIndented = false });
        }
        catch
        {
            return value.ToString() ?? "";
        }
    }

    private static string FormatJsonProperty(JsonElement prop)
    {
        return prop.ValueKind switch
        {
            JsonValueKind.Number => prop.GetDouble().ToString(CultureInfo.InvariantCulture),
            JsonValueKind.String => prop.GetString() ?? "0",
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => prop.ToString()
        };
    }
}
