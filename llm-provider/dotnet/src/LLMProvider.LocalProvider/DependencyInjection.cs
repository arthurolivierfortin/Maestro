using LLMProvider.Application.Interfaces.Providers;
using LLMProvider.LocalProvider.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LLMProvider.LocalProvider;

/// <summary>
/// Extension methods for registering the Local provider.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds the Local LLM provider to the service collection.
    /// This includes the Python server auto-start hosted service.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">The configuration.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddLocalProvider(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Configure options
        services.Configure<LocalProviderOptions>(
            configuration.GetSection(LocalProviderOptions.SectionName));

        // Add the Python server hosted service (auto-starts the server)
        services.AddHostedService<PythonServerHostedService>();

        // Add the HTTP client for the provider
        services.AddHttpClient<ILLMProvider, LocalLLMProvider>((sp, client) =>
        {
            var options = configuration
                .GetSection(LocalProviderOptions.SectionName)
                .Get<LocalProviderOptions>() ?? new LocalProviderOptions();

            client.BaseAddress = new Uri(options.BaseUrl);
            client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
        });

        return services;
    }
}
