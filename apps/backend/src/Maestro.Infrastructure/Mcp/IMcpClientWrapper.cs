namespace Maestro.Infrastructure.Mcp;

public interface IMcpClientWrapper : IAsyncDisposable
{
    Task<IList<McpToolInfo>> ListToolsAsync(CancellationToken ct = default);
    Task<McpToolCallResult> CallToolAsync(string toolName, Dictionary<string, object?> arguments, CancellationToken ct = default);
}

public record McpToolInfo(string Name, string? Description);
public record McpToolCallResult(bool IsError, string Content);
