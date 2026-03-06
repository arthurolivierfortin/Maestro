using System.Text.Json;
using Newtonsoft.Json.Linq;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;

namespace Maestro.Infrastructure.Sessions.NodeHandlers;

/// <summary>
/// Handles "set-variable" nodes: stores a value (template-resolved or previousOutput)
/// into a session variable. Supports append mode, JSON parsing, and embedded array extraction.
///
/// ARCHITECTURE (Phase 53-C): Extracted from NodeExecutionEngine.
/// Generic infrastructure — stores any value in any variable. Knows nothing about
/// plans, steps, or dev workflows.
/// </summary>
public class SetVariableNodeHandler : INodeHandler
{
    private readonly ISessionStateManager _stateManager;

    public string? NodeType => "set-variable";

    public SetVariableNodeHandler(ISessionStateManager stateManager)
    {
        _stateManager = stateManager;
    }

    public Task<string?> ExecuteAsync(
        JsonElement node,
        NodeExecutionContext context,
        INodeExecutionCallback engine,
        string? previousOutput)
    {
        var result = Execute(context.Session, node, previousOutput);
        return Task.FromResult<string?>(result);
    }

    internal string Execute(ProjectSession session, JsonElement nodeConfig, string? previousOutput)
    {
        var nodeId = nodeConfig.TryGetProperty("id", out var idProp)
            ? idProp.GetString() ?? "set-variable" : "set-variable";
        var variableName = nodeConfig.TryGetProperty("variable", out var varProp)
            ? varProp.GetString() : null;
        var mode = nodeConfig.TryGetProperty("mode", out var modeProp) && modeProp.ValueKind == JsonValueKind.String
            ? modeProp.GetString() : null;

        if (string.IsNullOrEmpty(variableName))
        {
            _stateManager.AppendExecutionLog(session, "error", $"set-variable '{nodeId}': missing 'variable' property");
            return previousOutput ?? "";
        }

        // Resolve value — from template, or use previousOutput
        var rawValue = previousOutput ?? "";
        if (nodeConfig.TryGetProperty("value", out var valProp) && valProp.ValueKind == JsonValueKind.String)
        {
            var templateValue = valProp.GetString() ?? "";
            rawValue = templateValue.Contains("{{previousOutput}}")
                ? templateValue.Replace("{{previousOutput}}", previousOutput ?? "")
                : TemplateResolver.ResolveTemplate(templateValue, session);
        }

        // Append mode
        if (mode == "append")
        {
            var existing = session.GetVariable(variableName);
            if (existing is List<object> list)
            {
                list.Add(rawValue);
                session.SetVariable(variableName, list);
            }
            else
            {
                session.SetVariable(variableName, new List<object> { rawValue });
            }
            _stateManager.AppendExecutionLog(session, "info",
                $"set-variable '{nodeId}': appended to '{variableName}'");
            return rawValue;
        }

        // Try to parse as JSON for proper List/Dict storage
        var trimmed = rawValue.Trim();
        trimmed = trimmed.TrimStart('\uFEFF', '\u200B', '\u200C', '\u200D');
        if (trimmed.StartsWith("[") || trimmed.StartsWith("{"))
        {
            try
            {
                var token = JToken.Parse(trimmed);

                if (token is JArray jArr)
                {
                    var parsedList = SessionHelper.JArrayToNativeList(jArr);
                    session.SetVariable(variableName, parsedList);
                    _stateManager.AppendExecutionLog(session, "info",
                        $"set-variable '{nodeId}': stored {parsedList.Count}-item list in '{variableName}' ({trimmed.Length} chars)");
                }
                else if (token is JObject jObj)
                {
                    var (unwrappedList, unwrapField) = TryUnwrapJObjectToList(jObj);

                    if (unwrappedList != null && unwrappedList.Count > 0)
                    {
                        session.SetVariable(variableName, unwrappedList);
                        _stateManager.AppendExecutionLog(session, "info",
                            $"set-variable '{nodeId}': unwrapped '{unwrapField}' -> stored {unwrappedList.Count}-item list in '{variableName}'");
                    }
                    else
                    {
                        session.SetVariable(variableName, jObj);
                        _stateManager.AppendExecutionLog(session, "info",
                            $"set-variable '{nodeId}': stored JSON object in '{variableName}' ({trimmed.Length} chars)");
                    }
                }
                else
                {
                    session.SetVariable(variableName, rawValue);
                    _stateManager.AppendExecutionLog(session, "info",
                        $"set-variable '{nodeId}': stored value in '{variableName}' ({trimmed.Length} chars, token type: {token.Type})");
                }
            }
            catch (Exception ex)
            {
                session.SetVariable(variableName, rawValue);
                _stateManager.AppendExecutionLog(session, "warn",
                    $"set-variable '{nodeId}': JSON parse failed, stored as string in '{variableName}' ({rawValue.Length} chars, err: {ex.Message})");
            }
        }
        else
        {
            var embeddedArray = SessionHelper.TryExtractJsonArrayFromText(rawValue);
            if (embeddedArray != null && embeddedArray.Count > 0)
            {
                var list = SessionHelper.JArrayToNativeList(embeddedArray);
                session.SetVariable(variableName, list);
                _stateManager.AppendExecutionLog(session, "info",
                    $"set-variable '{nodeId}': extracted {list.Count}-item list from plain text in '{variableName}'");
            }
            else
            {
                session.SetVariable(variableName, rawValue);
                _stateManager.AppendExecutionLog(session, "info",
                    $"set-variable '{nodeId}': stored plain text in '{variableName}' ({rawValue.Length} chars)");
            }
        }

        return rawValue;
    }

    /// <summary>
    /// Three-pass extraction of an array from a JObject wrapper.
    /// </summary>
    internal static (List<object>? list, string? fieldName) TryUnwrapJObjectToList(JObject jObj)
    {
        // Pass 1: String property starting with "["
        foreach (var prop in jObj.Properties())
        {
            if (prop.Value.Type != JTokenType.String) continue;
            var strVal = prop.Value.Value<string>();
            if (!string.IsNullOrEmpty(strVal) && strVal.TrimStart().StartsWith("["))
            {
                try { return (SessionHelper.JArrayToNativeList(JArray.Parse(strVal)), prop.Name); }
                catch { /* not a valid JSON array */ }
            }
        }

        // Pass 2: String property with embedded JSON array
        foreach (var prop in jObj.Properties())
        {
            if (prop.Value.Type != JTokenType.String) continue;
            var extracted = SessionHelper.TryExtractJsonArrayFromText(prop.Value.Value<string>());
            if (extracted != null)
                return (SessionHelper.JArrayToNativeList(extracted), prop.Name + " (embedded)");
        }

        // Pass 3: JArray property directly
        foreach (var prop in jObj.Properties())
        {
            if (prop.Value is JArray directArr && directArr.Count > 0)
                return (SessionHelper.JArrayToNativeList(directArr), prop.Name + " (array)");
        }

        return (null, null);
    }
}
