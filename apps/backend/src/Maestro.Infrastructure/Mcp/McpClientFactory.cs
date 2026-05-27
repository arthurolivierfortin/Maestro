using System.Collections.Concurrent;
using ModelContextProtocol.Client;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Mcp;

public sealed class McpClientFactory : IMcpClientFactory
{
    private readonly ConcurrentDictionary<string, IMcpClientWrapper> _clients = new();
    private readonly SemaphoreSlim _createLock = new(1, 1);
    private readonly ILoggerFactory? _loggerFactory;
    private readonly Func<string, string[], string?, CancellationToken, Task<IMcpClientWrapper>>? _clientCreator;
    private bool _disposed;

    public McpClientFactory(ILoggerFactory? loggerFactory = null)
    {
        _loggerFactory = loggerFactory;
    }

    internal McpClientFactory(
        Func<string, string[], string?, CancellationToken, Task<IMcpClientWrapper>> clientCreator,
        ILoggerFactory? loggerFactory = null)
    {
        _clientCreator = clientCreator;
        _loggerFactory = loggerFactory;
    }

    public async Task<IMcpClientWrapper> GetOrCreateClientAsync(
        string command, string[] args, string? workingDir = null,
        CancellationToken ct = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        var key = BuildCacheKey(command, args);

        if (_clients.TryGetValue(key, out var existing))
            return existing;

        await _createLock.WaitAsync(ct);
        try
        {
            if (_clients.TryGetValue(key, out existing))
                return existing;

            IMcpClientWrapper wrapper;
            if (_clientCreator != null)
            {
                wrapper = await _clientCreator(command, args, workingDir, ct);
            }
            else
            {
                var transportOptions = new StdioClientTransportOptions
                {
                    Name = $"mcp-{key}",
                    Command = command,
                    Arguments = args.ToList()
                };

                if (!string.IsNullOrEmpty(workingDir))
                    transportOptions.WorkingDirectory = workingDir;

                var transport = new StdioClientTransport(transportOptions);
                var client = await McpClient.CreateAsync(transport, loggerFactory: _loggerFactory, cancellationToken: ct);
                wrapper = new McpClientWrapperImpl(client);
            }

            _clients[key] = wrapper;
            return wrapper;
        }
        finally
        {
            _createLock.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;

        foreach (var wrapper in _clients.Values)
        {
            try { await wrapper.DisposeAsync(); }
            catch { /* best-effort cleanup */ }
        }
        _clients.Clear();
        _createLock.Dispose();
    }

    private static string BuildCacheKey(string command, string[] args)
        => $"{command}:{string.Join("|", args)}";
}
