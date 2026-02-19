using LLMProvider.Application.Interfaces.Providers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LLMProvider.AzureProvider;

/// <summary>
/// Extension methods for registering the Azure provider.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds the Azure OpenAI provider to the service collection.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">The configuration.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddAzureProvider(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<AzureProviderOptions>(
            configuration.GetSection(AzureProviderOptions.SectionName));

        services.AddSingleton<ILLMProvider, AzureLLMProvider>();

        return services;
    }
}
