using LLMProvider.Application.Interfaces.Providers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LLMProvider.ClaudeCodeProvider;

/// <summary>
/// Extension methods for registering the Claude Code provider.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds the Claude Code CLI provider to the service collection.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">The configuration.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddClaudeCodeProvider(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<ClaudeCodeProviderOptions>(
            configuration.GetSection(ClaudeCodeProviderOptions.SectionName));

        // No HttpClient needed — this provider spawns CLI processes
        services.AddSingleton<ILLMProvider, ClaudeCodeLLMProvider>();

        return services;
    }
}
