namespace Maestro.Infrastructure.Mcp;

public interface IMcpClientFactory : IAsyncDisposable
{
    Task<IMcpClientWrapper> GetOrCreateClientAsync(
        string command, string[] args, string? workingDir = null,
        CancellationToken ct = default);
}
