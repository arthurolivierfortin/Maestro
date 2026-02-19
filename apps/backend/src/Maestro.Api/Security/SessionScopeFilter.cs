using Maestro.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Maestro.Api.Security;

/// <summary>
/// Action filter that restricts SessionScoped API keys to their own session.
/// </summary>
public class SessionScopeFilter : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        var scope = context.HttpContext.Items["ApiKeyScope"] as ApiKeyScope?;
        if (scope != ApiKeyScope.SessionScoped) return;

        var allowedSessionId = context.HttpContext.Items["ApiKeySessionId"] as string;
        if (string.IsNullOrEmpty(allowedSessionId)) return;

        // Check if this request targets a specific session
        if (context.ActionArguments.TryGetValue("id", out var idObj) && idObj is string requestedId)
        {
            if (!string.Equals(requestedId, allowedSessionId, StringComparison.OrdinalIgnoreCase))
            {
                context.Result = new ObjectResult(new { error = "SessionScoped key can only access its own session" })
                {
                    StatusCode = 403
                };
            }
        }
    }

    public void OnActionExecuted(ActionExecutedContext context) { }
}
