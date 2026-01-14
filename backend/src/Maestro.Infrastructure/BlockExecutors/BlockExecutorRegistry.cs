using Maestro.Application.Interfaces;

namespace Maestro.Infrastructure.BlockExecutors;

public class BlockExecutorRegistry
{
    private readonly Dictionary<string, IBlockExecutor> _map = new();

    public BlockExecutorRegistry(IEnumerable<IBlockExecutor> executors)
    {
        foreach (var e in executors)
        {
            _map[e.SupportedType] = e;
        }
    }

    public IBlockExecutor? Get(string type) => _map.TryGetValue(type, out var e) ? e : null;
}
