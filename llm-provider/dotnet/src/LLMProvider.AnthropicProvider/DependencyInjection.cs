using LLMProvider.Application.Interfaces.Providers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LLMProvider.AnthropicProvider;

/// <summary>
/// Extension methods for registering the Anthropic API provider.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds the Anthropic API provider to the service collection.
    /// Only registers the provider if an API key is configured.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">The configuration.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddAnthropicProvider(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<AnthropicOptions>(
            configuration.GetSection(AnthropicOptions.SectionName));

        services.AddHttpClient("Anthropic");

        services.AddSingleton<ILLMProvider, AnthropicLLMProvider>();

        return services;
    }
}
