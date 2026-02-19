using Maestro.Application.DTOs;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Admin operations for the LLM Provider (health, models, hardware).
/// Separated from ILLMGateway which handles inference (send/stream).
/// </summary>
public interface ILLMProviderService
{
    Task<LLMProviderHealth> GetHealthAsync(CancellationToken ct = default);
    Task<SystemCapabilities> GetSystemCapabilitiesAsync(CancellationToken ct = default);
    Task<CompatibleModelsResponse> GetCompatibleModelsAsync(string? category = null, CancellationToken ct = default);
    Task<LocalModelsResponse> GetLocalModelsAsync(CancellationToken ct = default);
    Task<RegistryModelsResponse> GetRegistryModelsAsync(string? category = null, CancellationToken ct = default);
    Task<SwitchModelResult> SwitchModelAsync(string modelId, bool use8bit = false, CancellationToken ct = default);
    Task<LoadModelResult> LoadModelAsync(string modelId, bool use8bit = false, CancellationToken ct = default);
}
