using LLMProvider.Application.Interfaces.Providers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LLMProvider.GitHubModelsProvider;

/// <summary>
/// Extension methods for registering the GitHub Models provider.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds the GitHub Models provider to the service collection.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">The configuration.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddGitHubModelsProvider(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<GitHubModelsOptions>(
            configuration.GetSection(GitHubModelsOptions.SectionName));

        services.AddHttpClient("GitHubModels");

        services.AddSingleton<ILLMProvider, GitHubModelsLLMProvider>();

        return services;
    }
}
