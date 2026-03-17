using LLMProvider.Application.Interfaces;
using LLMProvider.Application.Interfaces.Providers;
using LLMProvider.Application.Interfaces.Repositories;
using LLMProvider.Application.Options;
using LLMProvider.Application.Services;
using LLMProvider.Application.Services.Queue;
using LLMProvider.Infrastructure.Persistence;
using LLMProvider.Infrastructure.Providers;
using LLMProvider.Infrastructure.Queue;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LLMProvider.Infrastructure;

/// <summary>
/// Extension methods for registering infrastructure services.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds infrastructure services to the service collection.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        // Persistence
        services.AddSingleton<InMemoryConversationRepository>();
        services.AddSingleton<IConversationRepository>(sp =>
            sp.GetRequiredService<InMemoryConversationRepository>());

        // Provider factory
        services.AddSingleton<ILLMProviderFactory, LLMProviderFactory>();

        // Model registry
        services.AddSingleton<IModelRegistry, ModelRegistryService>();

        return services;
    }

    /// <summary>
    /// Adds infrastructure services that require configuration.
    /// </summary>
    public static IServiceCollection AddInfrastructureWithConfiguration(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Provider priority options (Providers:Priority section in config)
        services.Configure<ProviderPriorityOptions>(
            configuration.GetSection(ProviderPriorityOptions.SectionName));

        return services;
    }

    /// <summary>
    /// Adds application services to the service collection.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">The application configuration.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration configuration)
    {
        // Options
        services.Configure<StatisticsOptions>(configuration.GetSection(StatisticsOptions.SectionName));
        services.Configure<QueueOptions>(configuration.GetSection(QueueOptions.SectionName));

        // Statistics (singleton, concrete type registered so write methods are accessible)
        services.AddSingleton<StatisticsService>();
        services.AddSingleton<IStatisticsService>(sp => sp.GetRequiredService<StatisticsService>());

        // Queue
        services.AddSingleton<IRequestQueue, PriorityRequestQueue>();
        services.AddSingleton<ModelSwitchOptimizer>();
        services.AddHostedService<QueueProcessorService>();

        // Core services
        services.AddSingleton<MemoryManagementService>();
        services.AddSingleton<TokenAccountingService>();
        services.AddScoped<ConversationService>();
        services.AddScoped<LLMOrchestrationService>();

        return services;
    }
}
