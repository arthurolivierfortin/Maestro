using Maestro.Application.Interfaces;
using Maestro.Infrastructure.Security;
using Microsoft.Extensions.Options;

namespace Maestro.Api.Security;

public class ApiKeyAuthMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ApiKeyAuthMiddleware> _logger;

    private static readonly HashSet<string> ExemptPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/",
        "/api/health",
        "/api/auth/status",
        "/api/auth/setup"
    };

    public ApiKeyAuthMiddleware(RequestDelegate next, ILogger<ApiKeyAuthMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var options = context.RequestServices.GetRequiredService<IOptions<ApiKeyAuthOptions>>().Value;

        // Security disabled — pass through
        if (!options.Enabled)
        {
            await _next(context);
            return;
        }

        var path = context.Request.Path.Value ?? "";

        // Exempt paths
        if (ExemptPaths.Contains(path))
        {
            await _next(context);
            return;
        }

        // SignalR hubs are exempt (they use their own auth)
        if (path.StartsWith("/hubs/", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        // Localhost bypass when AllowRemote is false
        if (!options.AllowRemote && IsLocalhost(context))
        {
            await _next(context);
            return;
        }

        // Extract Bearer token
        var authHeader = context.Request.Headers.Authorization.FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var auditLogger = context.RequestServices.GetService<IAuditLogger>();
            await (auditLogger?.LogAsync("auth_failed", detail: "Missing Bearer token", ipAddress: GetIp(context)) ?? Task.CompletedTask);

            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new { error = "API key required. Use Authorization: Bearer <key>" });
            return;
        }

        var key = authHeader["Bearer ".Length..].Trim();
        var apiKeyService = context.RequestServices.GetRequiredService<IApiKeyService>();
        var result = await apiKeyService.ValidateKeyAsync(key);

        if (!result.Valid)
        {
            var auditLogger = context.RequestServices.GetService<IAuditLogger>();
            await (auditLogger?.LogAsync("auth_failed", detail: "Invalid API key", ipAddress: GetIp(context)) ?? Task.CompletedTask);

            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new { error = "Invalid or expired API key" });
            return;
        }

        // Store auth info in HttpContext for downstream use
        context.Items["ApiKeyName"] = result.Name;
        context.Items["ApiKeyScope"] = result.Scope;
        context.Items["ApiKeySessionId"] = result.SessionId;

        // Phase 20: Enriched audit logging for authenticated requests
        _logger.LogDebug("Authenticated request: {Method} {Path} by {KeyName} (scope={Scope}, session={SessionId})",
            context.Request.Method, path, result.Name, result.Scope, result.SessionId ?? "none");

        await _next(context);
    }

    private static bool IsLocalhost(HttpContext context)
    {
        var remoteIp = context.Connection.RemoteIpAddress;
        if (remoteIp == null) return false;
        if (System.Net.IPAddress.IsLoopback(remoteIp)) return true;
        // Handle IPv4-mapped IPv6 (::ffff:127.0.0.1)
        if (remoteIp.IsIPv4MappedToIPv6)
            return System.Net.IPAddress.IsLoopback(remoteIp.MapToIPv4());
        return false;
    }

    private static string? GetIp(HttpContext context)
    {
        return context.Connection.RemoteIpAddress?.ToString();
    }
}
