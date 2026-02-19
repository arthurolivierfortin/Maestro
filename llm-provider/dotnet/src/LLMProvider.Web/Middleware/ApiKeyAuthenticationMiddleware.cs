namespace LLMProvider.Web.Middleware;

/// <summary>
/// Middleware to validate API Key authentication for the LLM Provider API.
/// Protects endpoints from unauthorized access when enabled.
/// </summary>
public sealed class ApiKeyAuthenticationMiddleware
{
    private const string ApiKeyHeaderName = "X-API-Key";

    private readonly RequestDelegate _next;
    private readonly ILogger<ApiKeyAuthenticationMiddleware> _logger;
    private readonly string? _apiKey;
    private readonly bool _isEnabled;
    private readonly HashSet<string> _excludedPaths;

    public ApiKeyAuthenticationMiddleware(
        RequestDelegate next,
        IConfiguration configuration,
        ILogger<ApiKeyAuthenticationMiddleware> logger)
    {
        _next = next;
        _logger = logger;
        _apiKey = configuration["Security:ApiKey:Key"];
        _isEnabled = configuration.GetValue<bool>("Security:ApiKey:Enabled", false);

        // Paths that should be accessible without authentication
        _excludedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "/api/v1/health",
            "/swagger",
            "/favicon.ico",
            "/"
        };
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Skip if API key authentication is disabled
        if (!_isEnabled || string.IsNullOrEmpty(_apiKey))
        {
            await _next(context);
            return;
        }

        var path = context.Request.Path.Value ?? "";

        // Skip authentication for excluded paths
        if (IsExcludedPath(path))
        {
            await _next(context);
            return;
        }

        // Validate API key
        if (!context.Request.Headers.TryGetValue(ApiKeyHeaderName, out var providedKey))
        {
            _logger.LogWarning(
                "API request without {Header} header from {IP} to {Path}",
                ApiKeyHeaderName,
                context.Connection.RemoteIpAddress,
                path);

            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Unauthorized",
                message = $"Missing {ApiKeyHeaderName} header"
            });
            return;
        }

        if (!string.Equals(providedKey, _apiKey, StringComparison.Ordinal))
        {
            _logger.LogWarning(
                "Invalid API key provided from {IP} to {Path}",
                context.Connection.RemoteIpAddress,
                path);

            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Unauthorized",
                message = "Invalid API key"
            });
            return;
        }

        await _next(context);
    }

    private bool IsExcludedPath(string path)
    {
        return _excludedPaths.Any(excluded =>
            path.Equals(excluded, StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith(excluded + "/", StringComparison.OrdinalIgnoreCase));
    }
}
