#!/usr/bin/env node
// context-builder.js — Builds focused LLM context by selecting relevant files
// Input: CWD = project dir, task from MAESTRO_INPUT_TASK
// Output: JSON with assembled context, selected files, token estimate

const fs = require('fs');
const path = require('path');

const projectDir = process.cwd();
const task = process.env.MAESTRO_INPUT_TASK || process.argv[2] || '';
const maxTokens = parseInt(process.env.MAESTRO_INPUT_MAXTOKENS || '1500', 10);
const focusFilesRaw = process.env.MAESTRO_INPUT_FOCUSFILES || '';
const includeConventions = (process.env.MAESTRO_INPUT_INCLUDECONVENTIONS || 'true').toLowerCase() !== 'false';

const CHARS_PER_TOKEN = 4; // rough heuristic
const maxChars = maxTokens * CHARS_PER_TOKEN;

if (!task) {
  process.stdout.write(JSON.stringify({
    success: false,
    error: 'No task description provided. Set MAESTRO_INPUT_TASK or pass as argument.'
  }));
  process.exit(0);
}

// ── File Discovery ──

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  'coverage', '.nyc_output', '__pycache__', '.pytest_cache', 'bin', 'obj',
  '.vs', '.idea', '.vscode', 'vendor', 'packages', '.maestro',
  'dist-electron', '.angular', '.svelte-kit'
]);

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.cs', '.py', '.rs', '.go', '.java', '.rb',
  '.html', '.css', '.scss', '.less',
  '.json', '.yaml', '.yml', '.toml',
  '.md', '.txt'
]);

const MAX_FILE_SIZE = 500 * 1024; // 500KB max per file (large entry points like cli.ts)
const MAX_FILES_TO_SCAN = 500; // don't scan huge repos endlessly

function discoverFiles(dir, depth = 0, results = []) {
  if (depth > 8 || results.length >= MAX_FILES_TO_SCAN) return results;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch { return results; }

  for (const entry of entries) {
    if (results.length >= MAX_FILES_TO_SCAN) break;

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        discoverFiles(path.join(dir, entry.name), depth + 1, results);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (CODE_EXTENSIONS.has(ext)) {
        const fullPath = path.join(dir, entry.name);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size <= MAX_FILE_SIZE) {
            results.push({
              path: path.relative(projectDir, fullPath),
              fullPath,
              ext,
              size: stat.size,
              name: entry.name
            });
          }
        } catch { /* skip unreadable */ }
      }
    }
  }
  return results;
}

// ── Keyword Extraction ──

function extractKeywords(text) {
  // Extract meaningful words from task description
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'must',
    'and', 'or', 'but', 'if', 'then', 'else', 'when', 'while', 'for',
    'to', 'from', 'in', 'on', 'at', 'by', 'with', 'of', 'about',
    'this', 'that', 'it', 'its', 'my', 'your', 'our', 'their',
    'not', 'no', 'all', 'each', 'every', 'any', 'some',
    'new', 'add', 'create', 'make', 'update', 'fix', 'change', 'modify',
    'implement', 'write', 'remove', 'delete', 'use', 'get', 'set',
    'file', 'code', 'function', 'class', 'method', 'project',
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou',
    'dans', 'pour', 'avec', 'sur', 'par', 'est', 'sont', 'qui', 'que'
  ]);

  const words = text.toLowerCase()
    .replace(/[^a-z0-9_\-./\\]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  // Also extract CamelCase/snake_case parts
  const parts = [];
  for (const w of words) {
    // split camelCase
    const camelParts = w.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[\s_\-]+/);
    for (const p of camelParts) {
      if (p.length > 2 && !stopWords.has(p)) parts.push(p);
    }
  }

  return [...new Set([...words, ...parts])];
}

// ── Relevance Scoring ──

function scoreFile(file, keywords, focusFiles) {
  let score = 0;

  const pathLower = file.path.toLowerCase();
  const nameLower = file.name.toLowerCase();
  const nameNoExt = path.basename(file.name, file.ext).toLowerCase();

  // Focus files get highest priority
  if (focusFiles.some(f => file.path === f || file.path.endsWith(f) || nameLower === f.toLowerCase())) {
    score += 100;
  }

  // Keyword matching in file name (exact stem match > partial match)
  for (const kw of keywords) {
    if (nameNoExt === kw) score += 20;                    // exact stem match (e.g. "cli" → cli.ts)
    else if (nameNoExt.split(/[\-_.]/).includes(kw)) score += 15; // segment match (e.g. "workspace" in "workspace-detail")
    else if (nameLower.includes(kw)) score += 8;          // substring match
    if (pathLower.includes(kw) && !nameLower.includes(kw)) score += 3; // path-only match (weaker)
  }

  // Multi-keyword bonus: files matching multiple keywords are more relevant
  const matchedKeywords = keywords.filter(kw => pathLower.includes(kw));
  if (matchedKeywords.length >= 2) score += matchedKeywords.length * 5;

  // Convention files — low base score (context via buildConventionSummary instead)
  const conventionFiles = ['package.json', 'tsconfig.json', 'claude.md', '.eslintrc', '.prettierrc'];
  if (conventionFiles.some(c => nameLower.includes(c))) {
    score += 2;
  }

  // Entry points get a significant boost
  const entryNames = ['index', 'main', 'app', 'cli', 'server', 'program'];
  if (entryNames.some(e => nameNoExt === e || nameNoExt.startsWith(e + '.'))) {
    score += 10;
  }

  // Test files — relevant if task mentions testing
  if (nameLower.includes('test') || nameLower.includes('spec')) {
    if (keywords.some(k => ['test', 'tests', 'testing', 'spec', 'jest', 'vitest'].includes(k))) {
      score += 8;
    } else {
      score -= 3; // penalty if task isn't about tests
    }
  }

  // Source files at root level get a boost (likely main files)
  const depth = file.path.split(/[/\\]/).length;
  if (depth === 1 && ['.ts', '.tsx', '.js', '.jsx'].includes(file.ext)) score += 5;

  // TypeScript/JavaScript source preferred over config
  if (['.ts', '.tsx', '.js', '.jsx'].includes(file.ext)) score += 2;
  if (['.md', '.txt'].includes(file.ext)) score -= 1;

  // Deeper files get slight penalty
  score -= Math.max(0, depth - 3) * 0.5;

  return score;
}

// ── Content-Based Scoring (second pass) ──

function scoreFileContent(filePath, keywords) {
  let bonus = 0;
  try {
    const content = fs.readFileSync(filePath, 'utf-8').toLowerCase();
    // Check for keyword occurrences in content
    for (const kw of keywords) {
      const regex = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
      const matches = content.match(regex);
      if (matches) {
        bonus += Math.min(matches.length * 2, 10); // cap at 10 per keyword
      }
    }
  } catch { /* skip unreadable */ }
  return bonus;
}

// ── Content Reading with Import Tracing ──

function readFileContent(filePath, maxLines = 80) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    if (lines.length <= maxLines) return content;

    // For large files: include header (imports, class declarations) + truncation notice
    const header = [];
    let inImports = true;
    for (let i = 0; i < lines.length && header.length < maxLines; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Always include imports and using statements
      if (inImports && (trimmed.startsWith('import ') || trimmed.startsWith('using ') ||
          trimmed.startsWith('from ') || trimmed.startsWith('require(') ||
          trimmed === '' || trimmed.startsWith('//'))) {
        header.push(line);
        continue;
      }
      inImports = false;

      // Include class/function/interface declarations
      if (/^(export\s+)?(default\s+)?(async\s+)?(function|class|interface|type|enum|const|let|var)\s/.test(trimmed) ||
          /^(public|private|protected|internal)\s/.test(trimmed) ||
          /^(def |class )/.test(trimmed)) {
        header.push(line);
      }
    }

    header.push(`\n// ... (${lines.length - header.length} more lines, ${lines.length} total)`);
    return header.join('\n');
  } catch {
    return null;
  }
}

function traceImports(content, ext) {
  const imports = [];
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    const importRegex = /(?:import\s+.*?from\s+|require\()['"]([^'"]+)['"]/g;
    let m;
    while ((m = importRegex.exec(content)) !== null) {
      if (m[1].startsWith('.')) imports.push(m[1]);
    }
  } else if (ext === '.cs') {
    // C# using statements don't directly map to files, skip
  } else if (ext === '.py') {
    const pyImport = /^from\s+(\.\S+)\s+import/gm;
    let m;
    while ((m = pyImport.exec(content)) !== null) {
      imports.push(m[1]);
    }
  }
  return imports;
}

// ── Convention Summary ──

function buildConventionSummary() {
  const conventions = [];
  const maxConvChars = Math.floor(maxChars * 0.15); // 15% budget for conventions

  // CLAUDE.md — most important
  const claudeMd = path.join(projectDir, 'CLAUDE.md');
  if (fs.existsSync(claudeMd)) {
    try {
      const content = fs.readFileSync(claudeMd, 'utf-8');
      // Take first N lines as conventions summary
      const lines = content.split('\n').slice(0, 20);
      conventions.push('## Project Conventions (CLAUDE.md)\n' + lines.join('\n'));
    } catch { /* skip */ }
  }

  // package.json — project name, scripts, key deps
  const pkgJson = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgJson)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf-8'));
      const info = [];
      if (pkg.name) info.push(`Project: ${pkg.name}`);
      if (pkg.scripts) info.push(`Scripts: ${Object.keys(pkg.scripts).join(', ')}`);
      if (pkg.dependencies) info.push(`Deps: ${Object.keys(pkg.dependencies).join(', ')}`);
      if (pkg.devDependencies) info.push(`DevDeps: ${Object.keys(pkg.devDependencies).join(', ')}`);
      conventions.push('## package.json\n' + info.join('\n'));
    } catch { /* skip */ }
  }

  // tsconfig.json — compiler settings
  const tsconfig = path.join(projectDir, 'tsconfig.json');
  if (fs.existsSync(tsconfig)) {
    try {
      const raw = fs.readFileSync(tsconfig, 'utf-8');
      // Just note it exists, don't dump whole config
      conventions.push('## TypeScript: tsconfig.json present');
    } catch { /* skip */ }
  }

  let result = conventions.join('\n\n');
  if (result.length > maxConvChars) {
    result = result.substring(0, maxConvChars) + '\n... (conventions truncated)';
  }
  return result;
}

// ── Main Pipeline ──

const keywords = extractKeywords(task);
const focusFiles = focusFilesRaw.split(',').map(f => f.trim()).filter(Boolean);

// 1. Discover all code files
const allFiles = discoverFiles(projectDir);

// 2. Score each file (path-based first pass)
const pathScored = allFiles.map(f => ({
  ...f,
  score: scoreFile(f, keywords, focusFiles)
})).sort((a, b) => b.score - a.score);

// 2b. Content-based scoring on top candidates (avoid reading ALL files)
const TOP_CANDIDATES = 30;
const scored = pathScored.map((f, i) => {
  if (i < TOP_CANDIDATES && f.score > 0) {
    const contentBonus = scoreFileContent(f.fullPath, keywords);
    return { ...f, score: f.score + contentBonus };
  }
  return f;
}).sort((a, b) => b.score - a.score);

// 3. Build context within token budget
let contextParts = [];
let usedChars = 0;
const selectedFiles = [];

// 3a. Convention summary first (if enabled)
if (includeConventions) {
  const convSummary = buildConventionSummary();
  if (convSummary) {
    contextParts.push(convSummary);
    usedChars += convSummary.length;
  }
}

// 3b. Task context header
const taskHeader = `## Task\n${task}\n`;
contextParts.push(taskHeader);
usedChars += taskHeader.length;

// 3c. Add files by relevance until budget exhausted
const importBoosts = new Map(); // track files referenced by imports of selected files

for (const file of scored) {
  if (usedChars >= maxChars) break;
  if (file.score <= 0 && !importBoosts.has(file.path)) continue;

  const content = readFileContent(file.fullPath);
  if (!content) continue;

  const fileSection = `## ${file.path}\n\`\`\`${file.ext.slice(1)}\n${content}\n\`\`\`\n`;

  if (usedChars + fileSection.length > maxChars) {
    // Try a shorter version (first 30 lines)
    const shortContent = readFileContent(file.fullPath, 30);
    if (!shortContent) continue;
    const shortSection = `## ${file.path}\n\`\`\`${file.ext.slice(1)}\n${shortContent}\n\`\`\`\n`;
    if (usedChars + shortSection.length > maxChars) continue;
    contextParts.push(shortSection);
    usedChars += shortSection.length;
  } else {
    contextParts.push(fileSection);
    usedChars += fileSection.length;
  }

  selectedFiles.push({
    path: file.path,
    score: Math.round(file.score * 10) / 10,
    size: file.size
  });

  // Trace imports and boost referenced files
  const imports = traceImports(content, file.ext);
  for (const imp of imports) {
    // Resolve relative import to file path
    const dir = path.dirname(file.fullPath);
    for (const tryExt of ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']) {
      const resolved = path.resolve(dir, imp + tryExt);
      const relResolved = path.relative(projectDir, resolved);
      if (!importBoosts.has(relResolved)) {
        importBoosts.set(relResolved, (importBoosts.get(relResolved) || 0) + 5);
      }
    }
  }
}

// 4. Assemble final context
const context = contextParts.join('\n\n');
const tokenEstimate = Math.ceil(context.length / CHARS_PER_TOKEN);

const output = {
  success: true,
  context,
  files: selectedFiles,
  tokenEstimate,
  summary: `Selected ${selectedFiles.length} files (${tokenEstimate} est. tokens) from ${allFiles.length} scanned. Keywords: ${keywords.slice(0, 10).join(', ')}`,
  stats: {
    filesScanned: allFiles.length,
    filesSelected: selectedFiles.length,
    keywordsUsed: keywords.slice(0, 15),
    maxTokenBudget: maxTokens,
    charBudget: maxChars,
    charsUsed: context.length
  }
};

process.stdout.write(JSON.stringify(output));
