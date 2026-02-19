namespace LLMProvider.LocalProvider;

/// <summary>
/// Configuration options for the Local LLM provider.
/// </summary>
public sealed class LocalProviderOptions
{
    /// <summary>
    /// Configuration section name.
    /// </summary>
    public const string SectionName = "Providers:Local";

    /// <summary>
    /// The base URL of the local Python FastAPI service.
    /// </summary>
    public string BaseUrl { get; init; } = "http://localhost:8000";

    /// <summary>
    /// Request timeout in seconds.
    /// </summary>
    public int TimeoutSeconds { get; init; } = 120;

    /// <summary>
    /// Maximum number of retries for failed requests.
    /// </summary>
    public int MaxRetries { get; init; } = 3;

    /// <summary>
    /// The default model to load on startup.
    /// </summary>
    public string DefaultModel { get; init; } = "deepseek-ai/deepseek-coder-1.3b-instruct";

    /// <summary>
    /// Whether to automatically start the Python server when the .NET app starts.
    /// </summary>
    public bool AutoStart { get; init; } = true;

    /// <summary>
    /// Path to the Python executable.
    /// </summary>
    public string PythonPath { get; init; } = "python";

    /// <summary>
    /// Path to the LLM-Provider project root (containing api/server.py).
    /// </summary>
    public string ProjectPath { get; init; } = "";

    /// <summary>
    /// Port for the Python server.
    /// </summary>
    public int Port { get; init; } = 8000;

    /// <summary>
    /// Whether to preload the default model on startup.
    /// </summary>
    public bool PreloadModel { get; init; } = true;

    /// <summary>
    /// Whether to use 8-bit quantization for memory efficiency.
    /// </summary>
    public bool Use8BitQuantization { get; init; } = false;
}
