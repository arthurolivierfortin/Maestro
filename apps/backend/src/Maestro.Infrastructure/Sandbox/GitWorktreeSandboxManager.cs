using System.Diagnostics;
using System.Text.Json;
using Maestro.Application.Interfaces;
using Maestro.Domain.Entities;
using Maestro.Domain.ValueObjects;

namespace Maestro.Infrastructure.Sandbox;

/// <summary>
/// Git worktree-based sandbox manager.
/// Skeleton for future 38-B backend API integration.
/// NOT registered in DI — V1 logic runs in TypeScript (packages/maestro-cli/sandbox-manager.ts).
/// </summary>
public class GitWorktreeSandboxManager : ISandboxManager
{
    private readonly string _basePath;

    public GitWorktreeSandboxManager(string basePath)
    {
        _basePath = basePath;
    }

    public Task<SandboxImage> CreateAsync(string id, string sourcePath,
        IEnumerable<SandboxCheckpoint>? checkpoints = null, string? description = null,
        CancellationToken ct = default)
    {
        var image = new SandboxImage
        {
            Id = id,
            SourcePath = Path.GetFullPath(sourcePath).Replace('\\', '/'),
            Description = description,
            Checkpoints = checkpoints?.ToList() ?? new List<SandboxCheckpoint>(),
            CreatedAt = DateTime.UtcNow,
        };

        var dir = Path.Combine(_basePath, id);
        Directory.CreateDirectory(dir);
        var json = JsonSerializer.Serialize(image, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(Path.Combine(dir, "sandbox.json"), json);

        return Task.FromResult(image);
    }

    public Task<IReadOnlyList<SandboxImage>> ListAsync(CancellationToken ct = default)
    {
        var images = new List<SandboxImage>();
        if (!Directory.Exists(_basePath)) return Task.FromResult<IReadOnlyList<SandboxImage>>(images);

        foreach (var dir in Directory.GetDirectories(_basePath))
        {
            var jsonPath = Path.Combine(dir, "sandbox.json");
            if (!File.Exists(jsonPath)) continue;
            var image = JsonSerializer.Deserialize<SandboxImage>(File.ReadAllText(jsonPath));
            if (image != null) images.Add(image);
        }

        return Task.FromResult<IReadOnlyList<SandboxImage>>(images);
    }

    public Task<SandboxImage?> GetAsync(string id, CancellationToken ct = default)
    {
        var jsonPath = Path.Combine(_basePath, id, "sandbox.json");
        if (!File.Exists(jsonPath)) return Task.FromResult<SandboxImage?>(null);

        var image = JsonSerializer.Deserialize<SandboxImage>(File.ReadAllText(jsonPath));
        return Task.FromResult(image);
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        var dir = Path.Combine(_basePath, id);
        if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true);
        await Task.CompletedTask;
    }

    public async Task AddCheckpointAsync(string imageId, SandboxCheckpoint checkpoint, CancellationToken ct = default)
    {
        var image = await GetAsync(imageId, ct)
            ?? throw new InvalidOperationException($"Sandbox image '{imageId}' not found");
        image.AddCheckpoint(checkpoint);

        var json = JsonSerializer.Serialize(image, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(Path.Combine(_basePath, imageId, "sandbox.json"), json);
    }

    public async Task<string> ProvisionWorktreeAsync(string imageId, string checkpointId,
        string? targetPath = null, CancellationToken ct = default)
    {
        var image = await GetAsync(imageId, ct)
            ?? throw new InvalidOperationException($"Sandbox image '{imageId}' not found");
        var checkpoint = image.GetCheckpoint(checkpointId)
            ?? throw new InvalidOperationException($"Checkpoint '{checkpointId}' not found in image '{imageId}'");

        var worktreePath = targetPath ?? Path.Combine(_basePath, imageId, "worktrees", checkpointId);
        worktreePath = Path.GetFullPath(worktreePath).Replace('\\', '/');

        RunGit(image.SourcePath, $"worktree add \"{worktreePath}\" {checkpoint.GitRef}");

        return worktreePath;
    }

    public Task DestroyWorktreeAsync(string worktreePath, CancellationToken ct = default)
    {
        // Find the source repo by checking git worktree list from the worktree itself
        RunGit(worktreePath, "worktree remove . --force");
        return Task.CompletedTask;
    }

    private static void RunGit(string cwd, string args)
    {
        var psi = new ProcessStartInfo("git", args)
        {
            WorkingDirectory = cwd,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        using var proc = Process.Start(psi)
            ?? throw new InvalidOperationException("Failed to start git process");
        proc.WaitForExit(30_000);

        if (proc.ExitCode != 0)
        {
            var stderr = proc.StandardError.ReadToEnd();
            throw new InvalidOperationException($"git {args} failed (exit {proc.ExitCode}): {stderr}");
        }
    }
}
