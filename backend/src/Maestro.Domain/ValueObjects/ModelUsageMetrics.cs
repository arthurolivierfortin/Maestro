namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Metrics for a single LLM model invocation.
/// </summary>
public record ModelUsageMetrics
{
    /// <summary>
    /// Unique identifier for this metrics record.
    /// </summary>
    public string Id { get; init; } = Guid.NewGuid().ToString();

    /// <summary>
    /// The model that was used.
    /// </summary>
    public string ModelId { get; init; } = string.Empty;

    /// <summary>
    /// The provider (openai, anthropic, ollama, etc.).
    /// </summary>
    public string Provider { get; init; } = string.Empty;

    /// <summary>
    /// The execution this invocation belongs to.
    /// </summary>
    public string ExecutionId { get; init; } = string.Empty;

    /// <summary>
    /// The block that made this LLM call.
    /// </summary>
    public string BlockId { get; init; } = string.Empty;

    /// <summary>
    /// Number of tokens in the prompt/input.
    /// </summary>
    public int PromptTokens { get; init; }

    /// <summary>
    /// Number of tokens in the completion/output.
    /// </summary>
    public int CompletionTokens { get; init; }

    /// <summary>
    /// Total tokens used (prompt + completion).
    /// </summary>
    public int TotalTokens => PromptTokens + CompletionTokens;

    /// <summary>
    /// Total latency in milliseconds (request to response).
    /// </summary>
    public long LatencyMs { get; init; }

    /// <summary>
    /// Time to first token in milliseconds (for streaming).
    /// </summary>
    public long? TimeToFirstTokenMs { get; init; }

    /// <summary>
    /// Tokens generated per second (for streaming).
    /// </summary>
    public double? TokensPerSecond { get; init; }

    /// <summary>
    /// Cost for input tokens in USD.
    /// </summary>
    public decimal InputCostUsd { get; init; }

    /// <summary>
    /// Cost for output tokens in USD.
    /// </summary>
    public decimal OutputCostUsd { get; init; }

    /// <summary>
    /// Total cost in USD.
    /// </summary>
    public decimal TotalCostUsd => InputCostUsd + OutputCostUsd;

    /// <summary>
    /// Quality score (0-100) if evaluated.
    /// </summary>
    public int? QualityScore { get; init; }

    /// <summary>
    /// How quality was evaluated (heuristic, llm, human, automated).
    /// </summary>
    public string? EvaluationMethod { get; init; }

    /// <summary>
    /// Whether the call was successful.
    /// </summary>
    public bool Success { get; init; } = true;

    /// <summary>
    /// Error message if the call failed.
    /// </summary>
    public string? ErrorMessage { get; init; }

    /// <summary>
    /// When this invocation occurred.
    /// </summary>
    public DateTimeOffset Timestamp { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Temperature setting used.
    /// </summary>
    public float? Temperature { get; init; }

    /// <summary>
    /// Max tokens setting used.
    /// </summary>
    public int? MaxTokens { get; init; }

    /// <summary>
    /// Create a successful model usage record.
    /// </summary>
    public static ModelUsageMetrics Create(
        string modelId,
        string provider,
        string executionId,
        string blockId,
        int promptTokens,
        int completionTokens,
        long latencyMs,
        decimal inputCostUsd,
        decimal outputCostUsd,
        float? temperature = null,
        int? maxTokens = null,
        long? timeToFirstTokenMs = null)
    {
        var metrics = new ModelUsageMetrics
        {
            ModelId = modelId,
            Provider = provider,
            ExecutionId = executionId,
            BlockId = blockId,
            PromptTokens = promptTokens,
            CompletionTokens = completionTokens,
            LatencyMs = latencyMs,
            InputCostUsd = inputCostUsd,
            OutputCostUsd = outputCostUsd,
            Temperature = temperature,
            MaxTokens = maxTokens,
            TimeToFirstTokenMs = timeToFirstTokenMs,
            Success = true,
            Timestamp = DateTimeOffset.UtcNow
        };

        // Calculate tokens per second if we have completion tokens and latency
        if (completionTokens > 0 && latencyMs > 0)
        {
            metrics = metrics with { TokensPerSecond = completionTokens / (latencyMs / 1000.0) };
        }

        return metrics;
    }

    /// <summary>
    /// Create a failed model usage record.
    /// </summary>
    public static ModelUsageMetrics CreateFailed(
        string modelId,
        string provider,
        string executionId,
        string blockId,
        string errorMessage,
        long latencyMs,
        int promptTokens = 0)
    {
        return new ModelUsageMetrics
        {
            ModelId = modelId,
            Provider = provider,
            ExecutionId = executionId,
            BlockId = blockId,
            PromptTokens = promptTokens,
            LatencyMs = latencyMs,
            Success = false,
            ErrorMessage = errorMessage,
            Timestamp = DateTimeOffset.UtcNow
        };
    }
}
