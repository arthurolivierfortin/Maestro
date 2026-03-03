#!/usr/bin/env node
/**
 * Build script for Phase 45-A: compile .NET binaries and copy content
 * for npm distribution.
 *
 * Usage: node scripts/build-dist.js [--skip-llm] [--skip-content] [--rid win-x64|linux-x64]
 *
 * Outputs to packages/maestro-cli/dist/ and packages/maestro-cli/content/
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CLI_PKG = path.join(ROOT, 'packages', 'maestro-cli');
const DIST = path.join(CLI_PKG, 'dist');
const CONTENT_DEST = path.join(CLI_PKG, 'content', 'system');
const CONTENT_SRC = path.join(ROOT, 'content', 'system');

const BACKEND_PROJ = path.join(ROOT, 'apps', 'backend', 'src', 'Maestro.Api', 'Maestro.Api.csproj');
const LLM_PROJ = path.join(ROOT, 'llm-provider', 'dotnet', 'src', 'LLMProvider.Web', 'LLMProvider.Web.csproj');

const args = process.argv.slice(2);
const skipLlm = args.includes('--skip-llm');
const skipContent = args.includes('--skip-content');
const ridFilter = args.includes('--rid') ? args[args.indexOf('--rid') + 1] : null;
const RIDS = ridFilter ? [ridFilter] : ['win-x64', 'linux-x64'];

function run(cmd, label) {
  console.log(`  [build] ${label}...`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT });
  } catch (err) {
    console.error(`  [build] FAILED: ${label}`);
    process.exit(1);
  }
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function dirSize(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(p);
    else total += fs.statSync(p).size;
  }
  return total;
}

function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// ── Main ──

console.log('=== Maestro Distribution Build ===\n');
console.log(`  Platforms: ${RIDS.join(', ')}`);
console.log(`  Skip LLM-Provider: ${skipLlm}`);
console.log(`  Skip content: ${skipContent}\n`);

// Clean
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true });
  console.log('  Cleaned dist/');
}

// Build backend for each RID
for (const rid of RIDS) {
  const outDir = path.join(DIST, rid, 'backend');
  run(
    `dotnet publish "${BACKEND_PROJ}" -c Release -r ${rid} --self-contained -p:PublishSingleFile=true -o "${outDir}"`,
    `Backend (${rid})`
  );
  console.log(`    → ${formatMB(dirSize(outDir))}`);
}

// Build LLM-Provider for each RID
if (!skipLlm) {
  for (const rid of RIDS) {
    const outDir = path.join(DIST, rid, 'llm-provider');
    run(
      `dotnet publish "${LLM_PROJ}" -c Release -r ${rid} --self-contained -p:PublishSingleFile=true -o "${outDir}"`,
      `LLM-Provider (${rid})`
    );
    console.log(`    → ${formatMB(dirSize(outDir))}`);
  }
}

// Copy content
if (!skipContent) {
  console.log('  [build] Copying content/system/...');
  if (fs.existsSync(CONTENT_DEST)) {
    fs.rmSync(CONTENT_DEST, { recursive: true });
  }
  copyDirSync(CONTENT_SRC, CONTENT_DEST);
  console.log(`    → ${formatMB(dirSize(CONTENT_DEST))}`);
}

// Summary
console.log('\n=== Build Complete ===');
console.log(`  Total dist size: ${formatMB(dirSize(DIST))}`);
console.log(`  Content size: ${formatMB(dirSize(CONTENT_DEST))}`);
console.log(`  Output: ${DIST}`);
