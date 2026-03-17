namespace LLMProvider.Domain.Enums;

/// <summary>
/// Enumerates the supported LLM provider types.
/// </summary>
public enum ProviderType
{
    /// <summary>Azure OpenAI Service.</summary>
    Azure = 1,

    /// <summary>Local LLM running via Python/FastAPI.</summary>
    Local = 2,

    /// <summary>OpenAI direct API (future).</summary>
    OpenAI = 3,

    /// <summary>Anthropic Claude API (future).</summary>
    Anthropic = 4,

    /// <summary>Ollama local provider (future).</summary>
    Ollama = 5,

    /// <summary>Azure AI Inference (Llama, Mistral, Phi, Cohere, etc.).</summary>
    AzureInference = 6,

    /// <summary>GitHub Models (free tier, OpenAI-compatible API).</summary>
    GitHubModels = 7,

    /// <summary>Claude Code CLI wrapper (uses claude CLI binary, slower than direct API).</summary>
    ClaudeCode = 8
}
