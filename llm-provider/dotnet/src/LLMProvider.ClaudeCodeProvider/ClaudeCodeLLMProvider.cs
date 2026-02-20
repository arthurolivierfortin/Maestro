using System.Collections.Concurrent;
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
/// Supports multi-turn agentic conversations via `--resume` for session continuity.
/// Single-shot requests use `--no-session-persistence` for stateless execution.
/// </summary>
public sealed class ClaudeCodeLLMProvider : ILLMProvider, IDisposable
{
    private readonly ClaudeCodeProviderOptions _options;
    private readonly ILogger<ClaudeCodeLLMProvider> _logger;
    private readonly ConcurrentDictionary<string, CliSessionState> _sessions = new();
    private readonly Timer _cleanupTimer;
    private static readonly TimeSpan SessionTtl = TimeSpan.FromHours(1);
    private bool _disposed;

    private static readonly Dictionary<string, string> ModelAliasMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["claude-sonnet"] = "sonnet",
        ["claude-opus"] = "opus",
        ["claude-haiku"] = "haiku",
        ["claude-sonnet-4-6"] = "sonnet",
        ["claude-opus-4-6"] = "opus",
        ["claude-haiku-4-5-20251001"] = "haiku",
        ["claude-haiku-4-5"] = "haiku"
    };

    public ProviderType ProviderType => ProviderType.Anthropic;
    public string Name => "Claude Code";

    public ClaudeCodeLLMProvider(
        IOptions<ClaudeCodeProviderOptions> options,
        ILogger<ClaudeCodeLLMProvider> logger)
    {
        _options = options.Value;
        _logger = logger;
        _cleanupTimer = new Timer(CleanupExpiredSessions, null,
            TimeSpan.FromMinutes(10), TimeSpan.FromMinutes(10));
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
        var conversationKey = request.ConversationId?.Value.ToString("N");

        // Try --resume for existing conversations
        if (conversationKey != null && _sessions.TryGetValue(conversationKey, out var state))
        {
            try
            {
                return await ResumeAsync(request, state, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex,
                    "--resume failed for CLI session {SessionId}, falling back to fresh call",
                    state.CliSessionId);
                _sessions.TryRemove(conversationKey, out _);
                // Fall through to fresh call
            }
        }

        // Fresh call (first iteration or fallback after --resume failure)
        return await FreshCallAsync(request, conversationHistory, conversationKey, cancellationToken);
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

    /// <summary>
    /// First call in a conversation (or single-shot request).
    /// Uses -p with full conversation context. If conversationKey is set,
    /// captures the CLI session_id for future --resume calls.
    /// </summary>
    private async Task<LLMResponse> FreshCallAsync(
        LLMRequest request,
        IReadOnlyList<Message>? conversationHistory,
        string? conversationKey,
        CancellationToken cancellationToken)
    {
        var prompt = BuildPrompt(request.Prompt, conversationHistory);
        var model = ResolveModel(request.ModelId.Value);
        var sw = Stopwatch.StartNew();

        var args = BuildFreshArguments(prompt, model, request.SystemPrompt,
            sessionPersistence: conversationKey != null);

        _logger.LogDebug("Executing claude CLI (fresh): {CliPath} --model {Model}",
            _options.CliPath, model);

        var (stdout, stderr, exitCode) = await RunProcessAsync(args, cancellationToken);
        sw.Stop();

        if (exitCode != 0)
        {
            _logger.LogError("Claude CLI failed (exit {ExitCode}): {Stderr}", exitCode, stderr);
            throw new InvalidOperationException($"Claude CLI failed (exit {exitCode}): {stderr}");
        }

        var response = ParseResponse(stdout, model, sw.Elapsed);

        // Capture CLI session ID for future --resume calls
        if (conversationKey != null)
        {
            var cliSessionId = ExtractSessionId(stdout);
            if (cliSessionId != null)
            {
                _sessions[conversationKey] = new CliSessionState
                {
                    CliSessionId = cliSessionId,
                    LastUsed = DateTime.UtcNow
                };
                _logger.LogDebug(
                    "Captured CLI session {SessionId} for conversation {ConversationKey}",
                    cliSessionId, conversationKey);
            }
            else
            {
                _logger.LogWarning(
                    "No session_id in Claude CLI output for conversation {ConversationKey}",
                    conversationKey);
            }
        }

        return response;
    }

    /// <summary>
    /// Subsequent call in an existing conversation.
    /// Uses --resume with the CLI session ID. Only sends the latest user message
    /// since Claude CLI already has prior context in its session.
    /// </summary>
    private async Task<LLMResponse> ResumeAsync(
        LLMRequest request,
        CliSessionState state,
        CancellationToken cancellationToken)
    {
        var model = ResolveModel(request.ModelId.Value);
        var sw = Stopwatch.StartNew();

        // With --resume, only send the latest user prompt.
        // Claude CLI already has the full conversation context in its session.
        var args = BuildResumeArguments(request.Prompt, model, state.CliSessionId);

        _logger.LogDebug("Resuming claude CLI session {SessionId}: --model {Model}",
            state.CliSessionId, model);

        var (stdout, stderr, exitCode) = await RunProcessAsync(args, cancellationToken);
        sw.Stop();

        if (exitCode != 0)
        {
            throw new InvalidOperationException(
                $"Claude CLI --resume failed (exit {exitCode}): {stderr}");
        }

        state.LastUsed = DateTime.UtcNow;
        return ParseResponse(stdout, model, sw.Elapsed);
    }

    /// <summary>
    /// Build arguments for a fresh (first) call. Uses -p with full prompt.
    /// When sessionPersistence is true, omits --no-session-persistence so
    /// the CLI creates a session that can be resumed later.
    /// </summary>
    private List<string> BuildFreshArguments(
        string prompt, string model, string? systemPrompt, bool sessionPersistence)
    {
        var args = new List<string>
        {
            "-p", prompt,
            "--output-format", "json",
            "--model", model,
            "--max-turns", _options.MaxTurns.ToString(),
            "--tools", ""  // Disable all built-in tools — pure LLM completion mode
        };

        if (!sessionPersistence)
        {
            args.Add("--no-session-persistence");
        }

        if (!string.IsNullOrEmpty(systemPrompt))
        {
            args.Add("--system-prompt");
            args.Add(systemPrompt);
        }

        return args;
    }

    /// <summary>
    /// Build arguments for a --resume call. Sends only the new user message
    /// to an existing CLI session.
    /// </summary>
    private List<string> BuildResumeArguments(string prompt, string model, string resumeSessionId)
    {
        return new List<string>
        {
            "--resume", resumeSessionId,
            "-p", prompt,
            "--output-format", "json",
            "--model", model,
            "--max-turns", _options.MaxTurns.ToString(),
            "--tools", ""  // Disable all built-in tools — pure LLM completion mode
        };
    }

    private static string BuildPrompt(string prompt, IReadOnlyList<Message>? conversationHistory)
    {
        if (conversationHistory is not { Count: > 0 })
        {
            return prompt;
        }

        // Format conversation with clear role markers so the LLM can distinguish
        // its own previous responses from user messages and tool results.
        // This is used for the FIRST call in a conversation (before --resume is available)
        // and as a fallback if --resume fails.
        var sb = new System.Text.StringBuilder();

        foreach (var msg in conversationHistory)
        {
            if (msg.Role == MessageRole.System)
            {
                continue; // System prompt is passed via --system-prompt flag
            }

            var roleLabel = msg.Role == MessageRole.Assistant
                ? "[assistant]"
                : "[user]";

            sb.AppendLine(roleLabel);
            sb.AppendLine(msg.Content);
            sb.AppendLine();
        }

        // Append the current prompt as the latest user message
        if (!string.IsNullOrEmpty(prompt))
        {
            sb.AppendLine("[user]");
            sb.AppendLine(prompt);
        }

        return sb.ToString().TrimEnd();
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

    /// <summary>
    /// Extracts the session_id from Claude CLI JSON output.
    /// Returns null if the field is not present.
    /// </summary>
    private static string? ExtractSessionId(string stdout)
    {
        try
        {
            using var doc = JsonDocument.Parse(stdout);
            return doc.RootElement.TryGetProperty("session_id", out var sid)
                ? sid.GetString()
                : null;
        }
        catch (JsonException)
        {
            return null;
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

    /// <summary>
    /// Removes a conversation's CLI session from the cache.
    /// Called when an agentic loop completes.
    /// </summary>
    public void CleanupConversation(string conversationKey)
    {
        if (_sessions.TryRemove(conversationKey, out var state))
        {
            _logger.LogDebug("Cleaned up CLI session {SessionId} for conversation {Key}",
                state.CliSessionId, conversationKey);
        }
    }

    private void CleanupExpiredSessions(object? _)
    {
        var cutoff = DateTime.UtcNow - SessionTtl;
        var expired = _sessions
            .Where(kvp => kvp.Value.LastUsed < cutoff)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in expired)
        {
            if (_sessions.TryRemove(key, out var state))
            {
                _logger.LogDebug("Expired CLI session {SessionId} (idle > {Ttl})",
                    state.CliSessionId, SessionTtl);
            }
        }

        if (expired.Count > 0)
        {
            _logger.LogInformation("Cleaned up {Count} expired CLI sessions", expired.Count);
        }
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        _cleanupTimer.Dispose();
    }
}

/// <summary>
/// Tracks a Claude CLI session for --resume continuity within an agentic conversation.
/// </summary>
internal sealed class CliSessionState
{
    /// <summary>Claude CLI session ID (from JSON output session_id field).</summary>
    public required string CliSessionId { get; init; }

    /// <summary>Last time this session was used (for TTL cleanup).</summary>
    public DateTime LastUsed { get; set; }
}
