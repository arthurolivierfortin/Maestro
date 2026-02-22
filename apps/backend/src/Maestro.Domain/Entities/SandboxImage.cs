using Maestro.Domain.ValueObjects;

namespace Maestro.Domain.Entities;

/// <summary>
/// Represents a reproducible test environment snapshot.
/// Sandbox images are immutable snapshots of a git repository with named checkpoints.
/// Used by foundry sessions to provision isolated worktrees for agent testing.
/// </summary>
public class SandboxImage
{
    public string Id { get; set; } = string.Empty;
    public int Version { get; set; } = 1;
    public string? Description { get; set; }
    public string Type { get; set; } = "git-worktree";
    public string SourcePath { get; set; } = string.Empty;
    public List<SandboxCheckpoint> Checkpoints { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Dictionary<string, object> Metadata { get; set; } = new();

    public void AddCheckpoint(SandboxCheckpoint checkpoint)
    {
        if (Checkpoints.Any(c => c.Id == checkpoint.Id))
            throw new InvalidOperationException($"Checkpoint '{checkpoint.Id}' already exists in image '{Id}'");

        Checkpoints.Add(checkpoint);
    }

    public SandboxCheckpoint? GetCheckpoint(string checkpointId)
    {
        return Checkpoints.FirstOrDefault(c => c.Id == checkpointId);
    }
}
