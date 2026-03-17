using LLMProvider.Domain.Enums;

namespace LLMProvider.Domain.Entities;

/// <summary>
/// Represents a conflict where multiple providers support the same model.
/// </summary>
public sealed record ModelConflict(
    string ModelId,
    List<ProviderType> Providers,
    ProviderType? Preferred);
