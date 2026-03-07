namespace Maestro.Application.Interfaces;

/// <summary>
/// Provides model pricing information from LLM-Provider.
/// Caches prices in memory with a 5-minute TTL.
/// </summary>
public interface IModelPricingService
{
    /// <summary>
    /// Get pricing for a model. Returns null if model not found in cache or provider.
    /// Falls back to default pricing for unknown cloud/local models.
    /// </summary>
    Task<ModelPricing?> GetPricingAsync(string modelId, CancellationToken ct = default);

    /// <summary>
    /// Estimate cost from token counts. Uses cached pricing.
    /// Returns 0 for null/empty modelId or zero tokens.
    /// </summary>
    Task<decimal> EstimateCostAsync(string modelId, int promptTokens, int completionTokens, CancellationToken ct = default);
}

/// <summary>
/// Pricing information for a model (per million tokens).
/// </summary>
public record ModelPricing(
    decimal InputPricePerMillion,
    decimal OutputPricePerMillion,
    double? ParametersBillions);
