using System.Threading;
using System.Threading.Tasks;

namespace Maestro.Application.Interfaces;

public interface IExecutionErrorHandler
{
    Task HandleAsync(Maestro.Domain.Entities.ExecutionContext context, string blockId, Exception ex, CancellationToken ct = default);
}
