using System.Text.Json;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Infrastructure.Mcp;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

public class McpBlockExecutor : IBlockExecutor
{
    private readonly IMcpClientFactory _clientFactory;

    public McpBlockExecutor(IMcpClientFactory clientFactory)
    {
        _clientFactory = clientFactory;
    }

    public string SupportedType => "mcp-server";

    public async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var result = new BlockExecutionResult();

        try
        {
            var operation = GetString(inputs, "operation", "list-tools");
            var command = GetConfigString(block, "command");
            var args = GetConfigStringArray(block, "args");

            if (string.IsNullOrEmpty(command))
            {
                result.Success = false;
                result.Outputs["error"] = "Missing required config: command";
                result.Logs.Add("MCP block missing 'command' in config");
                return result;
            }

            var workingDir = GetConfigString(block, "workingDir");
            var client = await _clientFactory.GetOrCreateClientAsync(
                command, args ?? Array.Empty<string>(), workingDir, ct);

            switch (operation)
            {
                case "list-tools":
                    await ExecuteListTools(client, result, ct);
                    break;
                case "call-tool":
                    await ExecuteCallTool(client, inputs, result, ct);
                    break;
                default:
                    result.Success = false;
                    result.Outputs["error"] = $"Unknown MCP operation: {operation}";
                    result.Logs.Add($"Unknown MCP operation: {operation}");
                    break;
            }
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Outputs["error"] = ex.Message;
            result.Logs.Add($"MCP operation failed: {ex.Message}");
        }

        result.DurationMs = sw.ElapsedMilliseconds;
        return result;
    }

    private static async Task ExecuteListTools(
        IMcpClientWrapper client, BlockExecutionResult result, CancellationToken ct)
    {
        var tools = await client.ListToolsAsync(ct);
        var toolList = tools.Select(t => new Dictionary<string, object?>
        {
            ["name"] = t.Name,
            ["description"] = t.Description
        }).ToList();

        result.Outputs["tools"] = toolList;
        result.Outputs["count"] = toolList.Count;
        result.Success = true;
        result.Logs.Add($"MCP list-tools: {toolList.Count} tools found");
    }

    private static async Task ExecuteCallTool(
        IMcpClientWrapper client, Dictionary<string, object> inputs,
        BlockExecutionResult result, CancellationToken ct)
    {
        var toolName = GetString(inputs, "toolName", null)
            ?? throw new ArgumentException("toolName is required for call-tool");

        var arguments = ExtractArguments(inputs);

        var callResult = await client.CallToolAsync(toolName, arguments, ct);

        if (callResult.IsError)
        {
            result.Success = false;
            result.Outputs["error"] = callResult.Content;
            result.Logs.Add($"MCP call-tool '{toolName}' returned error: {callResult.Content}");
            return;
        }

        result.Outputs["result"] = callResult.Content;
        result.Outputs["toolName"] = toolName;
        result.Success = true;
        result.Logs.Add($"MCP call-tool '{toolName}': success");
    }

    private static Dictionary<string, object?> ExtractArguments(Dictionary<string, object> inputs)
    {
        if (!inputs.TryGetValue("arguments", out var argsObj) || argsObj == null)
            return new Dictionary<string, object?>();

        if (argsObj is JsonElement je && je.ValueKind == JsonValueKind.Object)
        {
            var dict = new Dictionary<string, object?>();
            foreach (var prop in je.EnumerateObject())
            {
                dict[prop.Name] = prop.Value.ValueKind switch
                {
                    JsonValueKind.String => prop.Value.GetString(),
                    JsonValueKind.Number => prop.Value.GetDouble(),
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    JsonValueKind.Null => null,
                    _ => prop.Value.GetRawText()
                };
            }
            return dict;
        }

        if (argsObj is Dictionary<string, object> typedDict)
            return typedDict.ToDictionary(kv => kv.Key, kv => (object?)kv.Value);

        if (argsObj is Dictionary<string, object?> nullableDict)
            return nullableDict;

        return new Dictionary<string, object?>();
    }

    private static string? GetString(Dictionary<string, object> inputs, string key, string? defaultValue)
    {
        if (inputs.TryGetValue(key, out var val) && val != null)
        {
            if (val is JsonElement je) return je.GetString();
            return val.ToString();
        }
        return defaultValue;
    }

    private static string? GetConfigString(BlockDefinition block, string key)
    {
        if (block.Config.TryGetValue(key, out var val) && val != null)
        {
            if (val is JsonElement je) return je.GetString();
            return val.ToString();
        }
        return null;
    }

    private static string[]? GetConfigStringArray(BlockDefinition block, string key)
    {
        if (!block.Config.TryGetValue(key, out var val) || val == null)
            return null;

        if (val is JsonElement je && je.ValueKind == JsonValueKind.Array)
            return je.EnumerateArray().Select(e => e.GetString() ?? "").ToArray();

        if (val is string[] strArray)
            return strArray;

        if (val is IEnumerable<object> list)
            return list.Select(o => o.ToString() ?? "").ToArray();

        return null;
    }
}
