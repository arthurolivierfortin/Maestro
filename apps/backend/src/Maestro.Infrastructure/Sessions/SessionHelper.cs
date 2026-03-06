using System.Text.Json;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace Maestro.Infrastructure.Sessions;

/// <summary>
/// Static utility methods for session config navigation and JSON type conversions.
///
/// ARCHITECTURE (Phase 53-B): Extracted from NodeExecutionEngine.
/// These methods are used by NodeExecutionEngine and EntryPointExecutor
/// for navigating workflow config and converting between JSON libraries.
/// </summary>
public static class SessionHelper
{
    public static string GetProjectPath(Domain.Entities.ProjectSession session)
    {
        if (!string.IsNullOrEmpty(session.WorkingDirectory) && session.WorkingDirectory != ".")
            return session.WorkingDirectory;

        // Fall back to repository path for repo-bound sessions
        if (!string.IsNullOrEmpty(session.RepositoryPath))
            return session.RepositoryPath;

        return Environment.CurrentDirectory;
    }

    /// <summary>
    /// Extracts the workflow-specific config from session variable _workflowConfig.
    /// Phase-aware: if phaseId is provided, looks for config[workflowKey][phaseId] first,
    /// then falls back to config[workflowKey] for backward compatibility.
    /// </summary>
    public static Dictionary<string, object>? GetWorkflowConfig(Domain.Entities.ProjectSession session, string workflowId, string? phaseId = null)
    {
        var configVar = session.GetVariable("_workflowConfig");
        if (configVar == null) return null;

        var keys = ExtractWorkflowKeys(workflowId);

        // First, find the workflow-level config
        Dictionary<string, object>? workflowLevelConfig = null;

        if (configVar is Dictionary<string, object> dict)
        {
            foreach (var key in keys)
            {
                if (dict.TryGetValue(key, out var value) && value is Dictionary<string, object> wc)
                {
                    workflowLevelConfig = wc;
                    break;
                }
            }
        }

        if (workflowLevelConfig == null && configVar is JObject jObj)
        {
            foreach (var key in keys)
            {
                if (jObj.TryGetValue(key, out var prop))
                {
                    workflowLevelConfig = JObjectToDict(prop as JObject);
                    break;
                }
            }
        }

        if (workflowLevelConfig == null && configVar is JsonElement jsonEl && jsonEl.ValueKind == JsonValueKind.Object)
        {
            foreach (var key in keys)
            {
                if (jsonEl.TryGetProperty(key, out var prop))
                {
                    workflowLevelConfig = JsonElementToDict(prop);
                    break;
                }
            }
        }

        if (workflowLevelConfig == null) return null;

        // If phaseId provided, look for phase-specific sub-config
        if (!string.IsNullOrEmpty(phaseId))
        {
            if (workflowLevelConfig.TryGetValue(phaseId, out var phaseConfig))
            {
                if (phaseConfig is Dictionary<string, object> phaseDict)
                    return phaseDict;
                if (phaseConfig is JObject phaseJObj)
                    return JObjectToDict(phaseJObj);
                if (phaseConfig is JsonElement phaseEl && phaseEl.ValueKind == JsonValueKind.Object)
                    return JsonElementToDict(phaseEl);
            }
        }

        // Fallback: return workflow-level config (backward compat)
        return workflowLevelConfig;
    }

    public static string[] ExtractWorkflowKeys(string workflowId)
    {
        // workflow:foundry/agent-improvement-loop → try multiple key forms
        var stripped = workflowId
            .Replace("workflow:", "")
            .Replace("foundry:", "");
        var lastSegment = stripped.Contains('/') ? stripped.Split('/').Last() : stripped;
        return new[] { lastSegment, stripped, workflowId };
    }

    public static string GetConfigString(Dictionary<string, object>? config, string dotPath, string? defaultValue)
    {
        if (config == null) return defaultValue ?? "";

        var parts = dotPath.Split('.');
        object? current = config;

        foreach (var part in parts)
        {
            if (current is Dictionary<string, object> dict)
            {
                if (!dict.TryGetValue(part, out current)) return defaultValue ?? "";
            }
            else if (current is JObject jObj)
            {
                if (!jObj.TryGetValue(part, out var jToken)) return defaultValue ?? "";
                current = jToken;
            }
            else if (current is JsonElement jsonEl && jsonEl.ValueKind == JsonValueKind.Object)
            {
                if (!jsonEl.TryGetProperty(part, out var prop)) return defaultValue ?? "";
                current = prop;
            }
            else
            {
                return defaultValue ?? "";
            }
        }

        if (current is string s) return s;
        if (current is JValue jVal) return jVal.Value?.ToString() ?? defaultValue ?? "";
        if (current is JToken jt) return jt.ToString();
        if (current is JsonElement je && je.ValueKind == JsonValueKind.String) return je.GetString() ?? defaultValue ?? "";
        return current?.ToString() ?? defaultValue ?? "";
    }

    public static int GetConfigInt(Dictionary<string, object>? config, string dotPath, int defaultValue)
    {
        var str = GetConfigString(config, dotPath, null);
        return str != null && int.TryParse(str, out var val) ? val : defaultValue;
    }

    public static string NormalizeBlockId(string workflowId)
    {
        // workflow:foundry/agent-improvement-loop → foundry:agent-improvement-loop
        var stripped = workflowId.Replace("workflow:", "");
        if (stripped.Contains('/'))
        {
            var parts = stripped.Split('/', 2);
            return $"{parts[0]}:{parts[1]}";
        }
        return stripped;
    }

    // ===== JSON Type Conversion Helpers =====

    public static Dictionary<string, object>? JObjectToDict(JObject? jObj)
    {
        if (jObj == null) return null;
        var dict = new Dictionary<string, object>();
        foreach (var prop in jObj.Properties())
        {
            dict[prop.Name] = prop.Value;
        }
        return dict;
    }

    public static Dictionary<string, object>? JsonElementToDict(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object) return null;
        var dict = new Dictionary<string, object>();
        foreach (var prop in element.EnumerateObject())
        {
            dict[prop.Name] = prop.Value;
        }
        return dict;
    }

    /// <summary>
    /// PHASE 35-E FIX 36: Attempt to extract a JSON array from text that may contain
    /// prose, markdown code fences, or other non-JSON content around the array.
    /// Returns null if no valid JSON array is found.
    /// </summary>
    public static JArray? TryExtractJsonArrayFromText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        // Step 1: Strip markdown code fences (```json ... ``` or ``` ... ```)
        var stripped = Regex.Replace(text, @"```(?:json|JSON)?\s*\n?", "").Trim();

        // Step 2: Find the first "[{" pattern (start of a JSON array of objects)
        var arrayStart = stripped.IndexOf("[{", StringComparison.Ordinal);
        if (arrayStart < 0)
        {
            // Also try just "[" for arrays of primitives or "[\"" for arrays of strings
            arrayStart = stripped.IndexOf('[');
        }
        if (arrayStart < 0) return null;

        // Step 3: Find the matching "]" — search from the end backwards
        var arrayEnd = stripped.LastIndexOf(']');
        if (arrayEnd <= arrayStart) return null;

        // Step 4: Extract and validate
        var candidate = stripped.Substring(arrayStart, arrayEnd - arrayStart + 1);
        try
        {
            var parsed = JArray.Parse(candidate);
            // Only return if the array has items (empty arrays aren't useful)
            return parsed.Count > 0 ? parsed : null;
        }
        catch
        {
            // If the greedy approach failed, try a more conservative bracket-matching approach
            // Count brackets to find the correct closing bracket for the first "["
            var depth = 0;
            var inString = false;
            var escaped = false;
            for (var i = arrayStart; i <= arrayEnd; i++)
            {
                var c = stripped[i];
                if (escaped) { escaped = false; continue; }
                if (c == '\\') { escaped = true; continue; }
                if (c == '"') { inString = !inString; continue; }
                if (inString) continue;
                if (c == '[') depth++;
                if (c == ']')
                {
                    depth--;
                    if (depth == 0)
                    {
                        var balanced = stripped.Substring(arrayStart, i - arrayStart + 1);
                        try
                        {
                            var parsed2 = JArray.Parse(balanced);
                            return parsed2.Count > 0 ? parsed2 : null;
                        }
                        catch { return null; }
                    }
                }
            }
            return null;
        }
    }

    /// <summary>
    /// PHASE 35-E FIX 36: Convert a Newtonsoft JArray to a native List&lt;object&gt;
    /// of Dictionary/string/primitive types suitable for session variable storage.
    /// </summary>
    public static List<object> JArrayToNativeList(JArray jArr)
    {
        var list = new List<object>();
        foreach (var item in jArr)
        {
            if (item is JObject jObj)
            {
                var dict = new Dictionary<string, object>();
                foreach (var prop in jObj.Properties())
                {
                    dict[prop.Name] = prop.Value.Type switch
                    {
                        JTokenType.String => prop.Value.Value<string>()!,
                        JTokenType.Integer => (object)prop.Value.Value<long>(),
                        JTokenType.Float => (object)prop.Value.Value<double>(),
                        JTokenType.Boolean => (object)prop.Value.Value<bool>(),
                        JTokenType.Array => prop.Value.ToString(),
                        JTokenType.Object => prop.Value.ToString(),
                        _ => prop.Value.ToString()
                    };
                }
                list.Add(dict);
            }
            else if (item.Type == JTokenType.String)
            {
                list.Add(item.Value<string>()!);
            }
            else
            {
                list.Add(item.ToString());
            }
        }
        return list;
    }
}
