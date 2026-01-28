using Maestro.Application.Interfaces;
using Maestro.Domain.ValueObjects;
using Microsoft.Extensions.Logging;

namespace Maestro.Infrastructure.Containers;

/// <summary>
/// Factory for creating container runtime instances.
/// </summary>
public class ContainerRuntimeFactory : IContainerRuntimeFactory
{
    private readonly ILoggerFactory _loggerFactory;
    private readonly Dictionary<string, Func<IContainerRuntime>> _runtimeFactories;

    public ContainerRuntimeFactory(ILoggerFactory loggerFactory)
    {
        _loggerFactory = loggerFactory;
        
        _runtimeFactories = new Dictionary<string, Func<IContainerRuntime>>(StringComparer.OrdinalIgnoreCase)
        {
            ["docker"] = () => new DockerContainerRuntime(_loggerFactory.CreateLogger<DockerContainerRuntime>()),
            ["process"] = () => new ProcessContainerRuntime(_loggerFactory.CreateLogger<ProcessContainerRuntime>()),
            ["none"] = () => new NullContainerRuntime()
        };
    }

    public IReadOnlyList<string> AvailableRuntimeTypes => _runtimeFactories.Keys.ToList();

    public IContainerRuntime CreateRuntime(RuntimeConfiguration config)
    {
        var runtimeType = config.Type ?? "none";
        return CreateRuntime(runtimeType);
    }

    public IContainerRuntime CreateRuntime(string runtimeType)
    {
        var type = string.IsNullOrEmpty(runtimeType) ? "none" : runtimeType;
        
        if (!_runtimeFactories.TryGetValue(type, out var factory))
        {
            throw new ArgumentException($"Unsupported runtime type: {type}. Available: {string.Join(", ", AvailableRuntimeTypes)}");
        }

        return factory();
    }

    public bool IsSupported(string runtimeType)
    {
        return _runtimeFactories.ContainsKey(runtimeType);
    }
}
