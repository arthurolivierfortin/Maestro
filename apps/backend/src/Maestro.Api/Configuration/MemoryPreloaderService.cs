using Maestro.Application.Interfaces;

namespace Maestro.Api.Configuration;

/// <summary>
/// IHostedService that eagerly loads memory stores at startup
/// so the first agent call doesn't pay the full I/O cost.
/// </summary>
public class MemoryPreloaderService : IHostedService
{
    private readonly IMemoryManager _memoryManager;
    private readonly ILogger<MemoryPreloaderService> _logger;

    public MemoryPreloaderService(IMemoryManager memoryManager, ILogger<MemoryPreloaderService> logger)
    {
        _memoryManager = memoryManager;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            var stores = await _memoryManager.ListStoresAsync(ct: cancellationToken);
            _logger.LogInformation("Memory preloader: loaded {Count} stores at startup", stores.Count);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Memory preloader failed (non-fatal)");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
