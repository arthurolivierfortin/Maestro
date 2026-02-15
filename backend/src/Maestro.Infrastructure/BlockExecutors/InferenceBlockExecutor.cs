using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.DTOs;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;

namespace Maestro.Infrastructure.BlockExecutors;

/// <summary>
/// Executor for inference blocks: template resolution → single LLM call → parse outputs.
/// All content comes from block config. The executor is pure mechanical plumbing.
/// </summary>
public class InferenceBlockExecutor : LLMBlockExecutorBase
{
    public InferenceBlockExecutor(ILLMGateway llmGateway, IExecutionMonitor? monitor = null)
        : base(llmGateway, monitor) { }

    public override string SupportedType => "inference";

    public override async Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block, ExecutionContext context,
        Dictionary<string, object> inputs, CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();

        // 1. Mock check
        var mockResult = await TryLoadMockResponse(block, sw, ct);
        if (mockResult != null) return mockResult;

        // 2. Load template from file or config
        var template = await LoadTemplate(block, ct);
        var resolved = ResolveTemplate(template, inputs);

        // 3. Single LLM call with optional streaming and retry
        var modelId = ResolveModelId(block, inputs);
        var request = new LLMRequest { Prompt = resolved, ModelId = modelId };
        var response = await CallLLMWithRetry(request, block, context, ct);

        // 4. Parse outputs
        var result = new BlockExecutionResult();
        if (response != null)
        {
            ParseOutputs(result, response.Content, block);
            result.Logs.Add("LLM response received");
        }
        else
        {
            result.Logs.Add("LLM call failed after retries");
        }

        result.DurationMs = sw.ElapsedMilliseconds;
        return result;
    }

    private async Task<string> LoadTemplate(BlockDefinition block, CancellationToken ct)
    {
        var path = GetBlockPath(block);
        if (path != null)
        {
            var file = Path.Combine(path, "prompt.md");
            if (File.Exists(file))
                return await File.ReadAllTextAsync(file, ct);
        }

        if (block.Config != null && block.Config.TryGetValue("template", out var t))
            return t?.ToString() ?? string.Empty;

        return string.Empty;
    }

    private async Task<LLMResponse?> CallLLMWithRetry(
        LLMRequest request, BlockDefinition block,
        ExecutionContext context, CancellationToken ct)
    {
        LLMResponse? response = null;

        // Check whether this block requests streaming (opt-in)
        var wantsStream = block.Config != null
            && block.Config.TryGetValue("stream", out var s) && s is bool b && b;

        if (wantsStream)
        {
            try
            {
                var sb = new System.Text.StringBuilder();
                await foreach (var chunk in _llmGateway.StreamAsync(request, ct))
                {
                    if (string.IsNullOrEmpty(chunk)) continue;
                    sb.Append(chunk);
                    context?.LogInfo("LLM stream chunk received");
                    if (_monitor != null)
                        await _monitor.PublishTerminalOutputAsync(chunk, ct);
                }
                response = new LLMResponse { Content = sb.ToString() };
            }
            catch (NotSupportedException) { }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception ex)
            {
                context?.LogInfo($"LLM streaming failed: {ex.Message}");
            }
        }

        if (response == null)
        {
            var attempts = 0;
            var maxAttempts = 3;
            var delayMs = 200;

            while (attempts < maxAttempts)
            {
                attempts++;
                try
                {
                    response = await _llmGateway.SendAsync(request, ct);
                    break;
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
                catch (Exception ex) when (attempts < maxAttempts)
                {
                    await Task.Delay(delayMs, ct);
                    delayMs *= 2;
                    context?.LogInfo($"LLM call failed attempt {attempts}: {ex.Message}");
                }
            }
        }

        return response;
    }
}
