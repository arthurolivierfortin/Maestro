using LLMProvider.Application.Interfaces.Providers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LLMProvider.AzureInferenceProvider;

/// <summary>
/// Extension methods for registering the Azure AI Inference provider.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds the Azure AI Inference provider to the service collection.
    /// Supports Llama, Mistral, Phi, Cohere, and other Azure AI Model Catalog models.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">The configuration.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddAzureInferenceProvider(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<AzureInferenceProviderOptions>(
            configuration.GetSection(AzureInferenceProviderOptions.SectionName));

        services.AddSingleton<ILLMProvider, AzureInferenceLLMProvider>();

        return services;
    }
}
