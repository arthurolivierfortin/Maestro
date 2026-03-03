#!/usr/bin/env node
/**
 * Build script for Phase 45-A: compile .NET binaries and copy content
 * for npm distribution.
 *
 * Usage: node scripts/build-dist.js [options]
 *
 * Options:
 *   --skip-dotnet   Skip .NET compilation (reuse existing dist/ binaries)
 *   --skip-llm      Skip LLM-Provider compilation
 *   --skip-content   Skip content/ copy
 *   --skip-pack     Skip tarball creation
 *   --rid <rid>     Build for a single platform (win-x64 or linux-x64)
 *
 * Outputs to packages/maestro-cli/dist/, content/, and .tgz tarball
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
const skipDotnet = args.includes('--skip-dotnet');
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

const CLI_NODE_MODULES = path.join(CLI_PKG, 'node_modules');

// Workspace packages to bundle (name → source directory)
const WORKSPACE_PACKAGES = {
  '@maestro/client':  path.join(ROOT, 'packages', 'maestro-client'),
  '@maestro/sidecar': path.join(ROOT, 'packages', 'maestro-sidecar'),
  '@maestro/tui':     path.join(ROOT, 'packages', 'tui'),
  '@maestro/code':    path.join(ROOT, 'packages', 'maestro-code'),
  '@maestro/monitor': path.join(ROOT, 'packages', 'maestro-monitor'),
};

// External deps of workspace packages that must also be bundled
const EXTRA_BUNDLE_DEPS = ['tree-kill'];

/**
 * Copy a workspace package into CLI's local node_modules,
 * respecting the package's "files" field for minimal size.
 */
function bundleWorkspacePackage(pkgName, srcDir, destBase) {
  const pkgJsonPath = path.join(srcDir, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  // Destination: node_modules/@maestro/{shortname}
  const destDir = path.join(destBase, ...pkgName.split('/'));
  if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true });
  fs.mkdirSync(destDir, { recursive: true });

  // Always copy package.json
  fs.copyFileSync(pkgJsonPath, path.join(destDir, 'package.json'));

  // Copy files listed in "files" field
  const filePatterns = pkgJson.files || [];
  for (const pattern of filePatterns) {
    const srcPath = path.join(srcDir, pattern);
    if (!fs.existsSync(srcPath)) continue;
    const stat = fs.statSync(srcPath);
    const destPath = path.join(destDir, pattern);
    if (stat.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }

  return destDir;
}

// ── Main ──

console.log('=== Maestro Distribution Build ===\n');
console.log(`  Platforms: ${RIDS.join(', ')}`);
console.log(`  Skip LLM-Provider: ${skipLlm}`);
console.log(`  Skip content: ${skipContent}\n`);

// Clean dist (only if building .NET)
if (!skipDotnet) {
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
} else {
  console.log('  Skipping .NET build (--skip-dotnet)');
  if (fs.existsSync(DIST)) {
    console.log(`  Existing dist: ${formatMB(dirSize(DIST))}`);
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

// Bundle workspace packages into CLI's local node_modules
// (replaces workspace symlinks with real copies for npm pack)
console.log('  [build] Bundling workspace packages...');
for (const [name, srcDir] of Object.entries(WORKSPACE_PACKAGES)) {
  const dest = bundleWorkspacePackage(name, srcDir, CLI_NODE_MODULES);
  const size = dirSize(dest);
  console.log(`    ${name} → ${formatMB(size)}`);
}

// Copy external deps that workspace packages need
for (const dep of EXTRA_BUNDLE_DEPS) {
  const srcDir = path.join(ROOT, 'node_modules', dep);
  const destDir = path.join(CLI_NODE_MODULES, dep);
  if (!fs.existsSync(srcDir)) {
    console.warn(`    WARN: ${dep} not found in root node_modules — skipping`);
    continue;
  }
  if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true });
  copyDirSync(srcDir, destDir);
  console.log(`    ${dep} → ${formatMB(dirSize(destDir))}`);
}
console.log(`    Total node_modules: ${formatMB(dirSize(CLI_NODE_MODULES))}`);

// Pack: create tarball in a staging directory outside workspace context
// (npm workspace resolves bundleDependencies from root symlinks — doesn't work)
const skipPack = args.includes('--skip-pack');
if (!skipPack) {
  console.log('  [build] Creating npm tarball (staged outside workspace)...');
  const stagingDir = path.join(ROOT, '.build-staging');
  const stagingPkg = path.join(stagingDir, 'package');
  if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true });
  fs.mkdirSync(stagingPkg, { recursive: true });

  // Read CLI package.json and get its "files" list
  const cliPkgJson = JSON.parse(fs.readFileSync(path.join(CLI_PKG, 'package.json'), 'utf8'));
  const cliFiles = cliPkgJson.files || [];

  // Copy package.json
  fs.copyFileSync(path.join(CLI_PKG, 'package.json'), path.join(stagingPkg, 'package.json'));

  // Copy each entry from "files"
  for (const entry of cliFiles) {
    const srcPath = path.join(CLI_PKG, entry);
    if (!fs.existsSync(srcPath)) continue;
    const stat = fs.statSync(srcPath);
    const destPath = path.join(stagingPkg, entry);
    if (stat.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }

  // Copy bundled node_modules (real directories, not symlinks)
  copyDirSync(CLI_NODE_MODULES, path.join(stagingPkg, 'node_modules'));

  // Rewrite the staged package.json with file: dependencies for workspace packages
  // so that npm install creates real (non-symlink) node_modules entries
  const stagedPkgJson = JSON.parse(fs.readFileSync(path.join(stagingPkg, 'package.json'), 'utf8'));
  for (const [name, srcDir] of Object.entries(WORKSPACE_PACKAGES)) {
    if (stagedPkgJson.dependencies && stagedPkgJson.dependencies[name]) {
      stagedPkgJson.dependencies[name] = `file:${srcDir}`;
    }
  }
  fs.writeFileSync(path.join(stagingPkg, 'package.json'), JSON.stringify(stagedPkgJson, null, 2));

  // Install deps in staging (creates real node_modules, not workspace symlinks)
  console.log('    Installing dependencies in staging...');
  execSync('npm install --install-links --ignore-scripts', {
    cwd: stagingPkg,
    stdio: 'inherit',
    env: { ...process.env, npm_config_workspaces: 'false' },
  });

  // Remove platform-specific optional deps that shouldn't be bundled
  const REMOVE_FROM_BUNDLE = ['fsevents']; // macOS-only
  const stagingNM = path.join(stagingPkg, 'node_modules');
  for (const dep of REMOVE_FROM_BUNDLE) {
    const depDir = path.join(stagingNM, dep);
    if (fs.existsSync(depDir)) {
      fs.rmSync(depDir, { recursive: true });
      console.log(`    Removed ${dep} (platform-specific, not needed)`);
    }
  }

  // Strip fsevents from tsx's optionalDependencies so npm install -g
  // doesn't try to rebuild it (fails on Windows with node-gyp)
  const tsxPkgPath = path.join(stagingNM, 'tsx', 'package.json');
  if (fs.existsSync(tsxPkgPath)) {
    const tsxPkg = JSON.parse(fs.readFileSync(tsxPkgPath, 'utf8'));
    if (tsxPkg.optionalDependencies && tsxPkg.optionalDependencies.fsevents) {
      delete tsxPkg.optionalDependencies.fsevents;
      if (Object.keys(tsxPkg.optionalDependencies).length === 0) {
        delete tsxPkg.optionalDependencies;
      }
      fs.writeFileSync(tsxPkgPath, JSON.stringify(tsxPkg, null, 2));
      console.log('    Stripped fsevents from tsx optionalDependencies');
    }
  }

  // Debug: verify staging structure
  console.log(`    Staging node_modules exists: ${fs.existsSync(stagingNM)}`);
  if (fs.existsSync(stagingNM)) {
    const maestroDir = path.join(stagingNM, '@maestro');
    if (fs.existsSync(maestroDir)) {
      const pkgs = fs.readdirSync(maestroDir);
      console.log(`    @maestro/ entries: ${pkgs.join(', ')}`);
      // Check if they're real dirs (not symlinks)
      for (const p of pkgs) {
        const full = path.join(maestroDir, p);
        const isSymlink = fs.lstatSync(full).isSymbolicLink();
        console.log(`      ${p}: ${isSymlink ? 'SYMLINK (bad)' : 'real dir (good)'}`);
      }
    }
  }

  // Run npm pack from staging (no workspace context)
  const packOutput = execSync('npm pack', { cwd: stagingPkg, encoding: 'utf8' }).trim();
  const tgzName = packOutput.split('\n').pop();
  const tgzSrc = path.join(stagingPkg, tgzName);
  const tgzDest = path.join(CLI_PKG, tgzName);
  if (fs.existsSync(tgzDest)) fs.unlinkSync(tgzDest);
  fs.copyFileSync(tgzSrc, tgzDest);

  // Cleanup staging
  fs.rmSync(stagingDir, { recursive: true });

  const tgzSize = fs.statSync(tgzDest).size;
  console.log(`    Tarball: ${tgzName} (${formatMB(tgzSize)})`);
  console.log(`    Location: ${tgzDest}`);
}

// Summary
console.log('\n=== Build Complete ===');
console.log(`  Total dist size: ${formatMB(dirSize(DIST))}`);
console.log(`  Content size: ${formatMB(dirSize(CONTENT_DEST))}`);
console.log(`  Bundled packages: ${formatMB(dirSize(CLI_NODE_MODULES))}`);
console.log(`  Output: ${DIST}`);
