using System.Net;
using System.Text.Json;

namespace Maestro.Api.Middleware;

/// <summary>
/// Global exception handling middleware.
/// Catches unhandled exceptions and returns structured JSON error responses.
/// </summary>
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, errorType) = exception switch
        {
            // LLM Provider unavailable (custom exception from Infrastructure)
            _ when exception.GetType().Name == "LLMProviderUnavailableException"
                => (HttpStatusCode.ServiceUnavailable, "llm_provider_unavailable"),

            // HttpRequestException for external service failures
            HttpRequestException httpEx when httpEx.StatusCode == HttpStatusCode.ServiceUnavailable
                => (HttpStatusCode.ServiceUnavailable, "service_unavailable"),

            HttpRequestException
                => (HttpStatusCode.BadGateway, "upstream_error"),

            // Invalid operation (bad request)
            InvalidOperationException
                => (HttpStatusCode.BadRequest, "invalid_operation"),

            // Argument exceptions
            ArgumentException
                => (HttpStatusCode.BadRequest, "invalid_argument"),

            // Not found
            KeyNotFoundException
                => (HttpStatusCode.NotFound, "not_found"),

            FileNotFoundException
                => (HttpStatusCode.NotFound, "file_not_found"),

            // Timeout
            TaskCanceledException
                => (HttpStatusCode.GatewayTimeout, "timeout"),

            OperationCanceledException
                => (HttpStatusCode.GatewayTimeout, "operation_cancelled"),

            // Unauthorized
            UnauthorizedAccessException
                => (HttpStatusCode.Forbidden, "forbidden"),

            // Everything else
            _ => (HttpStatusCode.InternalServerError, "internal_error")
        };

        // Log based on severity
        if (statusCode == HttpStatusCode.InternalServerError)
        {
            _logger.LogError(exception, "Unhandled exception: {Message}", exception.Message);
        }
        else
        {
            _logger.LogWarning("Handled exception ({StatusCode}): {Message}", (int)statusCode, exception.Message);
        }

        context.Response.StatusCode = (int)statusCode;
        context.Response.ContentType = "application/json";

        var response = new
        {
            error = errorType,
            message = exception.Message,
            status = (int)statusCode
        };

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json);
    }
}
