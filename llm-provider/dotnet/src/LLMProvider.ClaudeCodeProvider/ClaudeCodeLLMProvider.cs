using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json;
using LLMProvider.Application.DTOs;
using LLMProvider.Application.Interfaces.Providers;
using LLMProvider.Domain.Entities;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LLMProvider.ClaudeCodeProvider;

/// <summary>
/// LLM provider that delegates to the Claude Code CLI (`claude -p`).
/// Spawns a process per request in stateless mode.
/// </summary>
public sealed class ClaudeCodeLLMProvider : ILLMProvider
{
    private readonly ClaudeCodeProviderOptions _options;
    private readonly ILogger<ClaudeCodeLLMProvider> _logger;

    private static readonly Dictionary<string, string> ModelAliasMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["claude-sonnet"] = "sonnet",
        ["claude-opus"] = "opus",
        ["claude-haiku"] = "haiku"
    };

    public ProviderType ProviderType => ProviderType.Anthropic;
    public string Name => "Claude Code";

    public ClaudeCodeLLMProvider(
        IOptions<ClaudeCodeProviderOptions> options,
        ILogger<ClaudeCodeLLMProvider> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            using var process = new Process();
            process.StartInfo = new ProcessStartInfo
            {
                FileName = _options.CliPath,
                Arguments = "--version",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            // Allow spawning claude CLI from within a Claude Code session
            process.StartInfo.Environment.Remove("CLAUDECODE");
            process.Start();
            await process.WaitForExitAsync(cancellationToken);
            return process.ExitCode == 0;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Claude CLI not available at '{CliPath}'", _options.CliPath);
            return false;
        }
    }

    public Task<IReadOnlyList<ModelInfo>> GetAvailableModelsAsync(CancellationToken cancellationToken = default)
    {
        var models = _options.Models.Select(m => new ModelInfo(
            id: new ModelId(m.ModelId),
            name: $"Claude {m.Alias}",
            provider: ProviderType.Anthropic,
            contextLength: m.ContextLength,
            description: $"Claude model via CLI ({m.Alias})",
            capabilities: m.Capabilities
        )).ToList();

        return Task.FromResult<IReadOnlyList<ModelInfo>>(models);
    }

    public async Task<LLMResponse> CompleteAsync(
        LLMRequest request,
        IReadOnlyList<Message>? conversationHistory = null,
        CancellationToken cancellationToken = default)
    {
        var prompt = BuildPrompt(request.Prompt, conversationHistory);
        var model = ResolveModel(request.ModelId.Value);
        var sw = Stopwatch.StartNew();

        var args = BuildArguments(prompt, model, request.SystemPrompt);

        _logger.LogDebug("Executing claude CLI: {CliPath} --model {Model}", _options.CliPath, model);

        var (stdout, stderr, exitCode) = await RunProcessAsync(args, cancellationToken);
        sw.Stop();

        if (exitCode != 0)
        {
            _logger.LogError("Claude CLI failed (exit {ExitCode}): {Stderr}", exitCode, stderr);
            throw new InvalidOperationException($"Claude CLI failed (exit {exitCode}): {stderr}");
        }

        return ParseResponse(stdout, model, sw.Elapsed);
    }

    public async IAsyncEnumerable<LLMStreamChunk> StreamCompleteAsync(
        LLMRequest request,
        IReadOnlyList<Message>? conversationHistory = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        // Claude Code CLI does not support streaming — yield full response as single chunk
        var response = await CompleteAsync(request, conversationHistory, cancellationToken);
        yield return new LLMStreamChunk
        {
            Content = response.Content,
            IsComplete = true,
            ModelUsed = response.ModelUsed,
            Provider = response.Provider,
            TokenUsage = response.TokenUsage,
            FinishReason = response.FinishReason
        };
    }

    private static string BuildPrompt(string prompt, IReadOnlyList<Message>? conversationHistory)
    {
        if (conversationHistory is not { Count: > 0 })
        {
            return prompt;
        }

        var parts = conversationHistory
            .Where(m => m.Role != Domain.Enums.MessageRole.System)
            .Select(m => m.Content);

        var combined = string.Join("\n\n", parts);
        if (!string.IsNullOrEmpty(prompt))
        {
            combined += "\n\n" + prompt;
        }

        return combined;
    }

    private List<string> BuildArguments(string prompt, string model, string? systemPrompt)
    {
        var args = new List<string>
        {
            "-p", prompt,
            "--output-format", "json",
            "--model", model,
            "--max-turns", _options.MaxTurns.ToString(),
            "--no-session-persistence",
            "--tools", ""  // Disable all built-in tools — pure LLM completion mode
        };

        if (!string.IsNullOrEmpty(systemPrompt))
        {
            args.Add("--system-prompt");
            args.Add(systemPrompt);
        }

        return args;
    }

    private async Task<(string stdout, string stderr, int exitCode)> RunProcessAsync(
        List<string> args, CancellationToken cancellationToken)
    {
        using var process = new Process();
        process.StartInfo = new ProcessStartInfo
        {
            FileName = _options.CliPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        foreach (var arg in args)
        {
            process.StartInfo.ArgumentList.Add(arg);
        }

        // Allow spawning claude CLI from within a Claude Code session
        process.StartInfo.Environment.Remove("CLAUDECODE");

        process.Start();

        var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(_options.TimeoutSeconds));

        try
        {
            await process.WaitForExitAsync(timeoutCts.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            try { process.Kill(entireProcessTree: true); } catch { /* best effort */ }
            throw new TimeoutException($"Claude CLI timed out after {_options.TimeoutSeconds}s");
        }

        return (await stdoutTask, await stderrTask, process.ExitCode);
    }

    private LLMResponse ParseResponse(string stdout, string model, TimeSpan duration)
    {
        try
        {
            using var doc = JsonDocument.Parse(stdout);
            var root = doc.RootElement;

            var content = root.TryGetProperty("result", out var r) ? r.GetString() ?? "" : "";
            var actualModel = root.TryGetProperty("model", out var m) ? m.GetString() ?? model : model;

            int promptTokens = 0, completionTokens = 0;
            if (root.TryGetProperty("usage", out var usage))
            {
                promptTokens = usage.TryGetProperty("input_tokens", out var it) ? it.GetInt32() : 0;
                completionTokens = usage.TryGetProperty("output_tokens", out var ot) ? ot.GetInt32() : 0;
            }

            return new LLMResponse
            {
                Content = content,
                ModelUsed = new ModelId(actualModel),
                Provider = ProviderType.Anthropic,
                TokenUsage = new TokenUsage(promptTokens, completionTokens),
                Duration = duration,
                FinishReason = "stop"
            };
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to parse Claude CLI JSON output, using raw text");
            return new LLMResponse
            {
                Content = stdout.Trim(),
                ModelUsed = new ModelId(model),
                Provider = ProviderType.Anthropic,
                TokenUsage = TokenUsage.Zero,
                Duration = duration,
                FinishReason = "stop"
            };
        }
    }

    private string ResolveModel(string modelId)
    {
        if (ModelAliasMap.TryGetValue(modelId, out var alias))
        {
            return alias;
        }

        return string.IsNullOrEmpty(modelId) ? _options.DefaultModel : modelId;
    }
}
