using LLMProvider.Application.Interfaces;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Web.Endpoints;

/// <summary>
/// Maps statistics and metrics API endpoints.
/// </summary>
public static class StatisticsEndpoints
{
    public static void MapStatisticsEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/stats")
            .WithTags("Statistics");

        group.MapGet("/", (IStatisticsService stats) =>
        {
            var snapshot = stats.GetSnapshot();
            return Results.Ok(snapshot);
        })
        .WithName("GetStatisticsOverview")
        .WithDescription("Returns a complete statistics snapshot.");

        group.MapGet("/models", (IStatisticsService stats) =>
        {
            var snapshot = stats.GetSnapshot();
            return Results.Ok(snapshot.ModelStats);
        })
        .WithName("GetAllModelStatistics")
        .WithDescription("Returns statistics for all models.");

        group.MapGet("/models/{modelId}", (string modelId, IStatisticsService stats) =>
        {
            var result = stats.GetModelStatistics(new ModelId(modelId));
            return result is not null ? Results.Ok(result) : Results.NotFound();
        })
        .WithName("GetModelStatistics")
        .WithDescription("Returns statistics for a specific model.");

        group.MapGet("/switching", (IStatisticsService stats) =>
        {
            return Results.Ok(stats.GetSwitchingStatistics());
        })
        .WithName("GetSwitchingStatistics")
        .WithDescription("Returns model switching statistics.");

        group.MapGet("/switching/decisions", (IStatisticsService stats) =>
        {
            return Results.Ok(stats.GetSwitchingStatistics().RecentDecisions);
        })
        .WithName("GetRecentSwitchDecisions")
        .WithDescription("Returns recent model switch decisions.");

        group.MapGet("/queue", (IStatisticsService stats) =>
        {
            return Results.Ok(stats.GetQueueStatistics());
        })
        .WithName("GetQueueStatistics")
        .WithDescription("Returns queue statistics.");

        group.MapGet("/performance", (IStatisticsService stats) =>
        {
            return Results.Ok(stats.GetAllPerformanceProfiles());
        })
        .WithName("GetAllPerformanceProfiles")
        .WithDescription("Returns performance profiles for all models.");

        group.MapGet("/performance/{modelId}", (string modelId, IStatisticsService stats) =>
        {
            var result = stats.GetPerformanceProfile(new ModelId(modelId));
            return result is not null ? Results.Ok(result) : Results.NotFound();
        })
        .WithName("GetPerformanceProfile")
        .WithDescription("Returns performance profile for a specific model.");
    }
}
