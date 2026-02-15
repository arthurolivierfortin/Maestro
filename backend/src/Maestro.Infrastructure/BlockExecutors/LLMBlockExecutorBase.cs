using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Abstract base class for LLM-backed block executors (inference and agent).
/// Contains shared mechanical plumbing: mock loading, model resolution, template resolution,
/// output parsing, and JSON extraction. All content (prompts, tools, context) lives in blocks/config.
/// </summary>
public abstract class LLMBlockExecutorBase : IBlockExecutor
{
    protected readonly ILLMGateway _llmGateway;
    protected readonly IExecutionMonitor? _monitor;

    protected LLMBlockExecutorBase(ILLMGateway llmGateway, IExecutionMonitor? monitor = null)
    {
        _llmGateway = llmGateway ?? throw new ArgumentNullException(nameof(llmGateway));
        _monitor = monitor;
    }

    public abstract string SupportedType { get; }

    public abstract Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block,
        ExecutionContext context,
        Dictionary<string, object> inputs,
        CancellationToken ct = default);

    /// <summary>
    /// Resolves the block's on-disk path from config["path"].
    /// </summary>
    protected static string? GetBlockPath(BlockDefinition block)
    {
        if (block.Config != null && block.Config.TryGetValue("path", out var p) && p is string pstr)
            return pstr;
        return null;
    }

    /// <summary>
    /// Checks for mock-response.json in the block path. If found, returns a result with mock outputs.
    /// Returns null if no mock is available.
    /// </summary>
    protected async Task<BlockExecutionResult?> TryLoadMockResponse(BlockDefinition block, Stopwatch sw, CancellationToken ct)
    {
        var path = GetBlockPath(block);
        if (path == null) return null;

        var mock = Path.Combine(path, "mock-response.json");
        if (!File.Exists(mock)) return null;

        try
        {
            var text = await File.ReadAllTextAsync(mock, ct);
            using var doc = JsonDocument.Parse(text);
            var root = doc.RootElement;

            if (root.TryGetProperty("outputs", out var outs))
            {
                var result = new BlockExecutionResult();
                foreach (var prop in outs.EnumerateObject())
                {
                    result.Outputs[prop.Name] = prop.Value.GetString() ?? prop.Value.ToString();
                }
                result.Logs.Add("Mock response loaded");
                result.DurationMs = sw.ElapsedMilliseconds;
                return result;
            }
        }
        catch
        {
            // fallthrough to real call
        }

        return null;
    }

    /// <summary>
    /// Resolves model ID: input override > config > null (use active model).
    /// </summary>
    protected static string? ResolveModelId(BlockDefinition block, Dictionary<string, object> inputs)
    {
        if (inputs.TryGetValue("model", out var modelInput) && modelInput != null)
            return modelInput.ToString();

        if (block.Config != null && block.Config.TryGetValue("model", out var modelCfg) && modelCfg != null)
            return modelCfg.ToString();

        return null;
    }

    /// <summary>
    /// Resolves generation parameters (maxTokens, temperature) from block config.
    /// </summary>
    protected static (int maxTokens, float temperature) ResolveGenerationParams(BlockDefinition block)
    {
        int maxTokens = 1024;
        float temperature = 0.0f;

        if (block.Config != null)
        {
            if (block.Config.TryGetValue("maxTokens", out var mtConfig) && mtConfig != null)
                int.TryParse(mtConfig.ToString(), out maxTokens);

            if (block.Config.TryGetValue("temperature", out var tempConfig) && tempConfig != null)
                float.TryParse(tempConfig.ToString(), System.Globalization.CultureInfo.InvariantCulture, out temperature);
        }

        return (maxTokens, temperature);
    }

    /// <summary>
    /// Resolves {{key}} placeholders in a template string using input values.
    /// </summary>
    protected static string ResolveTemplate(string template, Dictionary<string, object> inputs)
    {
        if (string.IsNullOrEmpty(template)) return string.Empty;
        return Regex.Replace(template, @"\{\{\s*(.+?)\s*\}\}", m =>
        {
            var key = m.Groups[1].Value;
            if (inputs != null && inputs.TryGetValue(key, out var v)) return v?.ToString() ?? string.Empty;
            return string.Empty;
        });
    }

    /// <summary>
    /// Parses structured outputs from LLM response content based on block config.
    /// If outputKey is defined, extracts that key from JSON response. Otherwise stores raw content.
    /// </summary>
    protected static void ParseOutputs(BlockExecutionResult result, string? responseContent, BlockDefinition block)
    {
        if (string.IsNullOrWhiteSpace(responseContent))
        {
            if (!result.Outputs.ContainsKey("result") && !result.Outputs.ContainsKey("content"))
            {
                result.Outputs["content"] = string.Empty;
            }
            return;
        }

        if (block.Config != null && block.Config.TryGetValue("outputKey", out var ok) && ok is string outKey && !string.IsNullOrEmpty(outKey))
        {
            try
            {
                using var doc = JsonDocument.Parse(responseContent);
                if (doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty(outKey, out var prop))
                {
                    result.Outputs[outKey] = prop.GetString() ?? prop.ToString();
                }
                else
                {
                    result.Outputs["content"] = responseContent;
                }
            }
            catch
            {
                result.Outputs["content"] = responseContent;
            }
        }
        else
        {
            result.Outputs["content"] = responseContent;
        }
    }

    /// <summary>
    /// Extracts JSON from a response that may contain markdown code blocks or extra text.
    /// </summary>
    protected static string? ExtractJson(string content)
    {
        if (string.IsNullOrWhiteSpace(content)) return null;

        content = content.Trim();

        // If it starts with {, assume it's already JSON
        if (content.StartsWith("{"))
        {
            var depth = 0;
            for (var i = 0; i < content.Length; i++)
            {
                if (content[i] == '{') depth++;
                else if (content[i] == '}') depth--;
                if (depth == 0) return content.Substring(0, i + 1);
            }
            return content;
        }

        // Try to extract from markdown code block
        var jsonMatch = Regex.Match(content, @"```(?:json)?\s*(\{.*?\})\s*```", RegexOptions.Singleline);
        if (jsonMatch.Success)
        {
            return jsonMatch.Groups[1].Value;
        }

        // Try to find a JSON object anywhere in the text
        var braceMatch = Regex.Match(content, @"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", RegexOptions.Singleline);
        if (braceMatch.Success)
        {
            return braceMatch.Value;
        }

        return null;
    }

    /// <summary>
    /// Creates an error result with the given message.
    /// </summary>
    protected static BlockExecutionResult ErrorResult(string message, long durationMs = 0)
    {
        return new BlockExecutionResult
        {
            Success = false,
            Outputs = new Dictionary<string, object> { ["error"] = message },
            Logs = new List<string> { message },
            DurationMs = durationMs
        };
    }
}
