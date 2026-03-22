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

        // Store as string — always. JSON content (contracts, test suites, block definitions)
        // must remain as strings for template resolution and check evaluation (contains, json-parseable).
        // Parsing to JObject/List was destructive: TryUnwrapJObjectToList extracted arrays from objects,
        // and .ToString() on List<object> returned C# type names instead of JSON.
        session.SetVariable(variableName, rawValue);
        _stateManager.AppendExecutionLog(session, "info",
            $"set-variable '{nodeId}': stored in '{variableName}' ({rawValue.Length} chars)");

        return rawValue;
    }

    /// <summary>
    /// Extraction of an array from a JObject wrapper.
    /// Only unwraps when the object is a THIN WRAPPER around a single array
    /// (1-2 properties, at least one being the array). Multi-property objects
    /// (like contracts, test suites, block definitions) must NOT be unwrapped —
    /// their internal arrays are not the "value", the whole object is.
    /// </summary>
    internal static (List<object>? list, string? fieldName) TryUnwrapJObjectToList(JObject jObj)
    {
        // Only unwrap thin wrappers (1-2 properties). Objects with 3+ properties
        // are rich data structures that should be stored as-is.
        if (jObj.Count > 2)
            return (null, null);

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
