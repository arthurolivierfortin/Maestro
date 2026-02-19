using LLMProvider.Application.Services;
using LLMProvider.Domain.ValueObjects;

namespace LLMProvider.Web.Endpoints;

/// <summary>
/// Endpoints for conversation management.
/// </summary>
public static class ConversationsEndpoints
{
    public static void MapConversationsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/conversations")
            .WithTags("Conversations");

        group.MapGet("/", GetAllConversations)
            .WithName("GetAllConversations")
            .WithSummary("Get all conversations")
            .WithDescription("Returns all conversations with optional pagination.");

        group.MapGet("/{id}", GetConversation)
            .WithName("GetConversation")
            .WithSummary("Get a conversation")
            .WithDescription("Returns a specific conversation with its message history.");

        group.MapPost("/", CreateConversation)
            .WithName("CreateConversation")
            .WithSummary("Create a conversation")
            .WithDescription("Creates a new conversation with optional title and system prompt.");

        group.MapPatch("/{id}", UpdateConversation)
            .WithName("UpdateConversation")
            .WithSummary("Update a conversation")
            .WithDescription("Updates a conversation's title.");

        group.MapDelete("/{id}", DeleteConversation)
            .WithName("DeleteConversation")
            .WithSummary("Delete a conversation")
            .WithDescription("Deletes a conversation and all its messages.");

        group.MapGet("/{id}/tokens", GetConversationTokens)
            .WithName("GetConversationTokens")
            .WithSummary("Get conversation token usage")
            .WithDescription("Returns the total token usage for a conversation.");
    }

    private static async Task<IResult> GetAllConversations(
        ConversationService service,
        int? page,
        int? pageSize,
        CancellationToken cancellationToken)
    {
        if (page.HasValue && pageSize.HasValue)
        {
            var (items, totalCount) = await service.GetConversationsPagedAsync(
                page.Value,
                pageSize.Value,
                cancellationToken);

            var response = items.Select(c => new ConversationSummary
            {
                Id = c.Id.ToString(),
                Title = c.Title,
                MessageCount = c.MessageCount,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            });

            return Results.Ok(new
            {
                conversations = response,
                page = page.Value,
                pageSize = pageSize.Value,
                totalCount
            });
        }

        var conversations = await service.GetAllConversationsAsync(cancellationToken);

        var allResponse = conversations.Select(c => new ConversationSummary
        {
            Id = c.Id.ToString(),
            Title = c.Title,
            MessageCount = c.MessageCount,
            CreatedAt = c.CreatedAt,
            UpdatedAt = c.UpdatedAt
        });

        return Results.Ok(new { conversations = allResponse });
    }

    private static async Task<IResult> GetConversation(
        string id,
        ConversationService service,
        CancellationToken cancellationToken)
    {
        if (!ConversationId.TryParse(id, out var conversationId))
        {
            return Results.BadRequest(new { error = "Invalid conversation ID format" });
        }

        var conversation = await service.GetConversationOrDefaultAsync(conversationId, cancellationToken);

        if (conversation is null)
        {
            return Results.NotFound(new { error = $"Conversation not found: {id}" });
        }

        var response = new ConversationResponse
        {
            Id = conversation.Id.ToString(),
            Title = conversation.Title,
            CreatedAt = conversation.CreatedAt,
            UpdatedAt = conversation.UpdatedAt,
            Messages = conversation.Messages.Select(m => new MessageResponse
            {
                Id = m.Id.ToString(),
                Role = m.Role.ToString(),
                Content = m.Content,
                Model = m.Model?.Value,
                Provider = m.Provider?.ToString(),
                PromptTokens = m.TokenUsage?.PromptTokens,
                CompletionTokens = m.TokenUsage?.CompletionTokens,
                TotalTokens = m.TokenUsage?.TotalTokens,
                CreatedAt = m.CreatedAt
            }).ToList(),
            TotalTokens = new TokenUsageResponse
            {
                PromptTokens = conversation.TotalTokenUsage.PromptTokens,
                CompletionTokens = conversation.TotalTokenUsage.CompletionTokens,
                TotalTokens = conversation.TotalTokenUsage.TotalTokens
            }
        };

        return Results.Ok(response);
    }

    private static async Task<IResult> CreateConversation(
        CreateConversationRequest request,
        ConversationService service,
        CancellationToken cancellationToken)
    {
        var conversation = await service.CreateConversationAsync(
            request.Title,
            request.SystemPrompt,
            cancellationToken);

        var response = new ConversationSummary
        {
            Id = conversation.Id.ToString(),
            Title = conversation.Title,
            MessageCount = conversation.MessageCount,
            CreatedAt = conversation.CreatedAt,
            UpdatedAt = conversation.UpdatedAt
        };

        return Results.Created($"/api/v1/conversations/{conversation.Id}", response);
    }

    private static async Task<IResult> UpdateConversation(
        string id,
        UpdateConversationRequest request,
        ConversationService service,
        CancellationToken cancellationToken)
    {
        if (!ConversationId.TryParse(id, out var conversationId))
        {
            return Results.BadRequest(new { error = "Invalid conversation ID format" });
        }

        try
        {
            var conversation = await service.UpdateTitleAsync(
                conversationId,
                request.Title,
                cancellationToken);

            var response = new ConversationSummary
            {
                Id = conversation.Id.ToString(),
                Title = conversation.Title,
                MessageCount = conversation.MessageCount,
                CreatedAt = conversation.CreatedAt,
                UpdatedAt = conversation.UpdatedAt
            };

            return Results.Ok(response);
        }
        catch (Domain.Exceptions.ConversationNotFoundException)
        {
            return Results.NotFound(new { error = $"Conversation not found: {id}" });
        }
    }

    private static async Task<IResult> DeleteConversation(
        string id,
        ConversationService service,
        CancellationToken cancellationToken)
    {
        if (!ConversationId.TryParse(id, out var conversationId))
        {
            return Results.BadRequest(new { error = "Invalid conversation ID format" });
        }

        var deleted = await service.DeleteConversationAsync(conversationId, cancellationToken);

        if (!deleted)
        {
            return Results.NotFound(new { error = $"Conversation not found: {id}" });
        }

        return Results.NoContent();
    }

    private static async Task<IResult> GetConversationTokens(
        string id,
        ConversationService service,
        CancellationToken cancellationToken)
    {
        if (!ConversationId.TryParse(id, out var conversationId))
        {
            return Results.BadRequest(new { error = "Invalid conversation ID format" });
        }

        try
        {
            var tokenUsage = await service.GetConversationTokenUsageAsync(
                conversationId,
                cancellationToken);

            return Results.Ok(new TokenUsageResponse
            {
                PromptTokens = tokenUsage.PromptTokens,
                CompletionTokens = tokenUsage.CompletionTokens,
                TotalTokens = tokenUsage.TotalTokens
            });
        }
        catch (Domain.Exceptions.ConversationNotFoundException)
        {
            return Results.NotFound(new { error = $"Conversation not found: {id}" });
        }
    }
}

public record CreateConversationRequest
{
    public string? Title { get; init; }
    public string? SystemPrompt { get; init; }
}

public record UpdateConversationRequest
{
    public string? Title { get; init; }
}

public record ConversationSummary
{
    public required string Id { get; init; }
    public string? Title { get; init; }
    public required int MessageCount { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public required DateTimeOffset UpdatedAt { get; init; }
}

public record ConversationResponse
{
    public required string Id { get; init; }
    public string? Title { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public required DateTimeOffset UpdatedAt { get; init; }
    public required List<MessageResponse> Messages { get; init; }
    public required TokenUsageResponse TotalTokens { get; init; }
}

public record MessageResponse
{
    public required string Id { get; init; }
    public required string Role { get; init; }
    public required string Content { get; init; }
    public string? Model { get; init; }
    public string? Provider { get; init; }
    public int? PromptTokens { get; init; }
    public int? CompletionTokens { get; init; }
    public int? TotalTokens { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
}

public record TokenUsageResponse
{
    public required int PromptTokens { get; init; }
    public required int CompletionTokens { get; init; }
    public required int TotalTokens { get; init; }
}
