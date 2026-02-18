#!/usr/bin/env node
// dependency-manager.js — Manages project dependencies (npm install/add/remove)
// Input: CWD = project dir, action from env MAESTRO_INPUT_ACTION
// Output: JSON with operation result

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDir = process.cwd();
const action = process.env.MAESTRO_INPUT_ACTION || process.argv[2] || 'install';
const packages = (process.env.MAESTRO_INPUT_PACKAGES || process.argv[3] || '').split(',').map(p => p.trim()).filter(Boolean);
const isDev = (process.env.MAESTRO_INPUT_ISDEV || '').toLowerCase() === 'true';

// Detect package manager
function detectPackageManager() {
  if (fs.existsSync(path.join(projectDir, 'bun.lockb'))) return 'bun';
  if (fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectDir, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

const pm = detectPackageManager();

function runCommand(cmd) {
  try {
    const output = execSync(cmd, {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, output: output.trim() };
  } catch (e) {
    return { success: false, error: e.message, stderr: e.stderr?.toString()?.trim() };
  }
}

let result;

switch (action.toLowerCase()) {
  case 'install': {
    const cmd = packages.length > 0
      ? `${pm} ${pm === 'npm' ? 'install' : 'add'} ${isDev ? '-D' : ''} ${packages.join(' ')}`
      : `${pm} install`;
    result = runCommand(cmd.trim());
    result.action = 'install';
    result.packages = packages;
    result.isDev = isDev;
    break;
  }

  case 'remove':
  case 'uninstall': {
    if (packages.length === 0) {
      result = { success: false, error: 'No packages specified for removal' };
    } else {
      const cmd = `${pm} ${pm === 'npm' ? 'uninstall' : 'remove'} ${packages.join(' ')}`;
      result = runCommand(cmd);
    }
    result.action = 'remove';
    result.packages = packages;
    break;
  }

  case 'list': {
    const cmd = `${pm} list --depth=0 --json 2>&1`;
    const raw = runCommand(cmd);
    result = { action: 'list', ...raw };
    try {
      if (raw.success && raw.output) {
        const parsed = JSON.parse(raw.output);
        result.dependencies = parsed.dependencies ? Object.keys(parsed.dependencies) : [];
      }
    } catch { /* keep raw output */ }
    break;
  }

  case 'outdated': {
    const cmd = `${pm} outdated --json 2>&1`;
    const raw = runCommand(cmd);
    result = { action: 'outdated', ...raw };
    try {
      if (raw.output) {
        result.outdated = JSON.parse(raw.output);
      }
    } catch { /* keep raw output */ }
    break;
  }

  case 'audit': {
    const cmd = `${pm} audit --json 2>&1`;
    const raw = runCommand(cmd);
    result = { action: 'audit', ...raw };
    break;
  }

  default:
    result = { success: false, error: `Unknown action: ${action}. Use install, remove, list, outdated, or audit.` };
}

result.packageManager = pm;
result.projectDir = projectDir;

process.stdout.write(JSON.stringify(result));
