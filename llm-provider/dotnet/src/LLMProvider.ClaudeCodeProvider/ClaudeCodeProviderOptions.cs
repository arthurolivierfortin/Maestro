namespace LLMProvider.ClaudeCodeProvider;

/// <summary>
/// Configuration options for the Claude Code CLI provider.
/// </summary>
public sealed class ClaudeCodeProviderOptions
{
    public const string SectionName = "Providers:ClaudeCode";

    /// <summary>
    /// Path to the claude CLI executable. Null uses "claude" from PATH.
    /// </summary>
    public string CliPath { get; set; } = "claude";

    /// <summary>
    /// Default model alias to use (sonnet, opus, haiku).
    /// </summary>
    public string DefaultModel { get; set; } = "sonnet";

    /// <summary>
    /// Timeout in seconds for CLI execution.
    /// 300s allows for complex prompts with large context windows.
    /// </summary>
    public int TimeoutSeconds { get; set; } = 300;

    /// <summary>
    /// Max agent turns. 1 = stateless single-shot (recommended for Maestro).
    /// </summary>
    public int MaxTurns { get; set; } = 1;

    /// <summary>
    /// Available Claude models with metadata.
    /// </summary>
    public List<ClaudeModelConfig> Models { get; set; } =
    [
        new() { ModelId = "claude-sonnet", Alias = "sonnet", ContextLength = 200000, Capabilities = ["chat", "code", "reasoning"] },
        new() { ModelId = "claude-opus", Alias = "opus", ContextLength = 200000, Capabilities = ["chat", "code", "reasoning"] },
        new() { ModelId = "claude-haiku", Alias = "haiku", ContextLength = 200000, Capabilities = ["chat", "code"] },
        new() { ModelId = "sonnet", Alias = "sonnet", ContextLength = 200000, Capabilities = ["chat", "code", "reasoning"] },
        new() { ModelId = "opus", Alias = "opus", ContextLength = 200000, Capabilities = ["chat", "code", "reasoning"] },
        new() { ModelId = "haiku", Alias = "haiku", ContextLength = 200000, Capabilities = ["chat", "code"] },
        new() { ModelId = "claude-sonnet-4-6", Alias = "sonnet", ContextLength = 200000, Capabilities = ["chat", "code", "reasoning"] },
        new() { ModelId = "claude-opus-4-6", Alias = "opus", ContextLength = 200000, Capabilities = ["chat", "code", "reasoning"] },
        new() { ModelId = "claude-haiku-4-5-20251001", Alias = "haiku", ContextLength = 200000, Capabilities = ["chat", "code"] },
        new() { ModelId = "claude-haiku-4-5", Alias = "haiku", ContextLength = 200000, Capabilities = ["chat", "code"] }
    ];
}

/// <summary>
/// Configuration for an individual Claude model.
/// </summary>
public sealed class ClaudeModelConfig
{
    /// <summary>Model ID used in requests (e.g. "claude-sonnet", "sonnet").</summary>
    public string ModelId { get; set; } = "";

    /// <summary>CLI alias passed to --model flag (e.g. "sonnet").</summary>
    public string Alias { get; set; } = "";

    /// <summary>Context window size in tokens.</summary>
    public int ContextLength { get; set; } = 200000;

    /// <summary>Model capabilities (chat, code, reasoning, etc.).</summary>
    public List<string> Capabilities { get; set; } = [];
}
