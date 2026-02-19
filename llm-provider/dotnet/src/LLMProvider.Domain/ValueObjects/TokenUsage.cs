namespace LLMProvider.Domain.ValueObjects;

/// <summary>
/// Represents token usage statistics for an LLM request/response.
/// This is an immutable value object.
/// </summary>
public sealed record TokenUsage
{
    /// <summary>
    /// Number of tokens in the prompt/input.
    /// </summary>
    public int PromptTokens { get; }

    /// <summary>
    /// Number of tokens in the completion/output.
    /// </summary>
    public int CompletionTokens { get; }

    /// <summary>
    /// Total number of tokens (prompt + completion).
    /// </summary>
    public int TotalTokens => PromptTokens + CompletionTokens;

    /// <summary>
    /// Creates a new TokenUsage instance.
    /// </summary>
    /// <param name="promptTokens">Number of prompt tokens.</param>
    /// <param name="completionTokens">Number of completion tokens.</param>
    /// <exception cref="ArgumentOutOfRangeException">
    /// Thrown when token counts are negative.
    /// </exception>
    public TokenUsage(int promptTokens, int completionTokens)
    {
        if (promptTokens < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(promptTokens), "Prompt tokens cannot be negative.");
        }

        if (completionTokens < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(completionTokens), "Completion tokens cannot be negative.");
        }

        PromptTokens = promptTokens;
        CompletionTokens = completionTokens;
    }

    /// <summary>
    /// Creates a TokenUsage representing zero usage.
    /// </summary>
    public static TokenUsage Zero => new(0, 0);

    /// <summary>
    /// Adds two TokenUsage instances together.
    /// </summary>
    public static TokenUsage operator +(TokenUsage left, TokenUsage right) =>
        new(left.PromptTokens + right.PromptTokens, left.CompletionTokens + right.CompletionTokens);

    /// <inheritdoc />
    public override string ToString() =>
        $"Tokens: {TotalTokens} (prompt: {PromptTokens}, completion: {CompletionTokens})";
}
