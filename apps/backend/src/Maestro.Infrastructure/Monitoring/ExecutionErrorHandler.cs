using System.Threading;
using System.Threading.Tasks;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Application.DTOs;

namespace Maestro.Infrastructure.Monitoring;

public class ExecutionErrorHandler : IExecutionErrorHandler
{
    private readonly IExecutionRepository _repo;

    public ExecutionErrorHandler(IExecutionRepository repo)
    {
        _repo = repo;
    }

    public async Task HandleAsync(Maestro.Domain.Entities.ExecutionContext context, string blockId, Exception ex, CancellationToken ct = default)
    {
        context.LogError($"Error in block {blockId}: {ex.Message}", ex, blockId);
        await _repo.SaveAsync(context, ct);
        // Additional hooks (metrics/alerts) can be added here
    }
}
