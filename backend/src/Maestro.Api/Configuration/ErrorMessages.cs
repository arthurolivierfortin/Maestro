namespace Maestro.Api.Configuration;

/// <summary>
/// Phase 22: Centralized human-readable error messages.
/// Maps error codes to user-friendly messages with suggested actions.
/// </summary>
public static class ErrorMessages
{
    public static readonly Dictionary<string, ErrorInfo> Catalog = new()
    {
        ["LLM_UNAVAILABLE"] = new(
            "The LLM server is not responding.",
            "Start the LLM provider: powershell -File dev-scripts/dev-start.ps1\nOr configure Azure: maestro config azure set --endpoint <url> --api-key <key>"),

        ["BACKEND_UNAVAILABLE"] = new(
            "Cannot connect to the Maestro backend.",
            "Start the backend: powershell -File dev-scripts/dev-start.ps1"),

        ["SESSION_NOT_FOUND"] = new(
            "Session not found.",
            "Use 'maestro session list' to see available sessions."),

        ["WORKSPACE_NOT_FOUND"] = new(
            "Workspace not found.",
            "Use 'maestro workspace list' to see available workspaces."),

        ["BLOCK_NOT_FOUND"] = new(
            "Block not found.",
            "Use 'maestro list-blocks' to see available blocks."),

        ["PROJECT_NOT_FOUND"] = new(
            "Project not found.",
            "Use 'maestro project list' to see available projects."),

        ["SESSION_ALREADY_RUNNING"] = new(
            "Session is already running.",
            "Stop it first with 'maestro session stop <id>' or wait for it to finish."),

        ["SESSION_NOT_STARTED"] = new(
            "Session has not been started.",
            "Start it with 'maestro session start <id>' before invoking entry points."),

        ["ENTRY_POINT_NOT_FOUND"] = new(
            "Entry point not found on this session.",
            "Use 'maestro session show <id>' to see available entry points."),

        ["PORT_IN_USE"] = new(
            "Port 5000 is already in use.",
            "Stop the existing process: taskkill /F /IM Maestro.Api.exe"),

        ["MODEL_TOO_LARGE"] = new(
            "The selected model is too large for available memory.",
            "Try a smaller model, or check available GPU memory."),

        ["TIMEOUT"] = new(
            "The operation timed out.",
            "The server might be overloaded. Try again or check backend logs."),

        ["UNAUTHORIZED"] = new(
            "Authentication required.",
            "Set an API key: maestro config set apiKey <key>"),

        ["FORBIDDEN"] = new(
            "Access denied.",
            "Your API key does not have permission for this operation."),

        ["TEMPLATE_NOT_FOUND"] = new(
            "Session template not found.",
            "Use 'maestro templates' to see available templates."),

        ["INVALID_JSON"] = new(
            "Invalid JSON input.",
            "Check your JSON syntax. Use 'maestro schema' for command reference."),

        ["AMBIGUOUS_ID"] = new(
            "ID prefix matches multiple resources.",
            "Use more characters of the ID to be specific.")
    };

    /// <summary>
    /// Get a human-readable error message for a given code, or a default message.
    /// </summary>
    public static ErrorInfo Get(string code, string? fallbackMessage = null)
    {
        if (Catalog.TryGetValue(code, out var info))
            return info;

        return new ErrorInfo(
            fallbackMessage ?? $"An error occurred (code: {code}).",
            "Check backend logs for details or run 'maestro health' for diagnostics.");
    }
}

/// <summary>
/// Human-readable error with a suggested action.
/// </summary>
public record ErrorInfo(string Message, string Suggestion);
