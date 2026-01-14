using System;
using System.Collections.Generic;
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

public class InferenceBlockExecutor : IBlockExecutor
{
    private readonly ILLMGateway _llmGateway;
    private readonly Maestro.Application.Interfaces.IExecutionMonitor? _monitor;

    public InferenceBlockExecutor(ILLMGateway llmGateway, Maestro.Application.Interfaces.IExecutionMonitor? monitor = null)
    {
        _llmGateway = llmGateway ?? throw new ArgumentNullException(nameof(llmGateway));
        _monitor = monitor;
    }

    public string SupportedType => "inference";

    public async Task<BlockExecutionResult> ExecuteAsync(BlockDefinition block, ExecutionContext context, Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();

        string template = string.Empty;
        string? path = null;
        if (block.Config != null && block.Config.TryGetValue("path", out var p) && p is string pstr)
        {
            path = pstr;
            var file = Path.Combine(path, "prompt.md");
            if (File.Exists(file)) template = await File.ReadAllTextAsync(file, ct);
        }

        if (string.IsNullOrEmpty(template) && block.Config != null && block.Config.TryGetValue("template", out var t))
        {
            template = t?.ToString() ?? string.Empty;
        }

        var resolved = ResolveTemplate(template, inputs);

        // Mock mode: if mock-response.json exists in path, use it
        if (path != null)
        {
            var mock = Path.Combine(path, "mock-response.json");
            if (File.Exists(mock))
            {
                var text = await File.ReadAllTextAsync(mock, ct);
                try
                {
                    using var doc = JsonDocument.Parse(text);
                    var root = doc.RootElement;
                    var outputs = new Dictionary<string, object>();
                    if (root.TryGetProperty("outputs", out var outs))
                    {
                        foreach (var prop in outs.EnumerateObject())
                        {
                            outputs[prop.Name] = prop.Value.GetString() ?? prop.Value.ToString();
                        }
                    }

                    var result = new BlockExecutionResult();
                    foreach (var kv in outputs) result.Outputs[kv.Key] = kv.Value!;
                    result.Logs.Add("Mock response loaded");
                    result.DurationMs = sw.ElapsedMilliseconds;
                    return result;
                }
                catch
                {
                    // fallthrough to real call
                }
            }
        }

        // Real LLM call with optional streaming and simple retry/backoff (3 attempts)
        var request = new LLMRequest { Prompt = resolved };
        Maestro.Application.Interfaces.LLMResponse? response = null;
        var attempts = 0;
        var maxAttempts = 3;
        var delayMs = 200;

        // Check whether this block requests streaming (opt-in)
        var wantsStream = false;
        if (block.Config != null && block.Config.TryGetValue("stream", out var s) && s is bool b && b) wantsStream = true;

        if (wantsStream)
        {
            // Attempt streaming; if not supported or fails, fall back to SendAsync with retries
            try
            {
                var sb = new System.Text.StringBuilder();
                await foreach (var chunk in _llmGateway.StreamAsync(request, ct))
                {
                    if (string.IsNullOrEmpty(chunk)) continue;
                    sb.Append(chunk);
                    context?.LogInfo("LLM stream chunk received");
                    if (_monitor != null)
                    {
                        // Publish partial token/chunk to monitor for real-time UI
                        await _monitor.PublishTerminalOutputAsync(chunk, ct);
                    }
                }

                response = new Maestro.Application.Interfaces.LLMResponse { Content = sb.ToString() };
            }
            catch (NotSupportedException)
            {
                // Streaming not available - will fall through to non-streaming retry
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                // If streaming fails unexpectedly, log and fall back to non-streaming
                context?.LogInfo($"LLM streaming failed: {ex.Message}");
            }
        }

        if (response == null)
        {
            while (attempts < maxAttempts)
            {
                attempts++;
                try
                {
                    response = await _llmGateway.SendAsync(request, ct);
                    break;
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception ex) when (attempts < maxAttempts)
                {
                    // transient, backoff and retry
                    await Task.Delay(delayMs, ct);
                    delayMs *= 2;
                    // log to context if available
                    context?.LogInfo($"LLM call failed attempt {attempts}: {ex.Message}");
                }
            }
        }

        var res = new BlockExecutionResult();
        if (response != null)
        {
            // If block config defines an output schema key, try to parse structured outputs
            if (block.Config != null && block.Config.TryGetValue("outputKey", out var ok) && ok is string outKey && !string.IsNullOrEmpty(outKey))
            {
                // Try to parse JSON object from response content
                try
                {
                    using var doc = JsonDocument.Parse(response.Content);
                    if (doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty(outKey, out var prop))
                    {
                        res.Outputs[outKey] = prop.GetString() ?? prop.ToString();
                    }
                    else
                    {
                        res.Outputs["content"] = response.Content;
                    }
                }
                catch
                {
                    res.Outputs["content"] = response.Content;
                }
            }
            else
            {
                res.Outputs["content"] = response.Content;
            }

            res.Logs.Add("LLM response received");
        }
        else
        {
            res.Logs.Add("LLM call failed after retries");
        }

        res.DurationMs = sw.ElapsedMilliseconds;
        return res;
    }

    private string ResolveTemplate(string template, Dictionary<string, object> inputs)
    {
        if (string.IsNullOrEmpty(template)) return string.Empty;
        return Regex.Replace(template, @"\{\{\s*(.+?)\s*\}\}", m =>
        {
            var key = m.Groups[1].Value;
            if (inputs != null && inputs.TryGetValue(key, out var v)) return v?.ToString() ?? string.Empty;
            return string.Empty;
        });
    }
}
