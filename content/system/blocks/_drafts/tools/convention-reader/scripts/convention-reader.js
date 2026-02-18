#!/usr/bin/env node
// convention-reader.js — Reads and summarizes project conventions
// Input: CWD = project root (set via workingDir input)
// Output: JSON to stdout (parsed by Maestro's parseOutput: "json")

const fs = require('fs');
const path = require('path');

const projectDir = process.argv[2] || process.cwd();

function tryReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function tryParseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function findFile(dir, patterns) {
  for (const p of patterns) {
    const full = path.join(dir, p);
    if (fileExists(full)) return { path: p, content: tryReadFile(full) };
  }
  return null;
}

// ── Collect convention data ──

const conventions = {};
const filesFound = [];

// 1. CLAUDE.md / .claude (AI agent instructions)
const claudeFile = findFile(projectDir, ['CLAUDE.md', '.claude', '.claude/CLAUDE.md']);
if (claudeFile) {
  filesFound.push(claudeFile.path);
  conventions.claudeInstructions = claudeFile.content.trim();
}

// 2. package.json (Node.js project metadata)
const pkgContent = tryReadFile(path.join(projectDir, 'package.json'));
if (pkgContent) {
  filesFound.push('package.json');
  const pkg = tryParseJson(pkgContent);
  if (pkg) {
    conventions.package = {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      main: pkg.main,
      type: pkg.type, // "module" or "commonjs"
      scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
      dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : [],
      devDependencies: pkg.devDependencies ? Object.keys(pkg.devDependencies) : [],
      engines: pkg.engines || null,
    };
  }
}

// 3. tsconfig.json (TypeScript configuration)
const tsconfigFile = findFile(projectDir, ['tsconfig.json', 'tsconfig.build.json']);
if (tsconfigFile) {
  filesFound.push(tsconfigFile.path);
  const tsconfig = tryParseJson(tsconfigFile.content);
  if (tsconfig && tsconfig.compilerOptions) {
    const co = tsconfig.compilerOptions;
    conventions.typescript = {
      target: co.target,
      module: co.module,
      moduleResolution: co.moduleResolution,
      strict: co.strict,
      jsx: co.jsx,
      outDir: co.outDir,
      rootDir: co.rootDir,
      baseUrl: co.baseUrl,
      paths: co.paths || null,
      lib: co.lib || null,
    };
  }
}

// 4. ESLint configuration
const eslintFile = findFile(projectDir, [
  '.eslintrc.json', '.eslintrc.js', '.eslintrc.yml', '.eslintrc.yaml', '.eslintrc',
  'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs'
]);
if (eslintFile) {
  filesFound.push(eslintFile.path);
  const eslintJson = tryParseJson(eslintFile.content);
  if (eslintJson) {
    conventions.eslint = {
      extends: eslintJson.extends,
      rules: eslintJson.rules ? Object.keys(eslintJson.rules).slice(0, 20) : [],
      plugins: eslintJson.plugins || [],
    };
  } else {
    conventions.eslint = { file: eslintFile.path, note: 'Non-JSON config, check file directly' };
  }
}

// 5. Prettier configuration
const prettierFile = findFile(projectDir, [
  '.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.yml',
  'prettier.config.js', 'prettier.config.mjs'
]);
if (prettierFile) {
  filesFound.push(prettierFile.path);
  const prettierJson = tryParseJson(prettierFile.content);
  if (prettierJson) {
    conventions.prettier = prettierJson;
  } else {
    conventions.prettier = { file: prettierFile.path };
  }
}

// 6. .editorconfig
const editorConfig = tryReadFile(path.join(projectDir, '.editorconfig'));
if (editorConfig) {
  filesFound.push('.editorconfig');
  // Parse key settings
  const settings = {};
  editorConfig.split('\n').forEach(line => {
    const match = line.match(/^(\w[\w_]+)\s*=\s*(.+)/);
    if (match) settings[match[1].trim()] = match[2].trim();
  });
  conventions.editorconfig = settings;
}

// 7. .gitignore (key patterns)
const gitignoreContent = tryReadFile(path.join(projectDir, '.gitignore'));
if (gitignoreContent) {
  filesFound.push('.gitignore');
  const patterns = gitignoreContent.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .slice(0, 30);
  conventions.gitignore = patterns;
}

// 8. Test framework detection
const testConfig = findFile(projectDir, [
  'vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs',
  'jest.config.ts', 'jest.config.js', 'jest.config.json',
  'cypress.config.ts', 'cypress.config.js',
  'playwright.config.ts', 'playwright.config.js'
]);
if (testConfig) {
  filesFound.push(testConfig.path);
  conventions.testFramework = testConfig.path.split('.')[0]; // vitest, jest, cypress, playwright
}

// 9. README.md (project description, first 800 chars)
const readmeContent = tryReadFile(path.join(projectDir, 'README.md'));
if (readmeContent) {
  filesFound.push('README.md');
  conventions.readme = readmeContent.substring(0, 800).trim();
}

// 10. Language detection (non-Node projects)
const cargoToml = tryReadFile(path.join(projectDir, 'Cargo.toml'));
if (cargoToml) {
  filesFound.push('Cargo.toml');
  conventions.language = 'rust';
}
const goMod = tryReadFile(path.join(projectDir, 'go.mod'));
if (goMod) {
  filesFound.push('go.mod');
  conventions.language = 'go';
}
const reqTxt = tryReadFile(path.join(projectDir, 'requirements.txt'));
const pyprojectToml = tryReadFile(path.join(projectDir, 'pyproject.toml'));
if (reqTxt || pyprojectToml) {
  if (reqTxt) filesFound.push('requirements.txt');
  if (pyprojectToml) filesFound.push('pyproject.toml');
  conventions.language = 'python';
}

// Default language detection from package.json
if (!conventions.language && conventions.package) {
  conventions.language = conventions.typescript ? 'typescript' : 'javascript';
}

// 11. Directory structure (top-level only)
try {
  const entries = fs.readdirSync(projectDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name);
  const topFiles = entries.filter(e => e.isFile()).map(e => e.name);
  conventions.structure = {
    directories: dirs.slice(0, 20),
    topLevelFiles: topFiles.slice(0, 20)
  };
} catch { /* ignore */ }

// ── Build summary ──

const summaryParts = [];
if (conventions.language) summaryParts.push(`Language: ${conventions.language}`);
if (conventions.package) summaryParts.push(`Package: ${conventions.package.name}@${conventions.package.version}`);
if (conventions.typescript) summaryParts.push(`TypeScript: target=${conventions.typescript.target}, strict=${conventions.typescript.strict}`);
if (conventions.testFramework) summaryParts.push(`Tests: ${conventions.testFramework}`);
if (conventions.eslint) summaryParts.push('ESLint: configured');
if (conventions.prettier) summaryParts.push('Prettier: configured');
if (conventions.package?.scripts?.length) summaryParts.push(`Scripts: ${conventions.package.scripts.join(', ')}`);

const summary = summaryParts.join(' | ');

// ── Output ──

const output = {
  conventions,
  files: filesFound,
  summary,
  projectPath: projectDir,
  timestamp: new Date().toISOString()
};

process.stdout.write(JSON.stringify(output));
