using Maestro.Domain.Entities;
using ExecutionContext = Maestro.Domain.Entities.ExecutionContext;
using Maestro.Application.DTOs;
using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

public interface IBlockExecutor
{
    string SupportedType { get; }
    Task<BlockExecutionResult> ExecuteAsync(
        BlockDefinition block,
        ExecutionContext context,
        Dictionary<string, object> inputs,
        CancellationToken ct = default);
}
