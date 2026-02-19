using LLMProvider.Application.Interfaces.Providers;

namespace LLMProvider.Web.Endpoints;

/// <summary>
/// Health check endpoints.
/// </summary>
public static class HealthEndpoints
{
    public static void MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/health")
            .WithTags("Health");

        group.MapGet("/", GetHealth)
            .WithName("GetHealth")
            .WithSummary("Health check")
            .WithDescription("Returns the health status of the API and all providers.");

        group.MapGet("/live", GetLiveness)
            .WithName("GetLiveness")
            .WithSummary("Liveness check")
            .WithDescription("Returns OK if the service is running.");

        group.MapGet("/ready", GetReadiness)
            .WithName("GetReadiness")
            .WithSummary("Readiness check")
            .WithDescription("Returns OK if at least one provider is available.");
    }

    private static async Task<IResult> GetHealth(
        ILLMProviderFactory providerFactory,
        CancellationToken cancellationToken)
    {
        var registeredProviders = providerFactory.GetRegisteredProviders().ToList();
        var providerStatuses = new Dictionary<string, ProviderHealthStatus>();

        foreach (var providerType in registeredProviders)
        {
            if (providerFactory.TryGetProvider(providerType, out var provider) && provider is not null)
            {
                bool isAvailable;
                try
                {
                    isAvailable = await provider.IsAvailableAsync(cancellationToken);
                }
                catch
                {
                    // Provider threw during availability check (e.g., claude CLI not installed,
                    // GPU driver crash, network timeout). Report as unavailable instead of
                    // crashing the entire health endpoint with 500.
                    isAvailable = false;
                }
                providerStatuses[providerType.ToString()] = new ProviderHealthStatus
                {
                    Name = provider.Name,
                    IsAvailable = isAvailable
                };
            }
        }

        var anyAvailable = providerStatuses.Values.Any(p => p.IsAvailable);

        return Results.Ok(new HealthResponse
        {
            Status = anyAvailable ? "healthy" : "degraded",
            Timestamp = DateTimeOffset.UtcNow,
            Providers = providerStatuses
        });
    }

    private static IResult GetLiveness()
    {
        return Results.Ok(new { status = "alive", timestamp = DateTimeOffset.UtcNow });
    }

    private static async Task<IResult> GetReadiness(
        ILLMProviderFactory providerFactory,
        CancellationToken cancellationToken)
    {
        var availableProviders = await providerFactory.GetAvailableProvidersAsync(cancellationToken);

        if (availableProviders.Count > 0)
        {
            return Results.Ok(new
            {
                status = "ready",
                timestamp = DateTimeOffset.UtcNow,
                availableProviders = availableProviders.Select(p => p.ProviderType.ToString())
            });
        }

        return Results.Json(new
        {
            status = "not_ready",
            timestamp = DateTimeOffset.UtcNow,
            reason = "No providers available"
        }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}

public record HealthResponse
{
    public required string Status { get; init; }
    public required DateTimeOffset Timestamp { get; init; }
    public required Dictionary<string, ProviderHealthStatus> Providers { get; init; }
}

public record ProviderHealthStatus
{
    public required string Name { get; init; }
    public required bool IsAvailable { get; init; }
}
