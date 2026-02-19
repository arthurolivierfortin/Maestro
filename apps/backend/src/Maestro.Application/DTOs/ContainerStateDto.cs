using Maestro.Domain.ValueObjects;

namespace Maestro.Application.DTOs;

/// <summary>
/// Data Transfer Object for container state.
/// </summary>
public record ContainerStateDto
{
    public string ProjectId { get; init; } = string.Empty;
    public string? ContainerId { get; init; }
    public string Status { get; init; } = "stopped";
    public DateTime? StartedAt { get; init; }
    public DateTime? StoppedAt { get; init; }
    public string? Error { get; init; }
    public ResourceUsageDto? ResourceUsage { get; init; }

    public static ContainerStateDto FromDomain(ProjectContainerState state)
    {
        return new ContainerStateDto
        {
            ProjectId = state.ProjectId.ToString(),
            ContainerId = state.ContainerId,
            Status = state.Status.ToString().ToLowerInvariant(),
            StartedAt = state.StartedAt,
            StoppedAt = state.StoppedAt,
            Error = state.ErrorMessage,
            ResourceUsage = state.CpuPercent.HasValue || state.MemoryMb.HasValue
                ? new ResourceUsageDto
                {
                    CpuPercent = state.CpuPercent ?? 0,
                    MemoryMb = state.MemoryMb ?? 0
                }
                : null
        };
    }
}

/// <summary>
/// Resource usage information.
/// </summary>
public record ResourceUsageDto
{
    public double CpuPercent { get; init; }
    public double MemoryMb { get; init; }
}
