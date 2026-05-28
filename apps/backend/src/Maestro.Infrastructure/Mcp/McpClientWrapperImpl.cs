using ModelContextProtocol.Client;
using ModelContextProtocol.Protocol;

namespace Maestro.Infrastructure.Mcp;

internal sealed class McpClientWrapperImpl : IMcpClientWrapper
{
    private readonly McpClient _client;
    private readonly SemaphoreSlim _semaphore = new(1, 1);

    public McpClientWrapperImpl(McpClient client)
    {
        _client = client;
    }

    public async Task<IList<McpToolInfo>> ListToolsAsync(CancellationToken ct = default)
    {
        await _semaphore.WaitAsync(ct);
        try
        {
            var tools = await _client.ListToolsAsync(cancellationToken: ct);
            return tools.Select(t => new McpToolInfo(t.Name, t.Description)).ToList();
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async Task<McpToolCallResult> CallToolAsync(
        string toolName, Dictionary<string, object?> arguments, CancellationToken ct = default)
    {
        await _semaphore.WaitAsync(ct);
        try
        {
            var callResult = await _client.CallToolAsync(
                toolName, arguments, cancellationToken: ct);

            var contentText = string.Join("\n", callResult.Content
                .OfType<TextContentBlock>()
                .Select(c => c.Text));

            return new McpToolCallResult(callResult.IsError == true, contentText);
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        await _client.DisposeAsync();
        _semaphore.Dispose();
    }
}
