namespace Maestro.Domain.ValueObjects;

/// <summary>
/// Metrics captured during the execution of a single block.
/// </summary>
public record BlockMetrics
{
    /// <summary>
    /// The block that was executed.
    /// </summary>
    public string BlockId { get; init; } = string.Empty;

    /// <summary>
    /// The type of block (prompt, tool, inference, etc.).
    /// </summary>
    public string BlockType { get; init; } = string.Empty;

    /// <summary>
    /// The execution this block belongs to.
    /// </summary>
    public string ExecutionId { get; init; } = string.Empty;

    /// <summary>
    /// When the block started executing.
    /// </summary>
    public DateTimeOffset StartedAt { get; init; }

    /// <summary>
    /// When the block finished executing.
    /// </summary>
    public DateTimeOffset? CompletedAt { get; init; }

    /// <summary>
    /// Total execution duration in milliseconds.
    /// </summary>
    public long DurationMs { get; init; }

    /// <summary>
    /// Time spent waiting in queue before execution (ms).
    /// </summary>
    public long QueueTimeMs { get; init; }

    /// <summary>
    /// Size of input data in bytes.
    /// </summary>
    public long InputSizeBytes { get; init; }

    /// <summary>
    /// Size of output data in bytes.
    /// </summary>
    public long OutputSizeBytes { get; init; }

    /// <summary>
    /// Number of input tokens (for LLM-based blocks).
    /// </summary>
    public int? InputTokens { get; init; }

    /// <summary>
    /// Number of output tokens (for LLM-based blocks).
    /// </summary>
    public int? OutputTokens { get; init; }

    /// <summary>
    /// Estimated compute cost in USD.
    /// </summary>
    public decimal ComputeCostUsd { get; init; }

    /// <summary>
    /// Whether the block executed successfully.
    /// </summary>
    public bool Success { get; init; }

    /// <summary>
    /// Number of retry attempts before success/failure.
    /// </summary>
    public int RetryCount { get; init; }

    /// <summary>
    /// Error code if the block failed.
    /// </summary>
    public string? ErrorCode { get; init; }

    /// <summary>
    /// Error message if the block failed.
    /// </summary>
    public string? ErrorMessage { get; init; }

    /// <summary>
    /// Model ID used (for inference/agent blocks).
    /// </summary>
    public string? ModelId { get; init; }

    /// <summary>
    /// Model provider (openai, anthropic, ollama, etc.).
    /// </summary>
    public string? ModelProvider { get; init; }

    /// <summary>
    /// Create metrics for a successful block execution.
    /// </summary>
    public static BlockMetrics CreateSuccess(
        string blockId,
        string blockType,
        string executionId,
        DateTimeOffset startedAt,
        DateTimeOffset completedAt,
        long inputSizeBytes = 0,
        long outputSizeBytes = 0,
        int? inputTokens = null,
        int? outputTokens = null,
        decimal computeCostUsd = 0,
        string? modelId = null,
        string? modelProvider = null,
        int retryCount = 0,
        long queueTimeMs = 0)
    {
        return new BlockMetrics
        {
            BlockId = blockId,
            BlockType = blockType,
            ExecutionId = executionId,
            StartedAt = startedAt,
            CompletedAt = completedAt,
            DurationMs = (long)(completedAt - startedAt).TotalMilliseconds,
            QueueTimeMs = queueTimeMs,
            InputSizeBytes = inputSizeBytes,
            OutputSizeBytes = outputSizeBytes,
            InputTokens = inputTokens,
            OutputTokens = outputTokens,
            ComputeCostUsd = computeCostUsd,
            Success = true,
            RetryCount = retryCount,
            ModelId = modelId,
            ModelProvider = modelProvider
        };
    }

    /// <summary>
    /// Create metrics for a failed block execution.
    /// </summary>
    public static BlockMetrics CreateFailure(
        string blockId,
        string blockType,
        string executionId,
        DateTimeOffset startedAt,
        DateTimeOffset completedAt,
        string errorCode,
        string errorMessage,
        int retryCount = 0,
        long queueTimeMs = 0)
    {
        return new BlockMetrics
        {
            BlockId = blockId,
            BlockType = blockType,
            ExecutionId = executionId,
            StartedAt = startedAt,
            CompletedAt = completedAt,
            DurationMs = (long)(completedAt - startedAt).TotalMilliseconds,
            QueueTimeMs = queueTimeMs,
            Success = false,
            RetryCount = retryCount,
            ErrorCode = errorCode,
            ErrorMessage = errorMessage
        };
    }
}
