// @ts-nocheck
/**
 * SandboxManager — CLI-local sandbox image management.
 *
 * Sandbox images are immutable snapshots with named checkpoints.
 * V1: git worktrees for filesystem isolation.
 * V2: Docker containers for full OS isolation + custom dependencies.
 * Storage: .maestro/sandboxes/<id>/sandbox.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Types ───────────────────────────────────────────────────────────

interface SandboxCheckpoint {
  id: string;
  description?: string;
  git_ref?: string;                              // git-worktree type
  script?: string;                               // docker type: checkpoint script filename
  git_state?: 'clean' | 'dirty' | 'conflict';   // git-worktree type
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

// ── Docker Helpers ──────────────────────────────────────────────────

function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'pipe', timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

function runDocker(args: string, timeout = 120_000): string {
  try {
    return execSync(`docker ${args}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
    }).trim();
  } catch (err: any) {
    const stderr = err.stderr?.toString().trim() || err.message;
    throw new Error(`docker ${args.split(' ')[0]} failed: ${stderr}`);
  }
}

const CONTAINER_MARKER = '.maestro-container';

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

  // ── Create Docker ─────────────────────────────────────────

  createDocker(
    id: string,
    dockerfilePath: string,
    checkpoints: Array<{ name: string; script: string }>,
    description?: string
  ): SandboxImage {
    this.ensureDir();

    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      throw new Error(`Invalid sandbox ID '${id}': use only letters, numbers, hyphens, underscores`);
    }
    if (fs.existsSync(this.imagePath(id))) {
      throw new Error(`Sandbox image '${id}' already exists. Delete it first or use a different name.`);
    }

    // Validate Dockerfile
    const resolvedDockerfile = path.resolve(dockerfilePath);
    if (!fs.existsSync(resolvedDockerfile)) {
      throw new Error(`Dockerfile not found: ${resolvedDockerfile}`);
    }
    const dockerContext = path.dirname(resolvedDockerfile);

    // Require Docker
    if (!isDockerAvailable()) {
      throw new Error('Docker is not available. Start Docker Desktop and try again.');
    }

    // Create sandbox directory structure
    const sandboxDir = path.join(this.basePath, id);
    fs.mkdirSync(sandboxDir, { recursive: true });
    const checkpointsDir = path.join(sandboxDir, 'checkpoints');
    fs.mkdirSync(checkpointsDir, { recursive: true });

    // Copy Dockerfile
    fs.copyFileSync(resolvedDockerfile, path.join(sandboxDir, 'Dockerfile'));

    // Copy and validate checkpoint scripts
    const builtCheckpoints: SandboxCheckpoint[] = [];
    for (const cp of checkpoints) {
      const scriptPath = path.resolve(dockerContext, cp.script);
      if (!fs.existsSync(scriptPath)) {
        // Cleanup on failure
        fs.rmSync(sandboxDir, { recursive: true, force: true });
        throw new Error(`Checkpoint script not found: ${scriptPath} (for checkpoint '${cp.name}')`);
      }
      const destScript = `${cp.name}.sh`;
      fs.copyFileSync(scriptPath, path.join(checkpointsDir, destScript));
      builtCheckpoints.push({ id: cp.name, script: destScript });
    }

    // Build Docker image
    const imageName = `maestro-sandbox-${id}`;
    const normalizedDir = normalizePath(sandboxDir);
    try {
      runDocker(`build -t ${imageName} -f "${normalizePath(path.join(sandboxDir, 'Dockerfile'))}" "${normalizePath(dockerContext)}"`, 300_000);
    } catch (err: any) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
      throw new Error(`Docker build failed for sandbox '${id}': ${err.message}`);
    }

    const image: SandboxImage = {
      id,
      version: 1,
      description: description || undefined,
      type: 'docker',
      source_path: normalizePath(dockerContext),
      checkpoints: builtCheckpoints,
      created_at: new Date().toISOString(),
      metadata: { dockerImage: imageName },
    };

    fs.writeFileSync(this.imagePath(id), JSON.stringify(image, null, 2), 'utf-8');
    return image;
  }

  // ── Provision Docker ──────────────────────────────────────

  private provisionDocker(sandboxId: string, checkpointId: string, targetPath?: string): string {
    if (!isDockerAvailable()) {
      throw new Error('Docker is not available. Start Docker Desktop and try again.');
    }

    const image = this.get(sandboxId);
    if (!image) throw new Error(`Sandbox image '${sandboxId}' not found`);

    const checkpoint = image.checkpoints.find(c => c.id === checkpointId);
    if (!checkpoint) throw new Error(`Checkpoint '${checkpointId}' not found in image '${sandboxId}'`);

    const imageName = (image.metadata?.dockerImage as string) || `maestro-sandbox-${sandboxId}`;
    const sandboxDir = path.join(this.basePath, sandboxId);
    const checkpointsDir = normalizePath(path.join(sandboxDir, 'checkpoints'));

    // Host mount path
    const mountPath = targetPath
      ? normalizePath(path.resolve(targetPath))
      : normalizePath(path.join(this.basePath, sandboxId, 'mounts', checkpointId));

    // Output path (persists across resets)
    const outputPath = normalizePath(path.join(this.basePath, sandboxId, 'output'));

    // Ensure directories
    for (const dir of [mountPath, outputPath]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Clean stale mount
    if (fs.existsSync(path.join(mountPath, CONTAINER_MARKER))) {
      try {
        const oldContainer = fs.readFileSync(path.join(mountPath, CONTAINER_MARKER), 'utf-8').trim();
        this.destroyDocker(oldContainer, mountPath);
      } catch { /* best effort */ }
    }

    // Container name
    const containerName = `maestro-sb-${sandboxId}-${checkpointId}-${Date.now()}`;
    const scriptFile = checkpoint.script || `${checkpointId}.sh`;

    // Run container with mounts
    runDocker(
      `run -d --name ${containerName}` +
      ` -v "${mountPath}:/workspace"` +
      ` -v "${outputPath}:/output"` +
      ` -v "${checkpointsDir}:/checkpoints:ro"` +
      ` -w /workspace` +
      ` ${imageName}` +
      ` sh -c "sh /checkpoints/${scriptFile} && sleep infinity"`,
      60_000
    );

    // Write container marker
    fs.writeFileSync(path.join(mountPath, CONTAINER_MARKER), containerName, 'utf-8');

    // Wait for checkpoint script to finish (container stays alive via sleep infinity)
    // We detect readiness by checking if the script part finished
    try {
      // Give the script a moment to execute
      execSync('sleep 2', { stdio: 'pipe' });
    } catch { /* ignore */ }

    return mountPath;
  }

  // ── Destroy Docker ────────────────────────────────────────

  private destroyDocker(containerName: string, mountPath: string): void {
    // Stop and remove container
    try { runDocker(`stop ${containerName} -t 5`, 30_000); } catch { /* ignore */ }
    try { runDocker(`rm ${containerName}`, 15_000); } catch { /* ignore */ }

    // Remove marker file
    const markerPath = path.join(mountPath, CONTAINER_MARKER);
    if (fs.existsSync(markerPath)) {
      try { fs.unlinkSync(markerPath); } catch { /* ignore */ }
    }

    // Clean mount dir (but NOT output — that persists)
    if (fs.existsSync(mountPath) && !mountPath.endsWith('/output')) {
      try { fs.rmSync(mountPath, { recursive: true, force: true }); } catch { /* ignore */ }
    }
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
      if (image.type === 'docker') {
        // Docker checkpoints: validate script exists in sandbox dir
        const scriptPath = path.join(this.basePath, id, 'checkpoints', cp.script || `${cp.id}.sh`);
        checkpoints.push({
          checkpoint: cp,
          valid: fs.existsSync(scriptPath),
          commit_message: cp.script ? `script: ${cp.script}` : undefined,
          error: fs.existsSync(scriptPath) ? undefined : `Script not found: ${scriptPath}`,
        });
      } else {
        // Git worktree checkpoints: resolve ref
        try {
          const { sha, message } = resolveRef(image.source_path, cp.git_ref!);
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
    }

    return { image, checkpoints };
  }

  // ── Delete ──────────────────────────────────────────────────

  delete(id: string): void {
    const dir = path.join(this.basePath, id);
    if (!fs.existsSync(dir)) {
      throw new Error(`Sandbox image '${id}' not found`);
    }

    const image = this.get(id);

    if (image && image.type === 'docker') {
      // Docker: stop/rm any active containers, remove image
      const mountsDir = path.join(dir, 'mounts');
      if (fs.existsSync(mountsDir)) {
        const entries = fs.readdirSync(mountsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const mountPath = path.join(mountsDir, entry.name);
          const markerPath = path.join(mountPath, CONTAINER_MARKER);
          if (fs.existsSync(markerPath)) {
            try {
              const containerName = fs.readFileSync(markerPath, 'utf-8').trim();
              this.destroyDocker(containerName, mountPath);
            } catch { /* best effort */ }
          }
        }
      }
      // Remove Docker image
      const imageName = (image.metadata?.dockerImage as string) || `maestro-sandbox-${id}`;
      try { runDocker(`rmi ${imageName}`, 30_000); } catch { /* best effort */ }
    } else if (image) {
      // Git worktree: clean up active worktrees
      const worktreeDir = path.join(dir, 'worktrees');
      if (fs.existsSync(worktreeDir)) {
        const entries = fs.readdirSync(worktreeDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const worktreePath = path.join(worktreeDir, entry.name);
          try {
            this.destroyWorktree(image.source_path, worktreePath);
          } catch { /* best effort */ }
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

    // Docker dispatch
    if (image.type === 'docker') {
      return this.provisionDocker(sandboxId, checkpointId, targetPath);
    }

    const checkpoint = image.checkpoints.find(c => c.id === checkpointId);
    if (!checkpoint) throw new Error(`Checkpoint '${checkpointId}' not found in image '${sandboxId}'`);

    // Resolve ref to SHA for deterministic worktree
    const { sha } = resolveRef(image.source_path, checkpoint.git_ref!);

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

    // Docker dispatch: destroy container, re-provision at same path
    if (image.type === 'docker') {
      const markerPath = path.join(worktreePath, CONTAINER_MARKER);
      if (fs.existsSync(markerPath)) {
        const containerName = fs.readFileSync(markerPath, 'utf-8').trim();
        this.destroyDocker(containerName, worktreePath);
      }
      return this.provisionDocker(sandboxId, checkpointId, worktreePath);
    }

    const { sha } = resolveRef(image.source_path, checkpoint.git_ref!);

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

    // Docker dispatch: check for container marker
    const markerPath = path.join(normalizedPath, CONTAINER_MARKER);
    if (fs.existsSync(markerPath)) {
      const containerName = fs.readFileSync(markerPath, 'utf-8').trim();
      return this.destroyDocker(containerName, normalizedPath);
    }

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

module.exports = { SandboxManager, isDockerAvailable };
