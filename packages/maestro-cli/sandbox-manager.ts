// @ts-nocheck
/**
 * SandboxManager — CLI-local sandbox image management.
 *
 * Sandbox images are immutable snapshots of git repos with named checkpoints.
 * V1 uses git worktrees for isolation (no Docker).
 * Storage: .maestro/sandboxes/<id>/sandbox.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Types ───────────────────────────────────────────────────────────

interface SandboxCheckpoint {
  id: string;
  description?: string;
  git_ref: string;
  git_state: 'clean' | 'dirty' | 'conflict';
  affected_files?: string[];
  conflict_branch?: string;
}

interface SandboxImage {
  id: string;
  version: number;
  description?: string;
  type: string;
  source_path: string;
  checkpoints: SandboxCheckpoint[];
  created_at: string;
  metadata: Record<string, unknown>;
}

interface CheckpointInspection {
  checkpoint: SandboxCheckpoint;
  valid: boolean;
  resolved_sha?: string;
  commit_message?: string;
  error?: string;
}

interface SandboxInspection {
  image: SandboxImage;
  checkpoints: CheckpointInspection[];
}

// ── Helpers ─────────────────────────────────────────────────────────

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function runGit(cwd: string, args: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30_000,
    }).trim();
  } catch (err: any) {
    const stderr = err.stderr?.toString().trim() || err.message;
    throw new Error(`git ${args} failed: ${stderr}`);
  }
}

function isGitRepo(dirPath: string): boolean {
  try {
    runGit(dirPath, 'rev-parse --is-inside-work-tree');
    return true;
  } catch {
    return false;
  }
}

function resolveRef(cwd: string, ref: string): { sha: string; message: string } {
  const sha = runGit(cwd, `rev-parse ${ref}`);
  const message = runGit(cwd, `log -1 --format=%s ${sha}`);
  return { sha, message };
}

// ── SandboxManager ──────────────────────────────────────────────────

class SandboxManager {
  private basePath: string;

  constructor(repoRoot: string) {
    this.basePath = path.join(repoRoot, '.maestro', 'sandboxes');
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  private imagePath(id: string): string {
    return path.join(this.basePath, id, 'sandbox.json');
  }

  // ── Create ──────────────────────────────────────────────────

  create(
    id: string,
    fromRepo: string,
    checkpoints: Array<{ name: string; ref: string }>,
    description?: string
  ): SandboxImage {
    this.ensureDir();

    // Validate ID (alphanumeric, hyphens, underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      throw new Error(`Invalid sandbox ID '${id}': use only letters, numbers, hyphens, underscores`);
    }

    // Check for existing
    if (fs.existsSync(this.imagePath(id))) {
      throw new Error(`Sandbox image '${id}' already exists. Delete it first or use a different name.`);
    }

    // Resolve repo path
    const repoPath = normalizePath(path.resolve(fromRepo));
    if (!fs.existsSync(repoPath)) {
      throw new Error(`Repository path does not exist: ${repoPath}`);
    }
    if (!isGitRepo(repoPath)) {
      throw new Error(`Not a git repository: ${repoPath}`);
    }

    // Validate and build checkpoints
    const builtCheckpoints: SandboxCheckpoint[] = [];
    for (const cp of checkpoints) {
      // Validate ref exists
      try {
        resolveRef(repoPath, cp.ref);
      } catch (err: any) {
        throw new Error(`Invalid git ref '${cp.ref}' for checkpoint '${cp.name}': ${err.message}`);
      }

      builtCheckpoints.push({
        id: cp.name,
        git_ref: cp.ref,
        git_state: 'clean',
      });
    }

    const image: SandboxImage = {
      id,
      version: 1,
      description: description || undefined,
      type: 'git-worktree',
      source_path: repoPath,
      checkpoints: builtCheckpoints,
      created_at: new Date().toISOString(),
      metadata: {},
    };

    // Write to disk
    const dir = path.join(this.basePath, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.imagePath(id), JSON.stringify(image, null, 2), 'utf-8');

    return image;
  }

  // ── List ────────────────────────────────────────────────────

  list(): SandboxImage[] {
    if (!fs.existsSync(this.basePath)) return [];

    const images: SandboxImage[] = [];
    const entries = fs.readdirSync(this.basePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const jsonPath = path.join(this.basePath, entry.name, 'sandbox.json');
      if (!fs.existsSync(jsonPath)) continue;

      try {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        images.push(data);
      } catch {
        // Skip malformed files
      }
    }

    return images;
  }

  // ── Get ─────────────────────────────────────────────────────

  get(id: string): SandboxImage | null {
    const jsonPath = this.imagePath(id);
    if (!fs.existsSync(jsonPath)) return null;

    try {
      return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  // ── Inspect ─────────────────────────────────────────────────

  inspect(id: string): SandboxInspection {
    const image = this.get(id);
    if (!image) throw new Error(`Sandbox image '${id}' not found`);

    const checkpoints: CheckpointInspection[] = [];

    for (const cp of image.checkpoints) {
      try {
        const { sha, message } = resolveRef(image.source_path, cp.git_ref);
        checkpoints.push({
          checkpoint: cp,
          valid: true,
          resolved_sha: sha,
          commit_message: message,
        });
      } catch (err: any) {
        checkpoints.push({
          checkpoint: cp,
          valid: false,
          error: err.message,
        });
      }
    }

    return { image, checkpoints };
  }

  // ── Delete ──────────────────────────────────────────────────

  delete(id: string): void {
    const dir = path.join(this.basePath, id);
    if (!fs.existsSync(dir)) {
      throw new Error(`Sandbox image '${id}' not found`);
    }

    // Clean up any active worktrees first
    const worktreeDir = path.join(dir, 'worktrees');
    if (fs.existsSync(worktreeDir)) {
      const image = this.get(id);
      if (image) {
        const entries = fs.readdirSync(worktreeDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const worktreePath = path.join(worktreeDir, entry.name);
          try {
            this.destroyWorktree(image.source_path, worktreePath);
          } catch {
            // Best effort cleanup
          }
        }
      }
    }

    fs.rmSync(dir, { recursive: true, force: true });
  }

  // ── Add Checkpoint ──────────────────────────────────────────

  addCheckpoint(id: string, checkpoint: { name: string; ref: string; description?: string; state?: string }): SandboxCheckpoint {
    const image = this.get(id);
    if (!image) throw new Error(`Sandbox image '${id}' not found`);

    // Check for duplicate
    if (image.checkpoints.some(c => c.id === checkpoint.name)) {
      throw new Error(`Checkpoint '${checkpoint.name}' already exists in image '${id}'`);
    }

    // Validate ref
    try {
      resolveRef(image.source_path, checkpoint.ref);
    } catch (err: any) {
      throw new Error(`Invalid git ref '${checkpoint.ref}': ${err.message}`);
    }

    const newCheckpoint: SandboxCheckpoint = {
      id: checkpoint.name,
      description: checkpoint.description,
      git_ref: checkpoint.ref,
      git_state: (checkpoint.state as SandboxCheckpoint['git_state']) || 'clean',
    };

    image.checkpoints.push(newCheckpoint);
    fs.writeFileSync(this.imagePath(id), JSON.stringify(image, null, 2), 'utf-8');

    return newCheckpoint;
  }

  // ── Provision Worktree ──────────────────────────────────────

  provisionWorktree(sandboxId: string, checkpointId: string, targetPath?: string): string {
    const image = this.get(sandboxId);
    if (!image) throw new Error(`Sandbox image '${sandboxId}' not found`);

    const checkpoint = image.checkpoints.find(c => c.id === checkpointId);
    if (!checkpoint) throw new Error(`Checkpoint '${checkpointId}' not found in image '${sandboxId}'`);

    // Resolve ref to SHA for deterministic worktree
    const { sha } = resolveRef(image.source_path, checkpoint.git_ref);

    // Determine worktree path
    const worktreePath = targetPath
      ? normalizePath(path.resolve(targetPath))
      : normalizePath(path.join(this.basePath, sandboxId, 'worktrees', checkpointId));

    // Ensure parent exists
    const parentDir = path.dirname(worktreePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Remove stale worktree if exists
    if (fs.existsSync(worktreePath)) {
      try {
        this.destroyWorktree(image.source_path, worktreePath);
      } catch {
        // Force remove directory
        fs.rmSync(worktreePath, { recursive: true, force: true });
      }
    }

    // Create worktree with detached HEAD at the resolved SHA
    runGit(image.source_path, `worktree add --detach "${worktreePath}" ${sha}`);

    return worktreePath;
  }

  // ── Reset Worktree ─────────────────────────────────────────

  resetWorktree(sandboxId: string, checkpointId: string, worktreePath: string): string {
    const image = this.get(sandboxId);
    if (!image) throw new Error(`Sandbox image '${sandboxId}' not found`);

    const checkpoint = image.checkpoints.find(c => c.id === checkpointId);
    if (!checkpoint) throw new Error(`Checkpoint '${checkpointId}' not found in image '${sandboxId}'`);

    const { sha } = resolveRef(image.source_path, checkpoint.git_ref);

    // Destroy existing worktree then re-provision at the SAME path
    this.destroyWorktree(image.source_path, worktreePath);
    const normalizedPath = normalizePath(path.resolve(worktreePath));
    const parentDir = path.dirname(normalizedPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    runGit(image.source_path, `worktree add --detach "${normalizedPath}" ${sha}`);
    return normalizedPath;
  }

  // ── Destroy Worktree ────────────────────────────────────────

  destroyWorktree(sourceRepo: string, worktreePath: string): void {
    const normalizedPath = normalizePath(path.resolve(worktreePath));

    // Try git worktree remove first
    try {
      runGit(sourceRepo, `worktree remove "${normalizedPath}" --force`);
    } catch {
      // Git remove failed — prune the reference
      try {
        runGit(sourceRepo, 'worktree prune');
      } catch {
        // Best effort
      }
    }

    // Clean up directory if it still exists (Windows may hold locks briefly)
    if (fs.existsSync(normalizedPath)) {
      try {
        fs.rmSync(normalizedPath, { recursive: true, force: true });
      } catch {
        // Directory may be locked momentarily on Windows — acceptable
      }
    }
  }
}

module.exports = { SandboxManager };
