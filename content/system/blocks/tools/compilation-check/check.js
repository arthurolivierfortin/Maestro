// Compilation Check tool block
//
// Inputs (via environment variables set by ToolBlockExecutor):
//   MAESTRO_INPUT_WORKINGDIR    — Project root directory
//   MAESTRO_INPUT_BUILDCOMMAND  — Override build command (optional, auto-detected if not provided)
//
// Output: JSON with success, buildCommand, stdout, stderr, errorCount, warningCount, exitCode

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const workingDir = process.env.MAESTRO_INPUT_WORKINGDIR || process.cwd();
const buildCommandOverride = process.env.MAESTRO_INPUT_BUILDCOMMAND || '';

function detectBuildCommand(dir) {
  // Check package.json
  const pkgPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts && pkg.scripts.build) return 'npm run build';
      // Check for TypeScript
      const tsconfigPath = path.join(dir, 'tsconfig.json');
      if (fs.existsSync(tsconfigPath)) return 'npx tsc --noEmit';
    } catch {
      // Fall through
    }
    return 'npm run build';
  }

  // Check .csproj
  try {
    const files = fs.readdirSync(dir);
    const csprojFiles = files.filter(f => f.endsWith('.csproj'));
    if (csprojFiles.length > 0) return 'dotnet build';

    // Check for .sln
    const slnFiles = files.filter(f => f.endsWith('.sln'));
    if (slnFiles.length > 0) return 'dotnet build';
  } catch {
    // Fall through
  }

  // Check Cargo.toml
  if (fs.existsSync(path.join(dir, 'Cargo.toml'))) return 'cargo build';

  // Check go.mod
  if (fs.existsSync(path.join(dir, 'go.mod'))) return 'go build ./...';

  // Check pyproject.toml
  if (fs.existsSync(path.join(dir, 'pyproject.toml'))) return 'python -m py_compile';

  return null;
}

// Count real errors/warnings, filtering out summary lines like "0 Error(s)", "0 Warning(s)"
function countIssues(text) {
  const lines = text.split('\n');
  let errorCount = 0;
  let warningCount = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip summary lines (e.g., "0 Error(s)", "0 Warning(s)", "Build succeeded.")
    if (/^\d+\s+(error|warning)/i.test(trimmed)) continue;
    // Count lines containing error/warning indicators
    if (/\berror\b/i.test(trimmed)) errorCount++;
    if (/\bwarning\b/i.test(trimmed)) warningCount++;
  }
  return { errorCount, warningCount };
}

// Validate workingDir exists
if (!fs.existsSync(workingDir)) {
  console.log(JSON.stringify({
    success: false,
    buildCommand: null,
    stdout: '',
    stderr: `Working directory does not exist: ${workingDir}`,
    errorCount: 0,
    warningCount: 0,
    exitCode: -1
  }));
  process.exit(0);
}

const buildCommand = buildCommandOverride || detectBuildCommand(workingDir);

if (!buildCommand) {
  console.log(JSON.stringify({
    success: false,
    buildCommand: null,
    stdout: '',
    stderr: 'Could not auto-detect build command. No package.json, *.csproj, *.sln, Cargo.toml, go.mod, or pyproject.toml found.',
    errorCount: 0,
    warningCount: 0,
    exitCode: -1
  }));
  process.exit(0);
}

try {
  const stdout = execSync(buildCommand, {
    cwd: workingDir,
    encoding: 'utf-8',
    timeout: 100000,
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const truncatedStdout = stdout.length > 10000 ? stdout.slice(-10000) + '\n--truncated--' : stdout;

  // Count errors/warnings in output (exclude summary lines like "0 Error(s)")
  const { errorCount, warningCount } = countIssues(truncatedStdout);

  console.log(JSON.stringify({
    success: true,
    buildCommand,
    stdout: truncatedStdout,
    stderr: '',
    errorCount,
    warningCount,
    exitCode: 0
  }));
} catch (err) {
  const stdout = (err.stdout || '').toString();
  const stderr = (err.stderr || '').toString();
  const truncStdout = stdout.length > 10000 ? stdout.slice(-10000) : stdout;
  const truncStderr = stderr.length > 10000 ? stderr.slice(-10000) : stderr;
  const combined = truncStdout + '\n' + truncStderr;

  const { errorCount, warningCount } = countIssues(combined);

  console.log(JSON.stringify({
    success: false,
    buildCommand,
    stdout: truncStdout,
    stderr: truncStderr,
    errorCount,
    warningCount,
    exitCode: err.status || 1
  }));
}
