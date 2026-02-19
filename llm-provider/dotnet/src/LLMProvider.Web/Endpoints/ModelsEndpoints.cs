using LLMProvider.Application.Interfaces;
using LLMProvider.Domain.Enums;

namespace LLMProvider.Web.Endpoints;

/// <summary>
/// Endpoints for model discovery.
/// </summary>
public static class ModelsEndpoints
{
    public static void MapModelsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/models")
            .WithTags("Models");

        group.MapGet("/", GetAllModels)
            .WithName("GetAllModels")
            .WithSummary("Get all available models")
            .WithDescription("Returns all models available across all providers.");

        group.MapGet("/provider/{provider}", GetModelsByProvider)
            .WithName("GetModelsByProvider")
            .WithSummary("Get models by provider")
            .WithDescription("Returns all models available from a specific provider.");

        group.MapGet("/{modelId}", GetModel)
            .WithName("GetModel")
            .WithSummary("Get a specific model")
            .WithDescription("Returns detailed information about a specific model.");

        group.MapPost("/refresh", RefreshModels)
            .WithName("RefreshModels")
            .WithSummary("Refresh model cache")
            .WithDescription("Forces a refresh of the model cache from all providers.");
    }

    private static async Task<IResult> GetAllModels(
        IModelRegistry registry,
        CancellationToken cancellationToken)
    {
        var models = await registry.GetAllModelsAsync(cancellationToken);

        var response = models.Select(m => new ModelResponse
        {
            Id = m.Id.Value,
            Name = m.Name,
            Provider = m.Provider.ToString(),
            ContextLength = m.ContextLength,
            MaxOutputTokens = m.MaxOutputTokens,
            InputTokenPrice = m.InputTokenPrice,
            OutputTokenPrice = m.OutputTokenPrice,
            Description = m.Description,
            Capabilities = m.Capabilities.ToList(),
            IsAvailable = m.IsAvailable
        });

        return Results.Ok(new { models = response });
    }

    private static async Task<IResult> GetModelsByProvider(
        string provider,
        IModelRegistry registry,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<ProviderType>(provider, ignoreCase: true, out var providerType))
        {
            return Results.BadRequest(new { error = $"Unknown provider: {provider}" });
        }

        var models = await registry.GetModelsByProviderAsync(providerType, cancellationToken);

        var response = models.Select(m => new ModelResponse
        {
            Id = m.Id.Value,
            Name = m.Name,
            Provider = m.Provider.ToString(),
            ContextLength = m.ContextLength,
            MaxOutputTokens = m.MaxOutputTokens,
            InputTokenPrice = m.InputTokenPrice,
            OutputTokenPrice = m.OutputTokenPrice,
            Description = m.Description,
            Capabilities = m.Capabilities.ToList(),
            IsAvailable = m.IsAvailable
        });

        return Results.Ok(new { models = response });
    }

    private static async Task<IResult> GetModel(
        string modelId,
        IModelRegistry registry,
        CancellationToken cancellationToken)
    {
        var model = await registry.GetModelAsync(modelId, cancellationToken);

        if (model is null)
        {
            return Results.NotFound(new { error = $"Model not found: {modelId}" });
        }

        var response = new ModelResponse
        {
            Id = model.Id.Value,
            Name = model.Name,
            Provider = model.Provider.ToString(),
            ContextLength = model.ContextLength,
            MaxOutputTokens = model.MaxOutputTokens,
            InputTokenPrice = model.InputTokenPrice,
            OutputTokenPrice = model.OutputTokenPrice,
            Description = model.Description,
            Capabilities = model.Capabilities.ToList(),
            IsAvailable = model.IsAvailable
        };

        return Results.Ok(response);
    }

    private static async Task<IResult> RefreshModels(
        IModelRegistry registry,
        CancellationToken cancellationToken)
    {
        await registry.RefreshAsync(cancellationToken);
        return Results.Ok(new { message = "Model cache refreshed" });
    }
}

public record ModelResponse
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Provider { get; init; }
    public required int ContextLength { get; init; }
    public int? MaxOutputTokens { get; init; }
    public decimal? InputTokenPrice { get; init; }
    public decimal? OutputTokenPrice { get; init; }
    public string? Description { get; init; }
    public required List<string> Capabilities { get; init; }
    public required bool IsAvailable { get; init; }
}
