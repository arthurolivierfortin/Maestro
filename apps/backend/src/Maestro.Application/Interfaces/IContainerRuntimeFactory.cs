using Maestro.Domain.ValueObjects;

namespace Maestro.Application.Interfaces;

/// <summary>
/// Factory for creating container runtime instances based on configuration.
/// </summary>
public interface IContainerRuntimeFactory
{
    /// <summary>
    /// Gets the available runtime types.
    /// </summary>
    IReadOnlyList<string> AvailableRuntimeTypes { get; }

    /// <summary>
    /// Creates a container runtime for the specified configuration.
    /// </summary>
    /// <param name="config">Runtime configuration</param>
    /// <returns>Container runtime instance</returns>
    IContainerRuntime CreateRuntime(RuntimeConfiguration config);

    /// <summary>
    /// Creates a container runtime for the specified type.
    /// </summary>
    /// <param name="runtimeType">Runtime type (docker, process, none)</param>
    /// <returns>Container runtime instance</returns>
    IContainerRuntime CreateRuntime(string runtimeType);

    /// <summary>
    /// Checks if a runtime type is supported.
    /// </summary>
    /// <param name="runtimeType">Runtime type to check</param>
    /// <returns>True if supported</returns>
    bool IsSupported(string runtimeType);
}
