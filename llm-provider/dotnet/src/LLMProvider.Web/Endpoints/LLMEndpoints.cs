using LLMProvider.Application.DTOs;
using LLMProvider.Application.Services;
using LLMProvider.Domain.Enums;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Web.Endpoints;

/// <summary>
/// Endpoints for LLM completion requests.
/// </summary>
public static class LLMEndpoints
{
    public static void MapLLMEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/llm")
            .WithTags("LLM");

        group.MapPost("/complete", Complete)
            .WithName("Complete")
            .WithSummary("Send a completion request")
            .WithDescription("Sends a prompt to an LLM and returns the generated response.");

        group.MapPost("/stream", StreamComplete)
            .WithName("StreamComplete")
            .WithSummary("Stream a completion response")
            .WithDescription("Sends a prompt to an LLM and streams the response.");

        group.MapGet("/usage", GetUsage)
            .WithName("GetUsage")
            .WithSummary("Get token usage statistics")
            .WithDescription("Returns aggregated token usage statistics.");
    }

    private static async Task<IResult> Complete(
        CompleteRequest request,
        LLMOrchestrationService orchestrationService,
        CancellationToken cancellationToken)
    {
        try
        {
            var llmRequest = MapToLLMRequest(request);
            var response = await orchestrationService.CompleteAsync(llmRequest, cancellationToken);

            return Results.Ok(new CompleteResponse
            {
                Content = response.Content,
                Model = response.ModelUsed.Value,
                Provider = response.Provider.ToString(),
                ConversationId = response.ConversationId?.ToString(),
                UserMessageId = response.UserMessageId?.ToString(),
                AssistantMessageId = response.AssistantMessageId?.ToString(),
                TokenUsage = new TokenUsageResponse
                {
                    PromptTokens = response.TokenUsage.PromptTokens,
                    CompletionTokens = response.TokenUsage.CompletionTokens,
                    TotalTokens = response.TokenUsage.TotalTokens
                },
                DurationMs = (long)response.Duration.TotalMilliseconds,
                FinishReason = response.FinishReason
            });
        }
        catch (ProviderUnavailableException ex)
        {
            return Results.Problem(
                detail: ex.Message,
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Service Unavailable",
                extensions: new Dictionary<string, object?> { ["provider"] = ex.Provider.ToString() });
        }
        catch (Domain.Exceptions.ConversationNotFoundException ex)
        {
            return Results.NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return Results.Problem(
                detail: ex.Message,
                statusCode: StatusCodes.Status500InternalServerError,
                title: "Internal Server Error");
        }
    }

    private static async Task StreamComplete(
        CompleteRequest request,
        LLMOrchestrationService orchestrationService,
        HttpContext context,
        CancellationToken cancellationToken)
    {
        context.Response.ContentType = "text/event-stream";
        context.Response.Headers.CacheControl = "no-cache";
        context.Response.Headers.Connection = "keep-alive";

        try
        {
            var llmRequest = MapToLLMRequest(request);

            await foreach (var chunk in orchestrationService.StreamCompleteAsync(llmRequest, cancellationToken))
            {
                var data = System.Text.Json.JsonSerializer.Serialize(new StreamChunkResponse
                {
                    Content = chunk.Content,
                    IsComplete = chunk.IsComplete,
                    PromptTokens = chunk.TokenUsage?.PromptTokens,
                    CompletionTokens = chunk.TokenUsage?.CompletionTokens,
                    TotalTokens = chunk.TokenUsage?.TotalTokens,
                    FinishReason = chunk.FinishReason,
                    Model = chunk.ModelUsed?.Value,
                    Provider = chunk.Provider?.ToString()
                });

                await context.Response.WriteAsync($"data: {data}\n\n", cancellationToken);
                await context.Response.Body.FlushAsync(cancellationToken);
            }

            await context.Response.WriteAsync("data: [DONE]\n\n", cancellationToken);
        }
        catch (Exception ex)
        {
            var errorData = System.Text.Json.JsonSerializer.Serialize(new { error = ex.Message });
            await context.Response.WriteAsync($"data: {errorData}\n\n", cancellationToken);
        }
    }

    private static IResult GetUsage(TokenAccountingService accountingService)
    {
        var summary = accountingService.GetSummary();

        return Results.Ok(new UsageSummaryResponse
        {
            TotalTokens = new TokenUsageResponse
            {
                PromptTokens = summary.TotalUsage.PromptTokens,
                CompletionTokens = summary.TotalUsage.CompletionTokens,
                TotalTokens = summary.TotalUsage.TotalTokens
            },
            ByProvider = summary.UsageByProvider.ToDictionary(
                kvp => kvp.Key.ToString(),
                kvp => new TokenUsageResponse
                {
                    PromptTokens = kvp.Value.PromptTokens,
                    CompletionTokens = kvp.Value.CompletionTokens,
                    TotalTokens = kvp.Value.TotalTokens
                }),
            ByModel = summary.UsageByModel.ToDictionary(
                kvp => kvp.Key,
                kvp => new TokenUsageResponse
                {
                    PromptTokens = kvp.Value.PromptTokens,
                    CompletionTokens = kvp.Value.CompletionTokens,
                    TotalTokens = kvp.Value.TotalTokens
                }),
            ConversationCount = summary.ConversationCount
        });
    }

    private static LLMRequest MapToLLMRequest(CompleteRequest request)
    {
        ProviderType? preferredProvider = null;
        if (!string.IsNullOrWhiteSpace(request.Provider) &&
            Enum.TryParse<ProviderType>(request.Provider, ignoreCase: true, out var pt))
        {
            preferredProvider = pt;
        }

        MemoryStrategy memoryStrategy = MemoryStrategy.Full;
        if (!string.IsNullOrWhiteSpace(request.MemoryStrategy) &&
            Enum.TryParse<MemoryStrategy>(request.MemoryStrategy, ignoreCase: true, out var ms))
        {
            memoryStrategy = ms;
        }

        ConversationId? conversationId = null;
        if (!string.IsNullOrWhiteSpace(request.ConversationId) &&
            ConversationId.TryParse(request.ConversationId, out var cid))
        {
            conversationId = cid;
        }

        return new LLMRequest
        {
            Prompt = request.Prompt,
            ModelId = new ModelId(request.Model),
            PreferredProvider = preferredProvider,
            ConversationId = conversationId,
            MemoryStrategy = memoryStrategy,
            WindowSize = request.WindowSize,
            MaxTokens = request.MaxTokens,
            Temperature = request.Temperature,
            SystemPrompt = request.SystemPrompt,
            Messages = request.Messages?.Select(m => new InlineMessage
            {
                Role = m.Role,
                Content = m.Content
            }).ToList()
        };
    }
}

public record CompleteRequest
{
    public required string Prompt { get; init; }
    public required string Model { get; init; }
    public string? Provider { get; init; }
    public string? ConversationId { get; init; }
    public string? MemoryStrategy { get; init; }
    public int? WindowSize { get; init; }
    public int? MaxTokens { get; init; }
    public float? Temperature { get; init; }
    public string? SystemPrompt { get; init; }

    /// <summary>
    /// Structured conversation messages (with roles). When provided, these are used
    /// instead of the flat Prompt for multi-turn agentic conversations.
    /// </summary>
    public List<ChatMessageDto>? Messages { get; init; }
}

/// <summary>
/// A single message in a conversation, with role information preserved.
/// </summary>
public record ChatMessageDto
{
    public required string Role { get; init; }
    public required string Content { get; init; }
}

public record CompleteResponse
{
    public required string Content { get; init; }
    public required string Model { get; init; }
    public required string Provider { get; init; }
    public string? ConversationId { get; init; }
    public string? UserMessageId { get; init; }
    public string? AssistantMessageId { get; init; }
    public required TokenUsageResponse TokenUsage { get; init; }
    public required long DurationMs { get; init; }
    public string? FinishReason { get; init; }
}

public record StreamChunkResponse
{
    public required string Content { get; init; }
    public required bool IsComplete { get; init; }
    public int? PromptTokens { get; init; }
    public int? CompletionTokens { get; init; }
    public int? TotalTokens { get; init; }
    public string? FinishReason { get; init; }
    public string? Model { get; init; }
    public string? Provider { get; init; }
}

public record UsageSummaryResponse
{
    public required TokenUsageResponse TotalTokens { get; init; }
    public required Dictionary<string, TokenUsageResponse> ByProvider { get; init; }
    public required Dictionary<string, TokenUsageResponse> ByModel { get; init; }
    public required int ConversationCount { get; init; }
}
