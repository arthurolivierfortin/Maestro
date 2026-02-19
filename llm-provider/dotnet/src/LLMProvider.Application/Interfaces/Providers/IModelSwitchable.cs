namespace LLMProvider.Application.Interfaces.Providers;

/// <summary>
/// Interface for providers that support switching between models at runtime.
/// </summary>
public interface IModelSwitchable
{
    Task SwitchModelAsync(string modelId, CancellationToken cancellationToken = default);
    Task<string?> GetActiveModelAsync(CancellationToken cancellationToken = default);
}
