using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Infrastructure.LLMGateway;
using Microsoft.AspNetCore.Mvc;
using ChatRequest = Maestro.Application.DTOs.ChatCompletionRequest;
using ChatResponse = Maestro.Application.DTOs.ChatCompletionResponse;
using ChatMsg = Maestro.Application.DTOs.ChatMessageDto;

namespace Maestro.Api.Controllers;

[ApiController]
[Route("api/chat")]
public class ChatController : ControllerBase
{
    private readonly ILLMGateway _llmGateway;
    private readonly ILogger<ChatController> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public ChatController(
        ILLMGateway llmGateway,
        ILogger<ChatController> logger)
    {
        _llmGateway = llmGateway;
        _logger = logger;
    }

    /// <summary>Non-streaming chat completion.</summary>
    [HttpPost("completions")]
    public async Task<ActionResult<ChatResponse>> Complete(
        [FromBody] ChatRequest request,
        CancellationToken ct)
    {
        if (request.Messages == null || request.Messages.Count == 0)
            return BadRequest(new { error = "messages array is required and must not be empty" });

        try
        {
            var llmRequest = ToLLMRequest(request);
            var llmResponse = await _llmGateway.SendAsync(llmRequest, ct);

            return Ok(new ChatResponse
            {
                Content = llmResponse.Content,
                Model = llmResponse.Model,
                PromptTokens = llmResponse.PromptTokens,
                CompletionTokens = llmResponse.CompletionTokens,
                TotalTokens = llmResponse.TotalTokens
            });
        }
        catch (LLMProviderUnavailableException ex)
        {
            return StatusCode(503, new { error = "LLM Provider is not running", details = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(503, new { error = "LLM Provider is not running", details = ex.Message });
        }
    }

    /// <summary>SSE streaming chat completion (text/event-stream).</summary>
    [HttpPost("stream")]
    public async Task Stream(
        [FromBody] ChatRequest request,
        CancellationToken ct)
    {
        if (request.Messages == null || request.Messages.Count == 0)
        {
            Response.StatusCode = 400;
            await Response.WriteAsJsonAsync(new { error = "messages array is required and must not be empty" }, ct);
            return;
        }

        Response.ContentType = "text/event-stream";
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Connection", "keep-alive");

        try
        {
            var llmRequest = ToLLMRequest(request);

            await foreach (var chunk in _llmGateway.StreamAsync(llmRequest, ct))
            {
                if (ct.IsCancellationRequested) break;

                var data = JsonSerializer.Serialize(new { content = chunk }, JsonOptions);
                await Response.WriteAsync($"data: {data}\n\n", ct);
                await Response.Body.FlushAsync(ct);
            }

            // Send done event
            await Response.WriteAsync("data: [DONE]\n\n", ct);
            await Response.Body.FlushAsync(ct);
        }
        catch (LLMProviderUnavailableException ex)
        {
            _logger?.LogWarning(ex, "LLM Provider unavailable during stream");
            var error = JsonSerializer.Serialize(new { error = "LLM Provider is not running", details = ex.Message }, JsonOptions);
            await Response.WriteAsync($"data: {error}\n\n", ct);
            await Response.Body.FlushAsync(ct);
        }
        catch (HttpRequestException ex)
        {
            _logger?.LogWarning(ex, "LLM Provider connection error during stream");
            var error = JsonSerializer.Serialize(new { error = "LLM Provider connection error", details = ex.Message }, JsonOptions);
            await Response.WriteAsync($"data: {error}\n\n", ct);
            await Response.Body.FlushAsync(ct);
        }
        catch (OperationCanceledException)
        {
            // Client disconnected — normal for SSE
        }
    }

    private static LLMRequest ToLLMRequest(ChatRequest request)
    {
        return new LLMRequest
        {
            Messages = request.Messages
                .Select(m => new ChatMessage { Role = m.Role, Content = m.Content })
                .ToList(),
            ModelId = request.Model,
            Temperature = request.Temperature,
            MaxNewTokens = request.MaxTokens
        };
    }
}
