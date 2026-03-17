using LLMProvider.Application.Interfaces.Providers;
using LLMProvider.Domain.Enums;

namespace LLMProvider.Web.Endpoints;

/// <summary>
/// Endpoints for provider conflict detection and priority management.
/// </summary>
public static class ProvidersEndpoints
{
    public static void MapProvidersEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/providers")
            .WithTags("Providers");

        group.MapGet("/conflicts", GetConflicts)
            .WithName("GetProviderConflicts")
            .WithSummary("Detect model conflicts")
            .WithDescription("Returns models supported by multiple providers, with current preference.");

        group.MapPut("/priority", SetPriority)
            .WithName("SetProviderPriority")
            .WithSummary("Set provider preference for a model")
            .WithDescription("Persists the user's preferred provider for a model that has multiple providers.");
    }

    private static async Task<IResult> GetConflicts(
        ILLMProviderFactory providerFactory,
        CancellationToken cancellationToken)
    {
        var conflicts = await providerFactory.DetectModelConflictsAsync(cancellationToken);

        var response = conflicts.Select(c => new ConflictResponse
        {
            ModelId = c.ModelId,
            Providers = c.Providers.Select(p => p.ToString()).ToList(),
            Preferred = c.Preferred?.ToString()
        });

        return Results.Ok(new { conflicts = response });
    }

    private static IResult SetPriority(
        SetPriorityRequest request,
        ILLMProviderFactory providerFactory)
    {
        if (string.IsNullOrWhiteSpace(request.ModelId))
        {
            return Results.BadRequest(new { error = "modelId is required" });
        }

        if (string.IsNullOrWhiteSpace(request.PreferredProvider))
        {
            return Results.BadRequest(new { error = "preferredProvider is required" });
        }

        if (!Enum.TryParse<ProviderType>(request.PreferredProvider, ignoreCase: true, out var providerType))
        {
            return Results.BadRequest(new { error = $"Unknown provider: {request.PreferredProvider}" });
        }

        providerFactory.SetModelPreference(request.ModelId, providerType);

        return Results.Ok(new
        {
            message = $"Preference set: {request.ModelId} → {providerType}",
            modelId = request.ModelId,
            preferredProvider = providerType.ToString()
        });
    }
}

public record ConflictResponse
{
    public required string ModelId { get; init; }
    public required List<string> Providers { get; init; }
    public string? Preferred { get; init; }
}

public record SetPriorityRequest
{
    public string ModelId { get; init; } = "";
    public string PreferredProvider { get; init; } = "";
}
