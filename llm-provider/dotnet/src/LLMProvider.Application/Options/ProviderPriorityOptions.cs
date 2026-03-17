namespace LLMProvider.Application.Options;

/// <summary>
/// Configuration for user-defined provider priority when multiple providers
/// support the same model. Persisted to provider-priority.json.
/// </summary>
public sealed class ProviderPriorityOptions
{
    public const string SectionName = "Providers:Priority";

    /// <summary>
    /// Map of modelId → preferred ProviderType name.
    /// Example: { "claude-sonnet-4-6": "Anthropic" }
    /// </summary>
    public Dictionary<string, string> ModelPreferences { get; set; } = new();
}
