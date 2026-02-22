// @ts-nocheck
/**
 * Unit tests for SandboxManager.
 *
 * Creates a temp git repo, tests all sandbox operations, cleans up.
 * Run: cd packages/maestro-cli && npx vitest run tests/sandbox-manager.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const { SandboxManager } = require('../sandbox-manager.ts');

// ── Temp repo setup ─────────────────────────────────────────────

const TEMP_ROOT = path.join(process.env.TEMP || '/tmp', `sandbox-test-${Date.now()}`);
const REPO_PATH = path.join(TEMP_ROOT, 'test-repo');

function git(args: string) {
  return execSync(`git ${args}`, { cwd: REPO_PATH, encoding: 'utf-8', stdio: 'pipe' }).trim();
}

beforeAll(() => {
  fs.mkdirSync(REPO_PATH, { recursive: true });

  // Init repo with a branch and some commits
  git('init -b main');
  git('config user.email "test@test.com"');
  git('config user.name "Test"');

  fs.writeFileSync(path.join(REPO_PATH, 'file1.txt'), 'hello');
  git('add .');
  git('commit -m "initial commit"');

  fs.writeFileSync(path.join(REPO_PATH, 'file2.txt'), 'world');
  git('add .');
  git('commit -m "second commit"');

  // Create a feature branch
  git('checkout -b feature/test');
  fs.writeFileSync(path.join(REPO_PATH, 'feature.txt'), 'feature');
  git('add .');
  git('commit -m "feature commit"');
  git('checkout main');

  // Init .maestro dir
  fs.mkdirSync(path.join(REPO_PATH, '.maestro', 'sandboxes'), { recursive: true });
});

afterAll(() => {
  // Clean up worktrees first
  try {
    const worktrees = git('worktree list --porcelain');
    // Only prune, don't remove manually
    git('worktree prune');
  } catch { /* ignore */ }

  // Remove temp dir
  try {
    fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  } catch { /* Windows lock — ignore */ }
});

// ── Tests ───────────────────────────────────────────────────────

describe('SandboxManager', () => {
  let manager: any;

  beforeAll(() => {
    manager = new SandboxManager(REPO_PATH);
  });

  it('should list empty when no sandboxes exist', () => {
    const list = manager.list();
    expect(list).toEqual([]);
  });

  it('should create a sandbox image with checkpoints', () => {
    const image = manager.create('test-sandbox', REPO_PATH, [
      { name: 'main-clean', ref: 'main' },
      { name: 'feature', ref: 'feature/test' },
    ], 'Test sandbox image');

    expect(image.id).toBe('test-sandbox');
    expect(image.type).toBe('git-worktree');
    expect(image.description).toBe('Test sandbox image');
    expect(image.checkpoints).toHaveLength(2);
    expect(image.checkpoints[0].id).toBe('main-clean');
    expect(image.checkpoints[0].git_ref).toBe('main');
    expect(image.checkpoints[1].id).toBe('feature');
  });

  it('should reject duplicate sandbox names', () => {
    expect(() => {
      manager.create('test-sandbox', REPO_PATH, [{ name: 'x', ref: 'main' }]);
    }).toThrow(/already exists/);
  });

  it('should reject invalid git refs', () => {
    expect(() => {
      manager.create('bad-ref', REPO_PATH, [{ name: 'x', ref: 'nonexistent-branch-xyz' }]);
    }).toThrow(/Invalid git ref/);
  });

  it('should reject invalid sandbox IDs', () => {
    expect(() => {
      manager.create('bad sandbox!', REPO_PATH, [{ name: 'x', ref: 'main' }]);
    }).toThrow(/Invalid sandbox ID/);
  });

  it('should list created sandboxes', () => {
    const list = manager.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('test-sandbox');
  });

  it('should get a sandbox by ID', () => {
    const image = manager.get('test-sandbox');
    expect(image).not.toBeNull();
    expect(image.id).toBe('test-sandbox');
    expect(image.checkpoints).toHaveLength(2);
  });

  it('should return null for non-existent sandbox', () => {
    expect(manager.get('nonexistent')).toBeNull();
  });

  it('should inspect a sandbox with ref validation', () => {
    const result = manager.inspect('test-sandbox');
    expect(result.image.id).toBe('test-sandbox');
    expect(result.checkpoints).toHaveLength(2);

    // Both refs should be valid
    for (const cp of result.checkpoints) {
      expect(cp.valid).toBe(true);
      expect(cp.resolved_sha).toBeDefined();
      expect(cp.commit_message).toBeDefined();
    }
  });

  it('should add a checkpoint to an existing sandbox', () => {
    const cp = manager.addCheckpoint('test-sandbox', {
      name: 'relative',
      ref: 'main~1',
      description: 'One commit before main',
    });

    expect(cp.id).toBe('relative');
    expect(cp.git_ref).toBe('main~1');
    expect(cp.description).toBe('One commit before main');

    // Verify it persisted
    const image = manager.get('test-sandbox');
    expect(image.checkpoints).toHaveLength(3);
  });

  it('should reject duplicate checkpoint names', () => {
    expect(() => {
      manager.addCheckpoint('test-sandbox', { name: 'main-clean', ref: 'main' });
    }).toThrow(/already exists/);
  });

  it('should provision a worktree from a checkpoint', () => {
    const worktreePath = manager.provisionWorktree('test-sandbox', 'feature');
    expect(fs.existsSync(worktreePath)).toBe(true);

    // Verify it's a valid git worktree
    const log = execSync('git log --oneline -1', { cwd: worktreePath, encoding: 'utf-8' }).trim();
    expect(log).toContain('feature commit');

    // Cleanup
    manager.destroyWorktree(REPO_PATH, worktreePath);
  });

  it('should delete a sandbox image', () => {
    manager.delete('test-sandbox');
    expect(manager.get('test-sandbox')).toBeNull();
    expect(manager.list()).toHaveLength(0);
  });

  it('should throw when deleting non-existent sandbox', () => {
    expect(() => manager.delete('nonexistent')).toThrow(/not found/);
  });
});
